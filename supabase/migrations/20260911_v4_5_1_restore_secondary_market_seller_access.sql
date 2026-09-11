-- SecuredLanding v4.5.1
-- Restore read-side RLS and seller cancellation access for the secondary market.
-- Non-destructive: no investment, wallet, listing, or trade rows are rewritten.

begin;

alter table public.investor_positions enable row level security;
alter table public.secondary_market_listings_v2 enable row level security;
alter table public.secondary_market_trades_v2 enable row level security;
alter table public.secondary_market_cash_ledger_v2 enable row level security;

-- Investor Wallet needs to read the signed-in owner's active position in order
-- to show current principal. The listing RPC still performs the authoritative
-- ownership/position checks before a listing can be created.
drop policy if exists "Investors can view own positions" on public.investor_positions;
create policy "Investors can view own positions"
on public.investor_positions
for select
to authenticated
using (
  investor_user_id = (select auth.uid())
  or public.is_secured_landing_admin()
);

-- Open listings must be readable through the security-invoker marketplace view,
-- and sellers/buyers must be able to read their own historical/current listing.
drop policy if exists "View open secondary listings v2" on public.secondary_market_listings_v2;
create policy "View open secondary listings v2"
on public.secondary_market_listings_v2
for select
to authenticated
using (
  status = 'open'
  or seller_user_id = (select auth.uid())
  or buyer_user_id = (select auth.uid())
  or public.is_secured_landing_admin()
);

drop policy if exists "View own secondary trades v2" on public.secondary_market_trades_v2;
create policy "View own secondary trades v2"
on public.secondary_market_trades_v2
for select
to authenticated
using (
  seller_user_id = (select auth.uid())
  or buyer_user_id = (select auth.uid())
  or public.is_secured_landing_admin()
);

drop policy if exists "View own secondary cash ledger v2" on public.secondary_market_cash_ledger_v2;
create policy "View own secondary cash ledger v2"
on public.secondary_market_cash_ledger_v2
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_secured_landing_admin()
);

-- Restore seller cancellation/manage-listing RPC that existed in the v4.4
-- migration but is absent from the current production schema.
create or replace function public.cancel_secondary_listing_v2(p_listing_id uuid)
returns public.secondary_market_listings_v2
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.secondary_market_listings_v2;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  update public.secondary_market_listings_v2
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where id = p_listing_id
    and status = 'open'
    and (seller_user_id = v_user or public.is_secured_landing_admin())
  returning * into v_row;

  if not found then
    raise exception 'Open listing not found or not owned by current user';
  end if;

  return v_row;
end;
$$;

revoke all on function public.cancel_secondary_listing_v2(uuid) from public;
grant execute on function public.cancel_secondary_listing_v2(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
