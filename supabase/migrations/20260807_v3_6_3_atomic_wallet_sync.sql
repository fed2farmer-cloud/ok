-- SecuredLanding v3.6.3 - atomic, idempotent wallet investment
-- Run this migration before deploying the matching frontend.
-- Historical balances are NOT rewritten by this migration.
begin;

alter table public.investments
  add column if not exists idempotency_key text;

alter table public.wallet_transactions
  add column if not exists investment_id bigint;

alter table public.wallet_transactions
  add column if not exists idempotency_key text;

create unique index if not exists investments_investor_idempotency_uidx
  on public.investments(investor_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists wallet_transactions_user_idempotency_uidx
  on public.wallet_transactions(user_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.invest_from_wallet_atomic_v1(
  p_loan_number bigint,
  p_amount numeric,
  p_idempotency_key text
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
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount < 100 then raise exception 'Minimum investment is $100'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'A valid idempotency key is required';
  end if;

  -- A repeated request returns the original investment without another debit.
  select * into v_investment
  from public.investments
  where investor_id = v_user_id and idempotency_key = p_idempotency_key
  limit 1;
  if found then return v_investment; end if;

  select * into v_marketplace
  from public.marketplace_loans
  where loan_number = p_loan_number and coalesce(published, true) = true
  for update;
  if not found then raise exception 'Marketplace loan % was not found', p_loan_number; end if;

  if p_amount > coalesce(v_marketplace.amount_remaining, v_marketplace.funding_goal, v_marketplace.loan_amount, 0)
  then raise exception 'Investment exceeds the remaining funding amount'; end if;

  select * into v_wallet
  from public.investor_wallets
  where user_id = v_user_id
  for update;
  if not found then raise exception 'Investor wallet was not found'; end if;
  if coalesce(v_wallet.available_balance, 0) < p_amount then raise exception 'Insufficient available cash'; end if;

  v_enabled := coalesce(v_marketplace.investor_refund_enabled, true);
  v_days := case when v_enabled then coalesce(v_marketplace.investor_refund_days, 7) else 0 end;

  insert into public.investments (
    loan_id, investor_id, amount, investor_interest_rate, borrower_interest_rate,
    company_spread_rate, term_months, status, refund_policy_enabled,
    refund_period_days, refund_deadline, idempotency_key, updated_at
  ) values (
    v_marketplace.loan_application_id, v_user_id, p_amount,
    v_marketplace.investor_interest_rate, v_marketplace.borrower_interest_rate,
    v_marketplace.company_spread_rate, v_marketplace.repayment_term_months,
    case when v_enabled and v_days > 0 then 'protection_period' else 'settled' end,
    v_enabled, v_days,
    case when v_enabled and v_days > 0 then now() + make_interval(days => v_days) else now() end,
    p_idempotency_key, now()
  ) returning * into v_investment;

  -- Wallet debit and invested balance update are in this same database transaction.
  update public.investor_wallets
  set available_balance = coalesce(available_balance, 0) - p_amount,
      invested_balance = coalesce(invested_balance, 0) + p_amount,
      updated_at = now()
  where user_id = v_user_id;

  insert into public.wallet_transactions (
    user_id, transaction_type, amount, loan_id, status, description,
    investment_id, idempotency_key
  ) values (
    v_user_id, 'investment', -p_amount, v_marketplace.loan_application_id,
    'completed', 'Investment funded from wallet for Loan #' || p_loan_number::text || '.',
    v_investment.id, p_idempotency_key
  );

  insert into public.investment_audit_events (
    investment_id, actor_user_id, event_key, description, after_state
  ) values (
    v_investment.id, v_user_id, 'investment_created',
    'Atomic wallet investment created and wallet debited.',
    jsonb_build_object('loan_id',v_marketplace.loan_application_id,'loan_number',p_loan_number,
      'amount',p_amount,'status',v_investment.status,'refund_deadline',v_investment.refund_deadline,
      'idempotency_key',p_idempotency_key)
  );

  insert into public.investor_notifications (
    user_id, investment_id, title, message, notification_type
  ) values (
    v_user_id, v_investment.id, 'Investment confirmed',
    case when v_enabled and v_days > 0
      then 'Your investment is protected by a ' || v_days::text || '-day investor refund period.'
      else 'Your investment is confirmed.' end,
    'investment_created'
  );

  perform public.refresh_loan_funding_totals(v_marketplace.loan_application_id);
  return v_investment;
end;
$$;

revoke all on function public.invest_from_wallet_atomic_v1(bigint,numeric,text) from public;
grant execute on function public.invest_from_wallet_atomic_v1(bigint,numeric,text) to authenticated;

notify pgrst, 'reload schema';
commit;
