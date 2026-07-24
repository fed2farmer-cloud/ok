-- Secured Landing v2.8 corrected wallet + investor protection upgrade
-- Matches confirmed schema:
-- investments(id bigint, loan_id bigint, investor_id uuid, amount numeric, status text)
-- investor_wallets(user_id uuid, available_balance numeric, invested_balance numeric)
-- wallet_transactions(user_id uuid, transaction_type text, amount numeric, loan_id bigint, status text, description text)
-- marketplace_loans(id bigint, loan_application_id bigint, loan_number bigint, amount_funded numeric, amount_remaining numeric)
-- loan_applications(id bigint, loan_number bigint, amount_funded numeric, amount_remaining numeric)
--
-- Investor-only 7-day cancellation/refund feature.
-- This creates NO borrower refund or cancellation right.

begin;

create extension if not exists pgcrypto;

-- Add protection fields to the existing investments table.
alter table public.investments
  add column if not exists refund_policy_enabled boolean not null default true,
  add column if not exists refund_period_days integer not null default 7,
  add column if not exists refund_deadline timestamptz,
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refund_processed_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists settled_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Add marketplace protection totals.
alter table public.marketplace_loans
  add column if not exists investor_refund_enabled boolean not null default true,
  add column if not exists investor_refund_days integer not null default 7,
  add column if not exists protected_funds numeric not null default 0,
  add column if not exists settled_funds numeric not null default 0;

-- Refund request table uses BIGINT because investments.id is BIGINT.
create table if not exists public.investment_refund_requests (
  id uuid primary key default gen_random_uuid(),
  investment_id bigint not null unique references public.investments(id) on delete restrict,
  investor_id uuid not null references auth.users(id) on delete restrict,
  loan_id bigint not null references public.loan_applications(id) on delete restrict,
  amount numeric not null check (amount > 0),
  reason text,
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  admin_notes text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.investment_audit_events (
  id uuid primary key default gen_random_uuid(),
  investment_id bigint not null references public.investments(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_key text not null,
  description text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.investor_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investment_id bigint references public.investments(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null default 'investment_update',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists investments_investor_created_idx
  on public.investments(investor_id, created_at desc);

create index if not exists investments_refund_deadline_idx
  on public.investments(status, refund_deadline);

create index if not exists investment_refund_requests_status_idx
  on public.investment_refund_requests(status, requested_at desc);

-- Recalculate marketplace and loan_application funding from the investment ledger.
create or replace function public.refresh_loan_funding_totals(p_loan_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric := 0;
  v_protected numeric := 0;
  v_settled numeric := 0;
begin
  select
    coalesce(sum(amount) filter (
      where status not in ('refunded', 'cancelled', 'failed')
    ), 0),
    coalesce(sum(amount) filter (
      where status in ('protection_period', 'refund_requested', 'refund_processing')
    ), 0),
    coalesce(sum(amount) filter (
      where status in ('settled', 'active')
    ), 0)
  into v_total, v_protected, v_settled
  from public.investments
  where loan_id = p_loan_id;

  update public.marketplace_loans
  set
    amount_funded = v_total,
    amount_remaining = greatest(coalesce(funding_goal, loan_amount, 0) - v_total, 0),
    protected_funds = v_protected,
    settled_funds = v_settled,
    updated_at = now()
  where loan_application_id = p_loan_id;

  update public.loan_applications
  set
    amount_funded = v_total,
    amount_remaining = greatest(coalesce(loan_amount, 0) - v_total, 0)
  where id = p_loan_id;
end;
$$;

-- Atomic wallet-funded investment.
-- Input is the public six-digit loan number shown in the UI.
create or replace function public.invest_from_wallet_v28(
  p_loan_number bigint,
  p_amount numeric
)
returns public.investments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.investor_wallets;
  v_marketplace public.marketplace_loans;
  v_investment public.investments;
  v_days integer := 7;
  v_enabled boolean := true;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_amount is null or p_amount < 100 then
    raise exception 'Minimum investment is $100';
  end if;

  select *
  into v_marketplace
  from public.marketplace_loans
  where loan_number = p_loan_number
    and coalesce(published, true) = true
  for update;

  if not found then
    raise exception 'Marketplace loan % was not found', p_loan_number;
  end if;

  if p_amount > coalesce(v_marketplace.amount_remaining, v_marketplace.funding_goal, v_marketplace.loan_amount, 0) then
    raise exception 'Investment exceeds the remaining funding amount';
  end if;

  select *
  into v_wallet
  from public.investor_wallets
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'Investor wallet was not found';
  end if;

  if coalesce(v_wallet.available_balance, 0) < p_amount then
    raise exception 'Insufficient available cash';
  end if;

  v_enabled := coalesce(v_marketplace.investor_refund_enabled, true);
  v_days := case
    when v_enabled then coalesce(v_marketplace.investor_refund_days, 7)
    else 0
  end;

  update public.investor_wallets
  set
    available_balance = available_balance - p_amount,
    invested_balance = invested_balance + p_amount,
    updated_at = now()
  where user_id = v_user_id;

  insert into public.investments (
    loan_id,
    investor_id,
    amount,
    investor_interest_rate,
    borrower_interest_rate,
    company_spread_rate,
    term_months,
    status,
    refund_policy_enabled,
    refund_period_days,
    refund_deadline,
    updated_at
  )
  values (
    v_marketplace.loan_application_id,
    v_user_id,
    p_amount,
    v_marketplace.investor_interest_rate,
    v_marketplace.borrower_interest_rate,
    v_marketplace.company_spread_rate,
    v_marketplace.repayment_term_months,
    case when v_enabled and v_days > 0 then 'protection_period' else 'settled' end,
    v_enabled,
    v_days,
    case when v_enabled and v_days > 0 then now() + make_interval(days => v_days) else now() end,
    now()
  )
  returning * into v_investment;

  insert into public.wallet_transactions (
    user_id,
    transaction_type,
    amount,
    loan_id,
    status,
    description
  )
  values (
    v_user_id,
    'investment',
    -p_amount,
    v_marketplace.loan_application_id,
    'completed',
    'Investment funded from available cash for Loan #' || p_loan_number::text || '.'
  );

  insert into public.investment_audit_events (
    investment_id,
    actor_user_id,
    event_key,
    description,
    after_state
  )
  values (
    v_investment.id,
    v_user_id,
    'investment_created',
    'Investment created and debited from available cash.',
    jsonb_build_object(
      'loan_id', v_marketplace.loan_application_id,
      'loan_number', p_loan_number,
      'amount', p_amount,
      'status', v_investment.status,
      'refund_deadline', v_investment.refund_deadline
    )
  );

  insert into public.investor_notifications (
    user_id,
    investment_id,
    title,
    message,
    notification_type
  )
  values (
    v_user_id,
    v_investment.id,
    'Investment confirmed',
    case
      when v_enabled and v_days > 0
        then 'Your investment is protected by a ' || v_days::text || '-day investor refund period.'
      else 'Your investment is confirmed.'
    end,
    'investment_created'
  );

  perform public.refresh_loan_funding_totals(v_marketplace.loan_application_id);

  return v_investment;
end;
$$;

grant execute on function public.invest_from_wallet_v28(bigint, numeric)
to authenticated;

-- Investor requests a refund during the valid window.
create or replace function public.request_investment_refund_v28(
  p_investment_id bigint,
  p_reason text default null
)
returns public.investment_refund_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_investment public.investments;
  v_request public.investment_refund_requests;
begin
  select *
  into v_investment
  from public.investments
  where id = p_investment_id
  for update;

  if not found then
    raise exception 'Investment not found';
  end if;

  if v_investment.investor_id <> auth.uid() then
    raise exception 'You can only refund your own investment';
  end if;

  if not coalesce(v_investment.refund_policy_enabled, false) then
    raise exception 'Refund protection is not enabled for this investment';
  end if;

  if v_investment.status <> 'protection_period' then
    raise exception 'Investment is not eligible for refund';
  end if;

  if v_investment.refund_deadline is null or now() >= v_investment.refund_deadline then
    raise exception 'The investor refund period has expired';
  end if;

  update public.investments
  set
    status = 'refund_requested',
    refund_requested_at = now(),
    updated_at = now()
  where id = v_investment.id;

  insert into public.investment_refund_requests (
    investment_id,
    investor_id,
    loan_id,
    amount,
    reason,
    status
  )
  values (
    v_investment.id,
    v_investment.investor_id,
    v_investment.loan_id,
    v_investment.amount,
    nullif(trim(p_reason), ''),
    'requested'
  )
  on conflict (investment_id)
  do update set
    reason = excluded.reason,
    status = 'requested',
    requested_at = now(),
    updated_at = now()
  returning * into v_request;

  insert into public.investment_audit_events (
    investment_id,
    actor_user_id,
    event_key,
    description,
    before_state,
    after_state
  )
  values (
    v_investment.id,
    auth.uid(),
    'refund_requested',
    'Investor requested a refund during the protected period.',
    jsonb_build_object('status', v_investment.status),
    jsonb_build_object('status', 'refund_requested')
  );

  perform public.refresh_loan_funding_totals(v_investment.loan_id);

  return v_request;
end;
$$;

grant execute on function public.request_investment_refund_v28(bigint, text)
to authenticated;

-- Admin completes wallet refund.
-- Connect processor reversal separately for card/ACH-funded investments.
create or replace function public.complete_investment_refund_v28(
  p_refund_request_id uuid,
  p_admin_notes text default null
)
returns public.investment_refund_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.investment_refund_requests;
  v_investment public.investments;
begin
  if not public.is_secured_landing_admin() then
    raise exception 'Administrator access required';
  end if;

  select *
  into v_request
  from public.investment_refund_requests
  where id = p_refund_request_id
  for update;

  if not found then
    raise exception 'Refund request not found';
  end if;

  if v_request.status in ('completed', 'rejected', 'cancelled') then
    raise exception 'Refund request is already final';
  end if;

  select *
  into v_investment
  from public.investments
  where id = v_request.investment_id
  for update;

  update public.investor_wallets
  set
    available_balance = available_balance + v_investment.amount,
    invested_balance = greatest(invested_balance - v_investment.amount, 0),
    principal_returned = coalesce(principal_returned, 0) + v_investment.amount,
    updated_at = now()
  where user_id = v_investment.investor_id;

  if not found then
    raise exception 'Investor wallet was not found';
  end if;

  insert into public.wallet_transactions (
    user_id,
    transaction_type,
    amount,
    loan_id,
    status,
    description
  )
  values (
    v_investment.investor_id,
    'investment_refund',
    v_investment.amount,
    v_investment.loan_id,
    'completed',
    'Investment principal returned during the 7-day investor protection period.'
  );

  update public.investments
  set
    status = 'refunded',
    refunded_at = now(),
    refund_processed_at = now(),
    updated_at = now()
  where id = v_investment.id;

  update public.investment_refund_requests
  set
    status = 'completed',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    admin_notes = nullif(trim(p_admin_notes), ''),
    processed_at = now(),
    updated_at = now()
  where id = v_request.id
  returning * into v_request;

  insert into public.investor_notifications (
    user_id,
    investment_id,
    title,
    message,
    notification_type
  )
  values (
    v_investment.investor_id,
    v_investment.id,
    'Investment refunded',
    'Your investment principal has been returned to available cash.',
    'refund_completed'
  );

  perform public.refresh_loan_funding_totals(v_investment.loan_id);

  return v_request;
end;
$$;

grant execute on function public.complete_investment_refund_v28(uuid, text)
to authenticated;

-- Expire old protection windows and mark funds settled.
create or replace function public.settle_expired_investments_v28()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select id, loan_id, investor_id
    from public.investments
    where status = 'protection_period'
      and refund_deadline <= now()
    for update skip locked
  loop
    update public.investments
    set
      status = 'settled',
      settled_at = now(),
      updated_at = now()
    where id = r.id;

    insert into public.investor_notifications (
      user_id,
      investment_id,
      title,
      message,
      notification_type
    )
    values (
      r.investor_id,
      r.id,
      'Investment is now final',
      'The 7-day investor refund period has expired.',
      'protection_expired'
    );

    perform public.refresh_loan_funding_totals(r.loan_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Borrower-disbursable funds exclude protection-period and refund-pending money.
create or replace view public.loan_disbursement_availability as
select
  ml.loan_application_id as loan_id,
  ml.loan_number,
  coalesce(sum(i.amount) filter (
    where i.status in ('settled', 'active')
  ), 0) as available_for_disbursement,
  coalesce(sum(i.amount) filter (
    where i.status in ('protection_period', 'refund_requested', 'refund_processing')
  ), 0) as protected_funds
from public.marketplace_loans ml
left join public.investments i
  on i.loan_id = ml.loan_application_id
group by ml.loan_application_id, ml.loan_number;

-- RLS
alter table public.investment_refund_requests enable row level security;
alter table public.investment_audit_events enable row level security;
alter table public.investor_notifications enable row level security;

drop policy if exists "Investors view own refund requests"
on public.investment_refund_requests;

create policy "Investors view own refund requests"
on public.investment_refund_requests
for select to authenticated
using (
  investor_id = auth.uid()
  or public.is_secured_landing_admin()
);

drop policy if exists "Admins manage refund requests"
on public.investment_refund_requests;

create policy "Admins manage refund requests"
on public.investment_refund_requests
for all to authenticated
using (public.is_secured_landing_admin())
with check (public.is_secured_landing_admin());

drop policy if exists "Investors view own audit events"
on public.investment_audit_events;

create policy "Investors view own audit events"
on public.investment_audit_events
for select to authenticated
using (
  public.is_secured_landing_admin()
  or exists (
    select 1
    from public.investments i
    where i.id = investment_audit_events.investment_id
      and i.investor_id = auth.uid()
  )
);

drop policy if exists "Investors view own notifications"
on public.investor_notifications;

create policy "Investors view own notifications"
on public.investor_notifications
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_secured_landing_admin()
);

notify pgrst, 'reload schema';
commit;
