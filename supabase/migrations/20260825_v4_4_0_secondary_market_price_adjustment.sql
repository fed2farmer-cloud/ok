-- SecuredLanding v4.4.0
-- Secondary market listing-price adjustment + certificate ownership transfer.
-- Non-destructive: adds v2 tables/functions and does not rewrite prior secondary-market history.

begin;
create extension if not exists pgcrypto;

create table if not exists public.secondary_market_listings_v2 (
  id uuid primary key default gen_random_uuid(),
  investment_id bigint not null references public.investments(id),
  certificate_number text not null,
  loan_number bigint not null,
  seller_user_id uuid not null,
  original_principal numeric(14,2) not null,
  current_principal numeric(14,2) not null,
  asking_price numeric(14,2) not null check (asking_price > 0),
  status text not null default 'open' check (status in ('open','sold','cancelled')),
  buyer_user_id uuid,
  listed_at timestamptz not null default now(),
  sold_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists secondary_market_one_open_listing_per_investment_v2
on public.secondary_market_listings_v2(investment_id)
where status='open';

create index if not exists secondary_market_open_listings_v2_idx
on public.secondary_market_listings_v2(status, listed_at desc);

create table if not exists public.secondary_market_trades_v2 (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.secondary_market_listings_v2(id),
  investment_id bigint not null references public.investments(id),
  certificate_number text not null,
  loan_number bigint not null,
  seller_user_id uuid not null,
  buyer_user_id uuid not null,
  principal_transferred numeric(14,2) not null,
  sale_price numeric(14,2) not null,
  completed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.secondary_market_cash_ledger_v2 (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.secondary_market_trades_v2(id),
  user_id uuid not null,
  entry_type text not null check (entry_type in ('buyer_debit','seller_credit')),
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.secondary_market_listings_v2 enable row level security;
alter table public.secondary_market_trades_v2 enable row level security;
alter table public.secondary_market_cash_ledger_v2 enable row level security;

drop policy if exists "View open secondary listings v2" on public.secondary_market_listings_v2;
create policy "View open secondary listings v2"
on public.secondary_market_listings_v2 for select to authenticated
using (status='open' or seller_user_id=auth.uid() or buyer_user_id=auth.uid() or public.is_secured_landing_admin());

drop policy if exists "View own secondary trades v2" on public.secondary_market_trades_v2;
create policy "View own secondary trades v2"
on public.secondary_market_trades_v2 for select to authenticated
using (seller_user_id=auth.uid() or buyer_user_id=auth.uid() or public.is_secured_landing_admin());

drop policy if exists "View own secondary cash ledger v2" on public.secondary_market_cash_ledger_v2;
create policy "View own secondary cash ledger v2"
on public.secondary_market_cash_ledger_v2 for select to authenticated
using (user_id=auth.uid() or public.is_secured_landing_admin());

create or replace function public.current_certificate_owner_v2(p_investment_id bigint)
returns uuid
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(
    (
      select h.to_owner_id
      from public.investment_ownership_history h
      join public.investments i on i.id=h.investment_id
      where h.investment_id=p_investment_id
        and h.certificate_number=i.certificate_number
        and h.transfer_status='completed'
      order by h.transferred_at desc, h.created_at desc
      limit 1
    ),
    (select coalesce(i.current_owner_id,i.investor_id) from public.investments i where i.id=p_investment_id)
  );
$$;

grant execute on function public.current_certificate_owner_v2(bigint) to authenticated;

create or replace function public.create_secondary_listing_v2(
  p_investment_id bigint,
  p_asking_price numeric
)
returns public.secondary_market_listings_v2
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_investment public.investments%rowtype;
  v_position public.investor_positions%rowtype;
  v_owner uuid;
  v_row public.secondary_market_listings_v2;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_asking_price is null or p_asking_price<=0 then raise exception 'Asking price must be greater than $0'; end if;

  select * into v_investment from public.investments where id=p_investment_id for update;
  if not found then raise exception 'Investment not found'; end if;

  select * into v_position from public.investor_positions
  where investment_id=p_investment_id and status='active' for update;
  if not found then raise exception 'Active investor position not found'; end if;

  v_owner:=public.current_certificate_owner_v2(p_investment_id);
  if v_owner is distinct from v_user then raise exception 'Only the current certificate owner may list this investment'; end if;
  if v_investment.certificate_number is null then raise exception 'Loan Security Certificate is required'; end if;
  if coalesce(v_position.current_principal,0)<=0 then raise exception 'No outstanding principal remains'; end if;
  if exists(select 1 from public.secondary_market_listings_v2 where investment_id=p_investment_id and status='open') then
    raise exception 'This certificate already has an open listing';
  end if;

  insert into public.secondary_market_listings_v2(
    investment_id,certificate_number,loan_number,seller_user_id,
    original_principal,current_principal,asking_price
  ) values(
    v_investment.id,v_investment.certificate_number,v_position.loan_number,v_user,
    v_position.original_principal,v_position.current_principal,round(p_asking_price,2)
  ) returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_secondary_listing_v2(bigint,numeric) to authenticated;

create or replace function public.cancel_secondary_listing_v2(p_listing_id uuid)
returns public.secondary_market_listings_v2
language plpgsql
security definer
set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_row public.secondary_market_listings_v2;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  update public.secondary_market_listings_v2
  set status='cancelled',cancelled_at=now(),updated_at=now()
  where id=p_listing_id and status='open' and (seller_user_id=v_user or public.is_secured_landing_admin())
  returning * into v_row;
  if not found then raise exception 'Open listing not found or not owned by current user'; end if;
  return v_row;
end;
$$;

grant execute on function public.cancel_secondary_listing_v2(uuid) to authenticated;

create or replace function public.purchase_secondary_listing_v2(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_buyer uuid:=auth.uid();
  v_listing public.secondary_market_listings_v2%rowtype;
  v_owner uuid;
  v_trade public.secondary_market_trades_v2%rowtype;
  v_buyer_cash numeric:=0;
begin
  if v_buyer is null then raise exception 'Authentication required'; end if;

  select * into v_listing from public.secondary_market_listings_v2
  where id=p_listing_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if v_listing.status<>'open' then raise exception 'Listing is no longer open'; end if;
  if v_listing.seller_user_id=v_buyer then raise exception 'Seller cannot purchase own listing'; end if;

  v_owner:=public.current_certificate_owner_v2(v_listing.investment_id);
  if v_owner is distinct from v_listing.seller_user_id then raise exception 'Seller is no longer the current certificate owner'; end if;

  select coalesce(available_balance,0) into v_buyer_cash
  from public.investor_wallets where user_id=v_buyer for update;
  if coalesce(v_buyer_cash,0)<v_listing.asking_price then raise exception 'Insufficient wallet cash'; end if;

  insert into public.investor_wallets(user_id,available_balance,invested_balance,updated_at)
  values(v_listing.seller_user_id,v_listing.asking_price,0,now())
  on conflict(user_id) do update set
    available_balance=coalesce(public.investor_wallets.available_balance,0)+excluded.available_balance,
    invested_balance=greatest(coalesce(public.investor_wallets.invested_balance,0)-v_listing.current_principal,0),
    updated_at=now();

  update public.investor_wallets
  set available_balance=coalesce(available_balance,0)-v_listing.asking_price,
      invested_balance=coalesce(invested_balance,0)+v_listing.current_principal,
      updated_at=now()
  where user_id=v_buyer;

  update public.investments
  set current_owner_id=v_buyer,
      transfer_count=coalesce(transfer_count,0)+1
  where id=v_listing.investment_id;

  update public.investor_positions
  set investor_user_id=v_buyer,source='secondary'
  where investment_id=v_listing.investment_id and status='active';

  insert into public.investment_ownership_history(
    investment_id,certificate_number,from_owner_id,to_owner_id,
    transfer_type,principal_transferred,transfer_status,metadata
  ) values(
    v_listing.investment_id,v_listing.certificate_number,v_listing.seller_user_id,v_buyer,
    'secondary_sale',v_listing.current_principal,'completed',
    jsonb_build_object('listing_id',v_listing.id,'sale_price',v_listing.asking_price,'pricing_basis','seller_adjusted')
  );

  insert into public.secondary_market_trades_v2(
    listing_id,investment_id,certificate_number,loan_number,seller_user_id,buyer_user_id,
    principal_transferred,sale_price,metadata
  ) values(
    v_listing.id,v_listing.investment_id,v_listing.certificate_number,v_listing.loan_number,
    v_listing.seller_user_id,v_buyer,v_listing.current_principal,v_listing.asking_price,
    jsonb_build_object('original_principal',v_listing.original_principal,'discount_to_original',round((1-v_listing.asking_price/nullif(v_listing.original_principal,0))*100,2))
  ) returning * into v_trade;

  insert into public.secondary_market_cash_ledger_v2(trade_id,user_id,entry_type,amount)
  values
    (v_trade.id,v_buyer,'buyer_debit',v_listing.asking_price),
    (v_trade.id,v_listing.seller_user_id,'seller_credit',v_listing.asking_price);

  update public.secondary_market_listings_v2
  set status='sold',buyer_user_id=v_buyer,sold_at=now(),updated_at=now()
  where id=v_listing.id;

  return jsonb_build_object(
    'ok',true,'trade_id',v_trade.id,'investment_id',v_listing.investment_id,
    'certificate_number',v_listing.certificate_number,'sale_price',v_listing.asking_price,
    'principal_transferred',v_listing.current_principal,'new_owner_id',v_buyer
  );
end;
$$;

grant execute on function public.purchase_secondary_listing_v2(uuid) to authenticated;

create or replace view public.secondary_market_open_v2 as
select
  l.id,l.investment_id,l.certificate_number,l.loan_number,l.seller_user_id,
  l.original_principal,l.current_principal,l.asking_price,l.listed_at,
  round((1-l.asking_price/nullif(l.original_principal,0))*100,2) as discount_to_original_percent,
  round((1-l.asking_price/nullif(l.current_principal,0))*100,2) as discount_to_current_principal_percent
from public.secondary_market_listings_v2 l
where l.status='open';

grant select on public.secondary_market_open_v2 to authenticated;

notify pgrst,'reload schema';
commit;
