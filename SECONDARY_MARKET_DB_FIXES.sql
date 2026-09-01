-- SecuredLanding secondary market V2 settlement + ownership visibility fixes
-- These statements were applied and verified during troubleshooting.

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
  l secondary_market_listings_v2%rowtype;
  inv investments%rowtype;
  buyer_wallet investor_wallets%rowtype;
  seller_wallet investor_wallets%rowtype;
  existing_trade secondary_market_trades_v2%rowtype;
  trade_id uuid;
  price numeric;
  principal numeric;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if auth.uid() <> p_buyer_id then
    raise exception 'Buyer identity does not match signed-in user.';
  end if;

  if p_key is null or trim(p_key) = '' then
    raise exception 'Purchase key is required.';
  end if;

  select *
  into existing_trade
  from secondary_market_trades_v2
  where metadata->>'idempotency_key' = p_key
  limit 1;

  if found then
    return jsonb_build_object(
      'success', true,
      'already_processed', true,
      'trade_id', existing_trade.id,
      'certificate_number', existing_trade.certificate_number,
      'purchase_price', existing_trade.sale_price
    );
  end if;

  select *
  into l
  from secondary_market_listings_v2
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Certificate listing not found.';
  end if;

  if l.status <> 'open' then
    raise exception 'This certificate is no longer available.';
  end if;

  if l.seller_user_id = p_buyer_id then
    raise exception 'You cannot purchase your own certificate.';
  end if;

  price := l.asking_price;
  principal := l.current_principal;

  if price is null or price <= 0 then
    raise exception 'Invalid certificate sale price.';
  end if;

  if principal is null or principal <= 0 then
    raise exception 'Invalid certificate principal.';
  end if;

  select *
  into inv
  from investments
  where id = l.investment_id
  for update;

  if not found then
    raise exception 'Underlying investment was not found.';
  end if;

  if inv.current_owner_id <> l.seller_user_id then
    raise exception 'Seller no longer owns this certificate.';
  end if;

  if coalesce(inv.transfer_locked, false) then
    raise exception 'This certificate is currently transfer locked.';
  end if;

  select *
  into buyer_wallet
  from investor_wallets
  where user_id = p_buyer_id
  for update;

  if not found then
    raise exception 'Buyer wallet was not found.';
  end if;

  if coalesce(buyer_wallet.available_balance, 0) < price then
    raise exception
      'Insufficient wallet balance. Available: %, required: %',
      coalesce(buyer_wallet.available_balance, 0),
      price;
  end if;

  select *
  into seller_wallet
  from investor_wallets
  where user_id = l.seller_user_id
  for update;

  if not found then
    raise exception 'Seller wallet was not found.';
  end if;

  update investor_wallets
  set
    available_balance = available_balance - price,
    invested_balance = coalesce(invested_balance, 0) + principal,
    updated_at = now()
  where user_id = p_buyer_id;

  update investor_wallets
  set
    available_balance = available_balance + price,
    invested_balance = greatest(
      coalesce(invested_balance, 0) - principal,
      0
    ),
    updated_at = now()
  where user_id = l.seller_user_id;

  update investments
  set
    current_owner_id = p_buyer_id,
    transfer_count = coalesce(transfer_count, 0) + 1
  where id = l.investment_id;

  insert into secondary_market_trades_v2 (
    listing_id,
    investment_id,
    certificate_number,
    loan_number,
    seller_user_id,
    buyer_user_id,
    principal_transferred,
    sale_price,
    metadata
  )
  values (
    l.id,
    l.investment_id,
    l.certificate_number,
    l.loan_number,
    l.seller_user_id,
    p_buyer_id,
    principal,
    price,
    jsonb_build_object(
      'idempotency_key', p_key,
      'payment_method', 'wallet'
    )
  )
  returning id into trade_id;

  insert into investment_ownership_history (
    investment_id,
    certificate_number,
    from_owner_id,
    to_owner_id,
    transfer_type,
    purchase_price,
    principal_transferred,
    transfer_status,
    metadata
  )
  values (
    l.investment_id,
    l.certificate_number,
    l.seller_user_id,
    p_buyer_id,
    'secondary_market_sale',
    price,
    principal,
    'completed',
    jsonb_build_object(
      'trade_id', trade_id,
      'listing_id', l.id,
      'idempotency_key', p_key
    )
  );

  insert into secondary_market_cash_ledger_v2 (
    trade_id,
    user_id,
    entry_type,
    amount
  )
  values (
    trade_id,
    p_buyer_id,
    'purchase_debit',
    -price
  );

  insert into secondary_market_cash_ledger_v2 (
    trade_id,
    user_id,
    entry_type,
    amount
  )
  values (
    trade_id,
    l.seller_user_id,
    'sale_credit',
    price
  );

  update secondary_market_listings_v2
  set
    status = 'sold',
    buyer_user_id = p_buyer_id,
    sold_at = now()
  where id = l.id;

  return jsonb_build_object(
    'success', true,
    'trade_id', trade_id,
    'listing_id', l.id,
    'investment_id', l.investment_id,
    'certificate_number', l.certificate_number,
    'loan_number', l.loan_number,
    'purchase_price', price,
    'principal_transferred', principal,
    'seller_user_id', l.seller_user_id,
    'buyer_user_id', p_buyer_id,
    'status', 'completed'
  );
end;
$$;

grant execute
on function public.secondary_market_settle(uuid, uuid, text)
to authenticated;

begin;

drop policy if exists "Investors can view their own investments"
on public.investments;

drop policy if exists "investors can view own investments"
on public.investments;

create policy "Investors can view owned investments"
on public.investments
for select
to authenticated
using (
  auth.uid() = investor_id
  or auth.uid() = current_owner_id
);

commit;
