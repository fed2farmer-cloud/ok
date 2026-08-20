-- SecuredLanding v4.2.1 - verified live NMI investment pipeline baseline
-- Consolidates the database repairs proven during live testing on 2026-08-20.
-- Safe to rerun. Does not create test investments or replay processor charges.

begin;

alter table public.nmi_payment_transactions
  add column if not exists investment_id bigint;

create unique index if not exists nmi_payment_transactions_transaction_id_uidx
  on public.nmi_payment_transactions(nmi_transaction_id)
  where nmi_transaction_id is not null;

-- Required by ON CONFLICT(user_id) in older compatibility paths and useful
-- as a wallet integrity guard. Creation is safe only when user_id is unique;
-- current production data was verified with zero duplicates before this repair.
create unique index if not exists investor_wallets_user_id_uidx
  on public.investor_wallets(user_id);

create or replace function public.refresh_loan_funding_totals(
  p_loan_number bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan_id bigint;
  v_loan_amount numeric := 0;
  v_funded numeric := 0;
begin
  select
    id,
    coalesce(approved_loan_amount, loan_amount, requested_loan_amount, 0)
  into
    v_loan_id,
    v_loan_amount
  from public.loan_applications
  where loan_number = p_loan_number
  limit 1;

  if v_loan_id is null then
    raise exception 'Loan number % not found', p_loan_number;
  end if;

  select coalesce(sum(i.amount), 0)
  into v_funded
  from public.investments i
  where (i.loan_id = v_loan_id or i.loan_application_id = v_loan_id)
    and coalesce(i.status, 'active') not in
      ('refunded', 'cancelled', 'canceled', 'failed');

  update public.loan_applications
  set
    amount_funded = v_funded,
    amount_remaining = greatest(v_loan_amount - v_funded, 0)
  where id = v_loan_id;

  update public.marketplace_loans
  set
    amount_funded = v_funded,
    amount_remaining = greatest(v_loan_amount - v_funded, 0)
  where loan_number = p_loan_number;
end;
$$;

revoke all on function public.refresh_loan_funding_totals(bigint) from public;
grant execute on function public.refresh_loan_funding_totals(bigint) to authenticated;

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
  u uuid := auth.uid();
  m public.marketplace_loans;
  i public.investments;
  old_i public.investments;
  w numeric := greatest(coalesce(p_wallet_amount, 0), 0);
  ext numeric;
  txn text := nullif(btrim(p_processor_transaction_id), '');
begin
  if u is null then raise exception 'Authentication required'; end if;
  if p_total_amount is null or p_total_amount < 100 then raise exception 'Minimum investment is $100'; end if;
  if w > p_total_amount then raise exception 'Wallet amount exceeds total'; end if;

  ext := p_total_amount - w;
  if ext <= 0 then raise exception 'External amount required'; end if;
  if txn is null then raise exception 'Processor transaction ID required'; end if;

  -- Idempotency: never create a second certificate for the same approved NMI transaction.
  select x.* into old_i
  from public.nmi_payment_transactions n
  join public.investments x on x.id = n.investment_id
  where n.nmi_transaction_id = txn
    and n.user_id = u
  limit 1;

  if found then return old_i; end if;

  select * into m
  from public.marketplace_loans
  where loan_number = p_loan_number
    and coalesce(published, true) = true
  for update;

  if not found then
    raise exception 'Marketplace loan % not found', p_loan_number;
  end if;

  if p_total_amount > coalesce(m.amount_remaining, m.funding_goal, m.loan_amount, 0) then
    raise exception 'Investment exceeds remaining funding amount';
  end if;

  if w > 0 then
    update public.investor_wallets
    set available_balance = available_balance - w,
        updated_at = now()
    where user_id = u
      and available_balance >= w;

    if not found then
      raise exception 'Insufficient available cash';
    end if;

    insert into public.wallet_transactions(
      user_id, transaction_type, amount, loan_id, status, description
    ) values (
      u, 'investment', -w, m.loan_application_id, 'completed',
      'Wallet portion for Loan #' || p_loan_number::text
    );
  end if;

  insert into public.investments(
    loan_id,
    loan_application_id,
    investor_id,
    amount,
    investor_interest_rate,
    borrower_interest_rate,
    company_spread_rate,
    term_months,
    status,
    updated_at
  ) values (
    m.loan_application_id,
    m.loan_application_id,
    u,
    p_total_amount,
    m.investor_interest_rate,
    m.borrower_interest_rate,
    m.company_spread_rate,
    m.repayment_term_months,
    'active',
    now()
  )
  returning * into i;

  -- Do NOT increment invested_balance here. The investments trigger installed in
  -- the servicing baseline recalculates wallet invested_balance from active
  -- certificate ownership and prevents double-counting.

  insert into public.nmi_payment_transactions(
    user_id,
    nmi_transaction_id,
    transaction_kind,
    gross_amount,
    fee_amount,
    reserve_amount,
    net_amount,
    processor_status,
    response_text,
    credited_at,
    investment_id,
    created_at,
    updated_at
  ) values (
    u,
    txn,
    'investment',
    ext,
    0,
    0,
    ext,
    'approved',
    'Investment for Loan #' || p_loan_number::text,
    now(),
    i.id,
    now(),
    now()
  );

  perform public.refresh_loan_funding_totals(p_loan_number);
  return i;
end;
$$;

revoke all on function public.finalize_external_investment_v1(bigint,numeric,numeric,text) from public;
grant execute on function public.finalize_external_investment_v1(bigint,numeric,numeric,text) to authenticated;

notify pgrst, 'reload schema';
commit;

-- Read-only verification helpers:
-- select p.proname, pg_get_function_identity_arguments(p.oid)
-- from pg_proc p join pg_namespace n on n.oid=p.pronamespace
-- where n.nspname='public' and p.proname in
-- ('finalize_external_investment_v1','refresh_loan_funding_totals');
