-- SecuredLanding v3.6.6 - canonical live NMI wallet credit RPC
-- Safe to run after v3.6.4. Creates the exact RPC used by the live API.
create table if not exists public.nmi_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nmi_transaction_id text not null unique,
  transaction_kind text not null default 'wallet_deposit',
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  fee_amount numeric(14,2) not null default 0,
  reserve_amount numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null check (net_amount >= 0),
  processor_status text not null,
  response_text text,
  wallet_transaction_id uuid,
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists nmi_payment_transactions_nmi_tx_uidx
  on public.nmi_payment_transactions(nmi_transaction_id);

create or replace function public.credit_nmi_wallet(
  p_user_id uuid,
  p_nmi_transaction_id text,
  p_gross numeric,
  p_fee numeric default 0,
  p_reserve numeric default 0
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.nmi_payment_transactions%rowtype;
  v_net numeric(14,2);
  v_balance numeric(14,2);
  v_wallet_tx_id uuid;
begin
  if p_user_id is null or coalesce(btrim(p_nmi_transaction_id),'') = '' or coalesce(p_gross,0) <= 0 then
    raise exception 'Invalid NMI wallet deposit';
  end if;

  v_net := round((p_gross - coalesce(p_fee,0) - coalesce(p_reserve,0))::numeric, 2);
  if v_net < 0 then raise exception 'NMI net deposit cannot be negative'; end if;

  select * into v_existing
  from public.nmi_payment_transactions
  where nmi_transaction_id = p_nmi_transaction_id
  for update;

  if found then
    if v_existing.user_id <> p_user_id or v_existing.gross_amount <> p_gross then
      raise exception 'NMI transaction ID conflict';
    end if;
    select coalesce(available_balance,0) into v_balance
      from public.investor_wallets where user_id=p_user_id;
    return coalesce(v_balance,0);
  end if;

  insert into public.investor_wallets(user_id,available_balance,invested_balance,updated_at)
  values(p_user_id,0,0,now()) on conflict (user_id) do nothing;

  insert into public.nmi_payment_transactions(
    user_id,nmi_transaction_id,transaction_kind,gross_amount,fee_amount,reserve_amount,
    net_amount,processor_status,response_text
  ) values (
    p_user_id,p_nmi_transaction_id,'wallet_deposit',p_gross,coalesce(p_fee,0),coalesce(p_reserve,0),
    v_net,'approved','Approved by NMI and credited by SecuredLanding'
  );

  update public.investor_wallets
     set available_balance=coalesce(available_balance,0)+v_net, updated_at=now()
   where user_id=p_user_id
   returning available_balance into v_balance;

  insert into public.wallet_transactions(user_id,transaction_type,amount,status,description)
  values(p_user_id,'deposit',v_net,'completed',
    'NMI card deposit. Processor transaction #' || p_nmi_transaction_id || '.')
  returning id into v_wallet_tx_id;

  update public.nmi_payment_transactions
     set wallet_transaction_id=v_wallet_tx_id, credited_at=now(), updated_at=now()
   where nmi_transaction_id=p_nmi_transaction_id;

  return coalesce(v_balance,0);
end; $$;

revoke all on function public.credit_nmi_wallet(uuid,text,numeric,numeric,numeric) from public, anon, authenticated;
grant execute on function public.credit_nmi_wallet(uuid,text,numeric,numeric,numeric) to service_role;
