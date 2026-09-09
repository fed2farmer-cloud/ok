-- SecuredLanding - Investor Wallet + expired protection synchronization
-- 2026-09-09
--
-- Fixes two related issues:
--   1) expired 7-day protection-period investments could remain stuck in
--      investments.status='protection_period';
--   2) Investor Wallet previously hid every non-'active' owned certificate,
--      producing $13,545 / 5 positions while the portfolio correctly showed
--      $25,445 / 8 positions.
--
-- This migration is safe to rerun. The RPC settles only the signed-in user's
-- legitimately expired protection-period investments and keeps funding holds,
-- ledger release, investor positions, and loan totals synchronized.

begin;

-- Repair legacy protection rows that are missing one or both deadline fields.
update public.investments
set refund_deadline = coalesce(
      refund_deadline,
      protection_expires_at,
      created_at + (greatest(coalesce(refund_period_days, 7), 0) * interval '1 day')
    ),
    protection_expires_at = coalesce(
      protection_expires_at,
      refund_deadline,
      created_at + (greatest(coalesce(refund_period_days, 7), 0) * interval '1 day')
    ),
    updated_at = now()
where status = 'protection_period'
  and (refund_deadline is null or protection_expires_at is null);

create or replace function public.settle_my_expired_investments_v1()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  r record;
  h record;
  v_count integer := 0;
  v_loan_number bigint;
  v_tx uuid;
  v_protected uuid;
  v_disbursable uuid;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  for r in
    select
      i.id,
      coalesce(i.loan_application_id, i.loan_id) as loan_application_id,
      coalesce(i.current_owner_id, i.investor_id) as owner_user_id
    from public.investments i
    where lower(coalesce(i.status, '')) = 'protection_period'
      and coalesce(i.current_owner_id, i.investor_id) = v_user
      and coalesce(
            i.protection_expires_at,
            i.refund_deadline,
            i.created_at + (greatest(coalesce(i.refund_period_days, 7), 0) * interval '1 day')
          ) <= now()
    for update skip locked
  loop
    update public.investments
    set status = 'active',
        settled_at = coalesce(settled_at, now()),
        activated_at = coalesce(activated_at, now()),
        updated_at = now()
    where id = r.id
      and lower(coalesce(status, '')) = 'protection_period';

    -- Keep the v3.5 funding-hold ledger synchronized when a hold exists.
    -- The idempotency key prevents a duplicate ledger release on retries.
    for h in
      select *
      from public.funding_holds
      where investment_id = r.id
        and status = 'protected'
      for update
    loop
      v_protected := public.ensure_financial_account(
        'investor_protected_funds', h.investor_id, null, 'Investor Protected Funds'
      );
      v_disbursable := public.ensure_financial_account(
        'loan_disbursable_funds', null, h.loan_application_id, 'Loan Disbursable Funds'
      );

      insert into public.financial_ledger_transactions(
        idempotency_key,
        transaction_type,
        reference_type,
        reference_id,
        description,
        created_by,
        status
      ) values (
        'hold-release:' || h.id,
        'funding_hold_release',
        'funding_hold',
        h.id::text,
        'Investor protection period expired; funds eligible for borrower disbursement.',
        v_user,
        'pending'
      )
      on conflict(idempotency_key)
      do update set idempotency_key = excluded.idempotency_key
      returning id into v_tx;

      if not exists (
        select 1 from public.financial_ledger_entries where transaction_id = v_tx
      ) then
        insert into public.financial_ledger_entries(
          transaction_id, account_id, entry_side, amount, memo
        ) values
          (v_tx, v_disbursable, 'debit', h.amount, 'Eligible borrower funding'),
          (v_tx, v_protected, 'credit', h.amount, 'Release investor-protected funds');

        update public.financial_ledger_transactions
        set status = 'posted'
        where id = v_tx;
      end if;

      update public.funding_holds
      set status = 'released',
          released_at = coalesce(released_at, now()),
          release_transaction_id = coalesce(release_transaction_id, v_tx),
          updated_at = now()
      where id = h.id;
    end loop;

    select la.loan_number
    into v_loan_number
    from public.loan_applications la
    where la.id = r.loan_application_id
    limit 1;

    if v_loan_number is not null then
      -- Ensure a certificate-level servicing position exists now that the
      -- protection period is over, then refresh the public funding totals.
      perform public.sync_investor_positions_for_loan_v1(v_loan_number);
      perform public.refresh_loan_funding_totals(v_loan_number);
    end if;

    insert into public.investment_audit_events(
      investment_id,
      actor_user_id,
      event_key,
      description,
      after_state
    ) values (
      r.id,
      v_user,
      'protection_expired',
      'The investor refund period expired and the investment became active.',
      jsonb_build_object('status', 'active', 'activated_at', now())
    );

    insert into public.investor_notifications(
      user_id,
      investment_id,
      title,
      message,
      notification_type
    ) values (
      r.owner_user_id,
      r.id,
      'Investment is now active',
      'The 7-day protection period has expired. Your investment is now active.',
      'investment_activated'
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.settle_my_expired_investments_v1() from public;
grant execute on function public.settle_my_expired_investments_v1() to authenticated;

notify pgrst, 'reload schema';
commit;
