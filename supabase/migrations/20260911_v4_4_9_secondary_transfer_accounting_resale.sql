-- SecuredLanding v4.4.9
-- Secondary transfer accounting, canonical public loan numbers and resale access.
-- Safe to rerun. Existing trades and ownership history are preserved.

begin;

alter table public.wallet_transactions
  add column if not exists investment_id bigint,
  add column if not exists idempotency_key text;

create unique index if not exists wallet_transactions_user_idempotency_uidx
  on public.wallet_transactions(user_id, idempotency_key)
  where idempotency_key is not null;

-- Repair zero/legacy loan numbers from the investment's canonical application.
update public.investor_positions p
set loan_number = la.loan_number
from public.investments i
join public.loan_applications la
  on la.id = coalesce(i.loan_application_id, i.loan_id)
where p.investment_id = i.id
  and la.loan_number is not null
  and coalesce(p.loan_number, 0) is distinct from la.loan_number;

update public.secondary_market_listings_v2 l
set loan_number = la.loan_number,
    updated_at = now()
from public.investments i
join public.loan_applications la
  on la.id = coalesce(i.loan_application_id, i.loan_id)
where l.investment_id = i.id
  and la.loan_number is not null
  and coalesce(l.loan_number, 0) is distinct from la.loan_number;

create or replace function public.reconcile_investor_invested_balance_v1(
  p_user_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(14,2);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if auth.uid() <> p_user_id and not public.is_secured_landing_admin() then
    raise exception 'Not authorized';
  end if;

  select coalesce(sum(p.current_principal), 0)::numeric(14,2)
  into v_total
  from public.investor_positions p
  join public.investments i on i.id = p.investment_id
  where p.investor_user_id = p_user_id
    and p.status = 'active'
    and coalesce(i.current_owner_id, i.investor_id) = p_user_id;

  update public.investor_wallets
  set invested_balance = v_total, updated_at = now()
  where user_id = p_user_id;

  return v_total;
end;
$$;

revoke all on function public.reconcile_investor_invested_balance_v1(uuid) from public;
grant execute on function public.reconcile_investor_invested_balance_v1(uuid) to authenticated;

create or replace function public.create_secondary_listing_v2(
  p_investment_id bigint,
  p_asking_price numeric
)
returns public.secondary_market_listings_v2
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_investment public.investments%rowtype;
  v_position public.investor_positions%rowtype;
  v_loan_number bigint;
  v_row public.secondary_market_listings_v2;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_asking_price is null or p_asking_price <= 0 then
    raise exception 'Asking price must be greater than $0';
  end if;

  select * into v_investment
  from public.investments
  where id = p_investment_id
  for update;
  if not found then raise exception 'Investment not found'; end if;

  if coalesce(v_investment.current_owner_id, v_investment.investor_id) <> v_user then
    raise exception 'Only the current certificate owner may list this investment';
  end if;
  if coalesce(v_investment.transfer_locked, false) then
    raise exception 'This certificate is currently transfer locked';
  end if;

  select * into v_position
  from public.investor_positions
  where investment_id = p_investment_id
    and investor_user_id = v_user
    and status = 'active'
  for update;
  if not found then raise exception 'Active investor position not found'; end if;
  if coalesce(v_position.current_principal, 0) <= 0 then
    raise exception 'No outstanding principal remains';
  end if;

  select la.loan_number into v_loan_number
  from public.loan_applications la
  where la.id = coalesce(v_investment.loan_application_id, v_investment.loan_id)
  limit 1;
  if coalesce(v_loan_number, 0) <= 0 then
    v_loan_number := nullif(substring(v_investment.certificate_number from '^SLI-[0-9]{4}-([0-9]+)-'), '')::bigint;
  end if;
  if coalesce(v_loan_number, 0) <= 0 then raise exception 'Public loan number could not be resolved'; end if;

  if exists (
    select 1 from public.secondary_market_listings_v2
    where investment_id = p_investment_id and status = 'open'
  ) then raise exception 'This certificate already has an open listing'; end if;

  insert into public.secondary_market_listings_v2(
    investment_id, certificate_number, loan_number, seller_user_id,
    original_principal, current_principal, asking_price
  ) values (
    v_investment.id, v_investment.certificate_number, v_loan_number, v_user,
    v_position.original_principal, v_position.current_principal, round(p_asking_price, 2)
  ) returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_secondary_listing_v2(bigint,numeric) from public;
grant execute on function public.create_secondary_listing_v2(bigint,numeric) to authenticated;

create or replace function public.secondary_market_settle(
  p_listing_id uuid,
  p_buyer_id uuid,
  p_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.secondary_market_listings_v2%rowtype;
  inv public.investments%rowtype;
  existing_trade public.secondary_market_trades_v2%rowtype;
  trade_id uuid;
  price numeric(14,2);
  principal numeric(14,2);
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if auth.uid() <> p_buyer_id then raise exception 'Buyer identity does not match signed-in user'; end if;
  if p_key is null or length(trim(p_key)) < 8 then raise exception 'A valid purchase key is required'; end if;

  select * into existing_trade
  from public.secondary_market_trades_v2
  where metadata->>'idempotency_key' = p_key
  limit 1;
  if found then
    return jsonb_build_object('success', true, 'already_processed', true,
      'trade_id', existing_trade.id, 'certificate_number', existing_trade.certificate_number,
      'purchase_price', existing_trade.sale_price);
  end if;

  select * into l from public.secondary_market_listings_v2
  where id = p_listing_id for update;
  if not found then raise exception 'Certificate listing not found'; end if;
  if l.status <> 'open' then raise exception 'This certificate is no longer available'; end if;
  if l.seller_user_id = p_buyer_id then raise exception 'You cannot purchase your own certificate'; end if;

  price := round(l.asking_price, 2);
  principal := round(l.current_principal, 2);
  if price <= 0 or principal <= 0 then raise exception 'Invalid certificate amounts'; end if;

  select * into inv from public.investments where id = l.investment_id for update;
  if not found then raise exception 'Underlying investment was not found'; end if;
  if coalesce(inv.current_owner_id, inv.investor_id) <> l.seller_user_id then
    raise exception 'Seller no longer owns this certificate';
  end if;
  if coalesce(inv.transfer_locked, false) then raise exception 'This certificate is currently transfer locked'; end if;

  update public.investor_wallets
  set available_balance = coalesce(available_balance, 0) - price, updated_at = now()
  where user_id = p_buyer_id and coalesce(available_balance, 0) >= price;
  if not found then raise exception 'Insufficient wallet balance'; end if;

  insert into public.investor_wallets(user_id, available_balance, invested_balance, updated_at)
  values(l.seller_user_id, price, 0, now())
  on conflict(user_id) do update set
    available_balance = coalesce(public.investor_wallets.available_balance, 0) + price,
    updated_at = now();

  update public.investments
  set current_owner_id = p_buyer_id, transfer_count = coalesce(transfer_count, 0) + 1
  where id = l.investment_id;

  update public.investor_positions
  set investor_user_id = p_buyer_id, source = 'secondary'
  where investment_id = l.investment_id and status = 'active';
  if not found then raise exception 'Active investor position was not found'; end if;

  insert into public.secondary_market_trades_v2(
    listing_id, investment_id, certificate_number, loan_number, seller_user_id,
    buyer_user_id, principal_transferred, sale_price, metadata
  ) values (
    l.id, l.investment_id, l.certificate_number, l.loan_number, l.seller_user_id,
    p_buyer_id, principal, price,
    jsonb_build_object('idempotency_key', p_key, 'payment_method', 'wallet')
  ) returning id into trade_id;

  insert into public.investment_ownership_history(
    investment_id, certificate_number, from_owner_id, to_owner_id, transfer_type,
    purchase_price, principal_transferred, transfer_status, metadata
  ) values (
    l.investment_id, l.certificate_number, l.seller_user_id, p_buyer_id,
    'secondary_sale', price, principal, 'completed',
    jsonb_build_object('trade_id', trade_id, 'listing_id', l.id, 'idempotency_key', p_key)
  );

  insert into public.secondary_market_cash_ledger_v2(trade_id,user_id,entry_type,amount)
  values
    (trade_id, p_buyer_id, 'buyer_debit', price),
    (trade_id, l.seller_user_id, 'seller_credit', price);

  insert into public.wallet_transactions(
    user_id, transaction_type, amount, loan_id, status, description,
    investment_id, idempotency_key
  ) values
    (p_buyer_id, 'secondary_purchase', -price, coalesce(inv.loan_application_id, inv.loan_id),
      'completed', 'Secondary certificate purchase ' || l.certificate_number,
      l.investment_id, p_key || ':buyer'),
    (l.seller_user_id, 'secondary_sale', price, coalesce(inv.loan_application_id, inv.loan_id),
      'completed', 'Secondary certificate sale ' || l.certificate_number,
      l.investment_id, p_key || ':seller');

  update public.secondary_market_listings_v2
  set status = 'sold', buyer_user_id = p_buyer_id, sold_at = now(), updated_at = now()
  where id = l.id;

  perform public.reconcile_investor_invested_balance_v1(p_buyer_id);
  update public.investor_wallets w
  set invested_balance = (
        select coalesce(sum(p.current_principal), 0)::numeric(14,2)
        from public.investor_positions p
        join public.investments owned on owned.id = p.investment_id
        where p.investor_user_id = l.seller_user_id
          and p.status = 'active'
          and coalesce(owned.current_owner_id, owned.investor_id) = l.seller_user_id
      ),
      updated_at = now()
  where w.user_id = l.seller_user_id;

  return jsonb_build_object(
    'success', true, 'trade_id', trade_id, 'listing_id', l.id,
    'investment_id', l.investment_id, 'certificate_number', l.certificate_number,
    'loan_number', l.loan_number, 'purchase_price', price,
    'principal_transferred', principal, 'seller_user_id', l.seller_user_id,
    'buyer_user_id', p_buyer_id, 'status', 'completed'
  );
end;
$$;

revoke all on function public.secondary_market_settle(uuid,uuid,text) from public;
grant execute on function public.secondary_market_settle(uuid,uuid,text) to authenticated;

create or replace view public.secondary_market_open_v2
with (security_invoker = true) as
select
  l.id, l.investment_id, l.certificate_number,
  l.loan_number,
  l.loan_number as public_loan_number,
  l.seller_user_id, l.original_principal, l.current_principal,
  l.asking_price, l.listed_at,
  round((1-l.asking_price/nullif(l.original_principal,0))*100,2) as discount_to_original_percent,
  round((1-l.asking_price/nullif(l.current_principal,0))*100,2) as discount_to_current_principal_percent
from public.secondary_market_listings_v2 l
where l.status = 'open';

grant select on public.secondary_market_open_v2 to authenticated;
notify pgrst, 'reload schema';
commit;
