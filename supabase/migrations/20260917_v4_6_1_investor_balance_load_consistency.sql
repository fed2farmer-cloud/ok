-- SecuredLanding v4.6.1 - Investor balance/load consistency
-- 2026-09-17
--
-- Goals:
--   * One ownership rule everywhere: current_owner_id wins; investor_id is the
--     fallback only when current_owner_id is null.
--   * investor_wallets.invested_balance is a cache derived from certificate
--     ownership/current principal, never independently incremented.
--   * NMI/card finalization creates the investment once, recalculates the wallet,
--     and immediately syncs investor_positions.
--   * Repayment/servicing changes to investor_positions refresh the cached wallet.

begin;

create or replace function public.recalculate_investor_wallet_balance(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invested numeric := 0;
begin
  if p_user_id is null then
    return;
  end if;

  select coalesce(sum(
    case
      when lower(coalesce(i.status, '')) in (
        'active', 'settled', 'funded', 'completed',
        'protection_period', 'refund_requested', 'refund_processing'
      ) then coalesce(pos.current_principal, i.amount, 0)
      else 0
    end
  ), 0)
  into v_invested
  from public.investments i
  left join public.investor_positions pos
    on pos.investment_id = i.id
   and pos.investor_user_id = p_user_id
   and lower(coalesce(pos.status, 'active')) = 'active'
  where coalesce(i.current_owner_id, i.investor_id) = p_user_id;

  insert into public.investor_wallets(
    user_id, available_balance, invested_balance, updated_at
  )
  values(p_user_id, 0, v_invested, now())
  on conflict(user_id) do update
    set invested_balance = excluded.invested_balance,
        updated_at = now();
end;
$$;

revoke all on function public.recalculate_investor_wallet_balance(uuid) from public;
grant execute on function public.recalculate_investor_wallet_balance(uuid) to authenticated;

-- Any principal/owner/status change in the servicing projection should update the
-- wallet cache. This keeps repayment and secondary-market ownership changes from
-- leaving the marketplace header stale.
create or replace function public.refresh_wallet_after_investor_position_change_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_user uuid;
  v_old_user uuid;
begin
  if tg_op <> 'DELETE' then
    v_new_user := new.investor_user_id;
  end if;
  if tg_op <> 'INSERT' then
    v_old_user := old.investor_user_id;
  end if;

  if v_old_user is not null and (v_new_user is null or v_old_user is distinct from v_new_user) then
    perform public.recalculate_investor_wallet_balance(v_old_user);
  end if;
  if v_new_user is not null then
    perform public.recalculate_investor_wallet_balance(v_new_user);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists investor_positions_refresh_wallet_v1 on public.investor_positions;
create trigger investor_positions_refresh_wallet_v1
after insert or delete or update of investor_user_id, current_principal, status
on public.investor_positions
for each row execute function public.refresh_wallet_after_investor_position_change_v1();

-- Keep the live NMI finalizer aligned with the canonical accounting rule. It must
-- NOT add the investment amount directly to invested_balance; the ledger is the
-- source of truth and the cache is recalculated after the certificate is created.
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
  wt_id uuid;
  w numeric := greatest(coalesce(p_wallet_amount,0),0);
  ext numeric;
  txn text := nullif(btrim(p_processor_transaction_id),'');
begin
  if u is null then raise exception 'Authentication required'; end if;
  if p_total_amount is null or p_total_amount < 100 then raise exception 'Minimum investment is $100'; end if;
  if w > p_total_amount then raise exception 'Wallet amount exceeds total'; end if;

  ext := p_total_amount - w;
  if ext <= 0 then raise exception 'External amount required'; end if;
  if txn is null then raise exception 'Processor transaction ID required'; end if;

  select x.* into old_i
  from public.nmi_payment_transactions n
  join public.investments x on x.id=n.investment_id
  where n.nmi_transaction_id=txn and n.user_id=u
  limit 1;
  if found then return old_i; end if;

  select * into m
  from public.marketplace_loans
  where loan_number=p_loan_number and coalesce(published,true)=true
  for update;
  if not found then raise exception 'Marketplace loan % not found',p_loan_number; end if;

  if p_total_amount > coalesce(m.amount_remaining,m.funding_goal,m.loan_amount,0) then
    raise exception 'Investment exceeds remaining funding amount';
  end if;

  insert into public.investor_wallets(user_id,available_balance,invested_balance,updated_at)
  values(u,0,0,now())
  on conflict(user_id) do nothing;

  if w > 0 then
    update public.investor_wallets
    set available_balance=available_balance-w, updated_at=now()
    where user_id=u and available_balance>=w;
    if not found then raise exception 'Insufficient available cash'; end if;
  end if;

  insert into public.investments(
    loan_id, loan_application_id, investor_id, amount,
    investor_interest_rate, borrower_interest_rate, company_spread_rate,
    term_months, status, updated_at
  ) values(
    m.loan_application_id, m.loan_application_id, u, p_total_amount,
    m.investor_interest_rate, m.borrower_interest_rate, m.company_spread_rate,
    m.repayment_term_months, 'active', now()
  ) returning * into i;

  perform public.recalculate_investor_wallet_balance(u);
  perform public.sync_investor_positions_for_loan_v1(p_loan_number);

  insert into public.wallet_transactions(
    user_id, transaction_type, amount, loan_id, status, description, idempotency_key
  ) values(
    u, 'Investment', -p_total_amount, m.loan_application_id, 'completed',
    'Card investment funded via NMI for Loan #' || p_loan_number || '.',
    'nmi-investment-' || i.id
  ) returning id into wt_id;

  insert into public.nmi_payment_transactions(
    user_id, nmi_transaction_id, transaction_kind, gross_amount,
    fee_amount, reserve_amount, net_amount, processor_status,
    response_text, credited_at, investment_id, wallet_transaction_id,
    created_at, updated_at
  ) values(
    u, txn, 'investment', ext, 0, 0, ext, 'approved',
    'Investment for Loan #' || p_loan_number,
    now(), i.id, wt_id, now(), now()
  );

  perform public.refresh_loan_funding_totals(p_loan_number);
  return i;
end;
$$;

revoke all on function public.finalize_external_investment_v1(bigint,numeric,numeric,text) from public;
grant execute on function public.finalize_external_investment_v1(bigint,numeric,numeric,text) to authenticated;

-- Repair every existing active certificate projection first, then recalculate all
-- investor wallet caches. No user IDs or loan IDs are hard-coded.
do $$
declare
  r record;
begin
  for r in
    select distinct la.loan_number
    from public.loan_applications la
    join public.investments i on i.loan_application_id = la.id
    where la.loan_number is not null
      and lower(coalesce(i.status, '')) in ('active','settled','funded','completed')
  loop
    perform public.sync_investor_positions_for_loan_v1(r.loan_number);
  end loop;

  for r in
    select distinct user_id
    from (
      select user_id from public.investor_wallets
      union
      select coalesce(current_owner_id, investor_id) as user_id
      from public.investments
    ) users
    where user_id is not null
  loop
    perform public.recalculate_investor_wallet_balance(r.user_id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
