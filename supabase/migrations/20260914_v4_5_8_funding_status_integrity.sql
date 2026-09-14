-- SecuredLanding v4.5.8 - Funding Status Integrity
-- 2026-09-14
--
-- Goal:
--   * A loan can only be Funded when committed, non-terminal investments reach its goal.
--   * Underfunded loans remain in funding/approved state.
--   * Expired underfunded marketplace loans close automatically when refreshed.
--   * Existing loans are reconciled from the investments ledger during this migration.
--   * Future investment changes automatically refresh loan + marketplace totals.
--
-- This migration does NOT release borrower funds. The existing protection-hold /
-- disbursement workflow remains authoritative for borrower payout readiness.

begin;

-- Production currently has the marketplace funding fields but some older
-- loan_applications funding fields were never added. Add them safely so both
-- sides can expose the same state without depending on historical migration order.
alter table public.loan_applications
  add column if not exists funding_started_at timestamptz,
  add column if not exists funding_deadline timestamptz,
  add column if not exists funding_window_days integer not null default 45,
  add column if not exists funding_status text not null default 'not_started';

alter table public.marketplace_loans
  add column if not exists funding_started_at timestamptz,
  add column if not exists funding_deadline timestamptz,
  add column if not exists funding_window_days integer not null default 45,
  add column if not exists funding_status text not null default 'open';

-- Keep the existing function name/signature because several deployed investment
-- paths already call refresh_loan_funding_totals(bigint). The argument accepts
-- either the public six-digit loan number or the internal loan_applications.id.
create or replace function public.refresh_loan_funding_totals(
  p_loan_number bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan public.loan_applications%rowtype;
  v_market public.marketplace_loans%rowtype;
  v_goal numeric := 0;
  v_committed numeric := 0;
  v_remaining numeric := 0;
  v_deadline timestamptz;
  v_started timestamptz;
  v_funding_state text := 'not_started';
  v_market_status text;
  v_application_status text;
begin
  -- Public loan numbers are six digits and are the preferred match. Internal ids
  -- are supported for compatibility with older wallet RPCs.
  select la.*
  into v_loan
  from public.loan_applications la
  where la.loan_number = p_loan_number
     or la.id = p_loan_number
  order by case when la.loan_number = p_loan_number then 0 else 1 end
  limit 1;

  if v_loan.id is null then
    raise exception 'Loan reference % not found', p_loan_number;
  end if;

  select ml.*
  into v_market
  from public.marketplace_loans ml
  where ml.loan_application_id = v_loan.id
     or (v_loan.loan_number is not null and ml.loan_number = v_loan.loan_number)
  order by case when ml.loan_application_id = v_loan.id then 0 else 1 end
  limit 1;

  v_goal := coalesce(
    nullif(v_market.funding_goal, 0),
    nullif(v_market.loan_amount, 0),
    nullif(v_loan.approved_loan_amount, 0),
    nullif(v_loan.loan_amount, 0),
    nullif(v_loan.requested_loan_amount, 0),
    0
  );

  select coalesce(sum(i.amount), 0)
  into v_committed
  from public.investments i
  where (
      i.loan_application_id = v_loan.id
      or i.loan_id = v_loan.id
      or (v_loan.loan_number is not null and i.loan_id = v_loan.loan_number)
    )
    and lower(coalesce(i.status, 'active')) not in (
      'refunded', 'cancelled', 'canceled', 'failed', 'reversed', 'void', 'voided', 'rejected'
    );

  v_remaining := greatest(v_goal - v_committed, 0);
  v_started := coalesce(v_market.funding_started_at, v_loan.funding_started_at);
  v_deadline := coalesce(v_market.funding_deadline, v_loan.funding_deadline);

  -- If a marketplace row exists but never received a funding window, start the
  -- normal 45-day clock now. Existing deadlines are never extended here.
  if v_market.id is not null and v_remaining > 0.009 and v_started is null then
    v_started := now();
  end if;
  if v_market.id is not null and v_remaining > 0.009 and v_deadline is null then
    v_deadline := coalesce(v_started, now()) + make_interval(days => coalesce(v_market.funding_window_days, v_loan.funding_window_days, 45));
  end if;

  if v_goal > 0 and v_remaining <= 0.009 then
    v_funding_state := 'fully_funded';
  elsif v_deadline is not null and v_deadline <= now() then
    v_funding_state := 'expired';
  elsif v_market.id is not null then
    v_funding_state := 'open';
  else
    v_funding_state := coalesce(nullif(v_loan.funding_status, ''), 'not_started');
  end if;

  -- Explicit cancellation/pause remains explicit and is not reopened by a refresh.
  if lower(coalesce(v_loan.funding_status, '')) in ('cancelled', 'paused') then
    v_funding_state := lower(v_loan.funding_status);
  end if;

  v_application_status := coalesce(v_loan.status, 'Pending');
  if lower(v_application_status) in ('approved', 'funded') then
    if v_goal > 0 and v_remaining <= 0.009 then
      v_application_status := 'Funded';
    else
      -- Repair any false Funded state without moving the loan backwards into underwriting.
      v_application_status := 'Approved';
    end if;
  end if;

  update public.loan_applications
  set
    amount_funded = v_committed,
    amount_remaining = v_remaining,
    funding_started_at = coalesce(funding_started_at, v_started),
    funding_deadline = coalesce(funding_deadline, v_deadline),
    funding_status = case
      when lower(coalesce(funding_status, '')) in ('cancelled', 'paused') then funding_status
      else v_funding_state
    end,
    status = v_application_status
  where id = v_loan.id;

  if v_market.id is not null then
    if lower(coalesce(v_loan.status, '')) in ('denied', 'cancelled', 'canceled')
       or lower(coalesce(v_market.funding_status, '')) in ('cancelled', 'paused') then
      v_market_status := 'Closed';
    elsif v_goal > 0 and v_remaining <= 0.009 then
      v_market_status := 'Funded';
    elsif v_deadline is not null and v_deadline <= now() then
      v_market_status := 'Closed';
    else
      v_market_status := 'Open';
    end if;

    update public.marketplace_loans
    set
      funding_goal = case when v_goal > 0 then v_goal else funding_goal end,
      amount_funded = v_committed,
      amount_remaining = v_remaining,
      funding_started_at = coalesce(funding_started_at, v_started),
      funding_deadline = coalesce(funding_deadline, v_deadline),
      funding_status = case
        when lower(coalesce(funding_status, '')) in ('cancelled', 'paused') then funding_status
        else v_funding_state
      end,
      status = v_market_status,
      updated_at = now()
    where id = v_market.id;
  end if;

  -- The closing checklist follows the same funding truth. Releasing money still
  -- requires the separate protection/disbursement workflow.
  update public.closing_tasks
  set
    status = case when v_goal > 0 and v_remaining <= 0.009 then 'complete' else 'pending' end,
    completed_at = case when v_goal > 0 and v_remaining <= 0.009 then coalesce(completed_at, now()) else null end
  where loan_application_id = v_loan.id
    and task_key = 'investor_funding'
    and lower(coalesce(status, 'pending')) not in ('waived', 'cancelled', 'canceled');
end;
$$;

revoke all on function public.refresh_loan_funding_totals(bigint) from public;
grant execute on function public.refresh_loan_funding_totals(bigint) to authenticated;

-- Protect every investment entry point, not just one front-end path. This blocks
-- overfunding and new primary investments after the 45-day deadline.
create or replace function public.guard_primary_investment_funding_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market public.marketplace_loans%rowtype;
  v_goal numeric := 0;
  v_existing numeric := 0;
  v_reference bigint;
begin
  if lower(coalesce(new.status, 'active')) in ('refunded', 'cancelled', 'canceled', 'failed', 'reversed', 'void', 'voided', 'rejected') then
    return new;
  end if;

  v_reference := coalesce(new.loan_application_id, new.loan_id);
  if v_reference is null then
    return new;
  end if;

  select ml.* into v_market
  from public.marketplace_loans ml
  where ml.loan_application_id = v_reference
     or ml.loan_number = v_reference
  order by case when ml.loan_application_id = v_reference then 0 else 1 end
  limit 1;

  -- Preserve compatibility with non-marketplace/legacy investment rows.
  if v_market.id is null then
    return new;
  end if;

  if v_market.funding_deadline is not null and v_market.funding_deadline <= now() then
    raise exception 'Funding window is closed for Loan #%', coalesce(v_market.loan_number, v_reference);
  end if;

  if lower(coalesce(v_market.status, 'Open')) <> 'open' then
    raise exception 'Loan #% is not open for new investments', coalesce(v_market.loan_number, v_reference);
  end if;

  v_goal := coalesce(nullif(v_market.funding_goal, 0), nullif(v_market.loan_amount, 0), 0);
  if v_goal <= 0 then
    return new;
  end if;

  select coalesce(sum(i.amount), 0)
  into v_existing
  from public.investments i
  where (
      i.loan_application_id = v_market.loan_application_id
      or i.loan_id = v_market.loan_application_id
      or (v_market.loan_number is not null and i.loan_id = v_market.loan_number)
    )
    and lower(coalesce(i.status, 'active')) not in (
      'refunded', 'cancelled', 'canceled', 'failed', 'reversed', 'void', 'voided', 'rejected'
    );

  if v_existing + coalesce(new.amount, 0) > v_goal + 0.009 then
    raise exception 'Investment exceeds remaining funding amount of $%', greatest(v_goal - v_existing, 0);
  end if;

  return new;
end;
$$;

-- One post-change trigger keeps both loan tables synchronized no matter which
-- investment/payment path created, refunded, or changed a certificate.
create or replace function public.sync_funding_after_investment_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_ref bigint;
  v_old_ref bigint;
begin
  if tg_op <> 'DELETE' then
    v_new_ref := coalesce(new.loan_application_id, new.loan_id);
  end if;
  if tg_op <> 'INSERT' then
    v_old_ref := coalesce(old.loan_application_id, old.loan_id);
  end if;

  -- Refresh the old loan only when the investment moved away from it.
  if v_old_ref is not null and (v_new_ref is null or v_old_ref <> v_new_ref) then
    perform public.refresh_loan_funding_totals(v_old_ref);
  end if;
  if v_new_ref is not null then
    perform public.refresh_loan_funding_totals(v_new_ref);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists investments_guard_primary_funding_v1 on public.investments;
create trigger investments_guard_primary_funding_v1
before insert on public.investments
for each row execute function public.guard_primary_investment_funding_v1();

drop trigger if exists investments_sync_funding_v1 on public.investments;
create trigger investments_sync_funding_v1
after insert or delete or update of amount, status, loan_id, loan_application_id
on public.investments
for each row execute function public.sync_funding_after_investment_v1();

-- Reconcile every existing marketplace loan now. This repairs false Funded
-- labels such as a $2,400 / $40,000 loan that had been manually marked Funded.
do $$
declare
  r record;
begin
  for r in
    select distinct coalesce(la.loan_number, la.id) as loan_reference
    from public.loan_applications la
    where exists (
      select 1 from public.marketplace_loans ml
      where ml.loan_application_id = la.id
         or (la.loan_number is not null and ml.loan_number = la.loan_number)
    )
  loop
    perform public.refresh_loan_funding_totals(r.loan_reference);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
