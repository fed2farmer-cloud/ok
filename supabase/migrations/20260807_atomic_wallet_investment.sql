-- Secured Landing: atomic wallet investment fix
-- Keeps the already-corrected historical wallet unchanged.
-- Future investments must use this RPC so wallet + investment accounting changes together.

begin;

alter table if exists public.investments add column if not exists idempotency_key text;
alter table if exists public.wallet_transactions add column if not exists investment_id bigint;
alter table if exists public.wallet_transactions add column if not exists idempotency_key text;

create unique index if not exists investments_idempotency_key_uidx
on public.investments(idempotency_key) where idempotency_key is not null;

create unique index if not exists wallet_transactions_idempotency_key_uidx
on public.wallet_transactions(idempotency_key) where idempotency_key is not null;

create or replace function public.invest_from_wallet_atomic(
  p_loan_id bigint,
  p_amount numeric,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_available numeric;
  v_invested numeric;
  v_investment_id bigint;
  v_existing_id bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount < 100 then raise exception 'Minimum investment is $100'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'Valid idempotency key required';
  end if;

  select id into v_existing_id
  from public.investments
  where investor_id=v_user and idempotency_key=p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('ok',true,'duplicate',true,'investment_id',v_existing_id);
  end if;

  select available_balance, invested_balance
  into v_available, v_invested
  from public.investor_wallets
  where user_id=v_user
  for update;

  if not found then raise exception 'Investor wallet not found'; end if;
  if coalesce(v_available,0) < p_amount then raise exception 'Insufficient available wallet balance'; end if;

  insert into public.investments(investor_id,loan_id,amount,status,idempotency_key,created_at)
  values(v_user,p_loan_id,p_amount,'protection_period',p_idempotency_key,now())
  returning id into v_investment_id;

  update public.investor_wallets
  set available_balance=coalesce(available_balance,0)-p_amount,
      invested_balance=coalesce(invested_balance,0)+p_amount
  where user_id=v_user;

  insert into public.wallet_transactions(
    user_id,amount,type,description,investment_id,idempotency_key,created_at
  ) values(
    v_user,-p_amount,'investment',
    'Wallet investment in loan '||p_loan_id::text,
    v_investment_id,p_idempotency_key,now()
  );

  update public.marketplace_loans
  set amount_funded=coalesce(amount_funded,0)+p_amount,
      amount_remaining=greatest(coalesce(amount_remaining,0)-p_amount,0),
      status=case when greatest(coalesce(amount_remaining,0)-p_amount,0)=0 then 'Funded' else status end,
      updated_at=now()
  where loan_number=p_loan_id or loan_application_id=p_loan_id;

  return jsonb_build_object(
    'ok',true,'duplicate',false,'investment_id',v_investment_id,
    'available_balance',coalesce(v_available,0)-p_amount,
    'invested_balance',coalesce(v_invested,0)+p_amount
  );
end;
$$;

revoke all on function public.invest_from_wallet_atomic(bigint,numeric,text) from public;
grant execute on function public.invest_from_wallet_atomic(bigint,numeric,text) to authenticated;

commit;
