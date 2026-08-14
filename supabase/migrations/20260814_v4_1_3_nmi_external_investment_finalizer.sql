-- SecuredLanding v4.1.3 - NMI external investment finalization
-- Install before deploying the matching frontend/API patch.
-- Adds processor-transaction idempotency and preserves the existing wallet-only RPC.
begin;

alter table public.nmi_payment_transactions
  add column if not exists investment_id bigint;

create unique index if not exists nmi_payment_transactions_transaction_id_uidx
  on public.nmi_payment_transactions(nmi_transaction_id)
  where nmi_transaction_id is not null;

-- Replace the old 3-argument finalizer so card/split finalization MUST carry
-- the processor transaction ID returned by the server-side NMI charge.
drop function if exists public.finalize_external_investment_v1(bigint,numeric,numeric);

create or replace function public.finalize_external_investment_v1(
  p_loan_number bigint,
  p_total_amount numeric,
  p_wallet_amount numeric,
  p_processor_transaction_id text
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
  v_existing public.investments;
  v_investment public.investments;
  v_wallet_use numeric := greatest(coalesce(p_wallet_amount,0),0);
  v_external_amount numeric;
  v_days integer := 7;
  v_enabled boolean := true;
  v_txn text := nullif(btrim(p_processor_transaction_id),'');
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_total_amount is null or p_total_amount < 100 then raise exception 'Minimum investment is $100'; end if;
  if v_wallet_use > p_total_amount then raise exception 'Wallet portion cannot exceed total investment'; end if;
  v_external_amount := p_total_amount - v_wallet_use;
  if v_external_amount <= 0 then raise exception 'External finalizer requires a card/external amount'; end if;
  if v_txn is null then raise exception 'Processor transaction ID is required'; end if;

  -- Retry safety: if this processor transaction was already finalized, return
  -- the investment linked in raw_reference instead of creating another one.
  select i.* into v_existing
  from public.nmi_payment_transactions npt
  join public.investments i
    on i.id = npt.investment_id
  where npt.nmi_transaction_id = v_txn
    and npt.user_id = v_user_id
  limit 1;
  if found then return v_existing; end if;

  select * into v_marketplace
  from public.marketplace_loans
  where loan_number = p_loan_number and coalesce(published,true)=true
  for update;
  if not found then raise exception 'Marketplace loan % was not found', p_loan_number; end if;

  if p_total_amount > coalesce(v_marketplace.amount_remaining,v_marketplace.funding_goal,v_marketplace.loan_amount,0)
  then raise exception 'Investment exceeds the remaining funding amount'; end if;

  if v_wallet_use > 0 then
    select * into v_wallet from public.investor_wallets where user_id=v_user_id for update;
    if not found then raise exception 'Investor wallet was not found'; end if;
    if coalesce(v_wallet.available_balance,0) < v_wallet_use then raise exception 'Insufficient available cash'; end if;
    update public.investor_wallets
      set available_balance=available_balance-v_wallet_use, updated_at=now()
      where user_id=v_user_id;
  end if;

  v_enabled := coalesce(v_marketplace.investor_refund_enabled,true);
  v_days := case when v_enabled then coalesce(v_marketplace.investor_refund_days,7) else 0 end;

  insert into public.investments(
    loan_id, investor_id, amount, investor_interest_rate, borrower_interest_rate,
    company_spread_rate, term_months, status, refund_policy_enabled,
    refund_period_days, refund_deadline, updated_at
  ) values (
    v_marketplace.loan_application_id, v_user_id, p_total_amount,
    v_marketplace.investor_interest_rate, v_marketplace.borrower_interest_rate,
    v_marketplace.company_spread_rate, v_marketplace.repayment_term_months,
    case when v_enabled and v_days>0 then 'protection_period' else 'settled' end,
    v_enabled, v_days,
    case when v_enabled and v_days>0 then now()+make_interval(days=>v_days) else now() end,
    now()
  ) returning * into v_investment;

  if v_wallet_use > 0 then
    insert into public.wallet_transactions(user_id,transaction_type,amount,loan_id,status,description)
    values(v_user_id,'investment',-v_wallet_use,v_marketplace.loan_application_id,'completed',
      'Wallet portion of split investment for Loan #'||p_loan_number::text||'.');
  end if;

  -- Record the processor approval once. This row is also the idempotency anchor.
  insert into public.nmi_payment_transactions(
    user_id, nmi_transaction_id, transaction_kind, gross_amount,
    fee_amount, reserve_amount, net_amount, processor_status,
    response_text, credited_at, investment_id, created_at, updated_at
  ) values (
    v_user_id, v_txn, 'investment', v_external_amount,
    0, 0, v_external_amount, 'approved',
    'External investment finalized for Loan #'||p_loan_number::text,
    now(), v_investment.id, now(), now()
  );

  perform public.refresh_loan_funding_totals(v_marketplace.loan_application_id);
  return v_investment;
exception
  when unique_violation then
    select i.* into v_existing
    from public.nmi_payment_transactions npt
    join public.investments i on i.id = npt.investment_id
    where npt.nmi_transaction_id = v_txn and npt.user_id = v_user_id
    limit 1;
    if found then return v_existing; end if;
    raise;
end;
$$;

revoke all on function public.finalize_external_investment_v1(bigint,numeric,numeric,text) from public;
grant execute on function public.finalize_external_investment_v1(bigint,numeric,numeric,text) to authenticated;

notify pgrst, 'reload schema';
commit;

-- Verification (read-only):
select p.proname, pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='finalize_external_investment_v1';
