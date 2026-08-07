-- SecuredLanding v3.6.4 - NMI wallet deposit ledger + idempotent wallet credit
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
create index if not exists nmi_payment_transactions_user_idx on public.nmi_payment_transactions(user_id, created_at desc);
alter table public.nmi_payment_transactions enable row level security;
drop policy if exists "investors read own nmi payments" on public.nmi_payment_transactions;
create policy "investors read own nmi payments" on public.nmi_payment_transactions for select to authenticated using (auth.uid() = user_id);

create or replace function public.credit_nmi_wallet_deposit_v1(
  p_user_id uuid,
  p_nmi_transaction_id text,
  p_gross_amount numeric,
  p_response_text text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.nmi_payment_transactions%rowtype;
  v_wallet public.investor_wallets%rowtype;
  v_tx_id uuid;
  v_new_balance numeric(14,2);
begin
  if p_user_id is null or p_nmi_transaction_id is null or btrim(p_nmi_transaction_id) = '' or p_gross_amount <= 0 then
    raise exception 'Invalid NMI wallet deposit';
  end if;

  select * into v_existing from public.nmi_payment_transactions where nmi_transaction_id = p_nmi_transaction_id for update;
  if found then
    if v_existing.user_id <> p_user_id or v_existing.gross_amount <> p_gross_amount then
      raise exception 'NMI transaction ID conflict';
    end if;
    return jsonb_build_object('success', true, 'duplicate', true, 'available_balance',
      coalesce((select available_balance from public.investor_wallets where user_id=p_user_id),0),
      'nmi_transaction_id', p_nmi_transaction_id);
  end if;

  insert into public.nmi_payment_transactions(user_id,nmi_transaction_id,gross_amount,net_amount,processor_status,response_text)
  values(p_user_id,p_nmi_transaction_id,p_gross_amount,p_gross_amount,'approved',p_response_text);

  insert into public.investor_wallets(user_id,available_balance,invested_balance,updated_at)
  values(p_user_id,0,0,now()) on conflict (user_id) do nothing;

  update public.investor_wallets
     set available_balance = coalesce(available_balance,0) + p_gross_amount, updated_at=now()
   where user_id=p_user_id returning * into v_wallet;
  v_new_balance := coalesce(v_wallet.available_balance,0);

  insert into public.wallet_transactions(user_id,transaction_type,amount,status,description)
  values(p_user_id,'deposit',p_gross_amount,'completed',
    'NMI card deposit. Processor transaction #' || p_nmi_transaction_id || '.')
  returning id into v_tx_id;

  update public.nmi_payment_transactions set wallet_transaction_id=v_tx_id, credited_at=now(), updated_at=now()
   where nmi_transaction_id=p_nmi_transaction_id;

  -- Accounting ledger is supplemental; wallet credit must not fail if an older install lacks this table.
  begin
    insert into public.accounting_ledger(user_id,transaction_type,debit_account,credit_account,amount,description)
    values(p_user_id,'deposit','Platform Cash','Investor Wallet Liability',p_gross_amount,
      'NMI wallet deposit #' || p_nmi_transaction_id || '.');
  exception when undefined_table or undefined_column then null;
  end;

  return jsonb_build_object('success',true,'duplicate',false,'available_balance',v_new_balance,
    'wallet_transaction_id',v_tx_id,'nmi_transaction_id',p_nmi_transaction_id);
end; $$;
revoke all on function public.credit_nmi_wallet_deposit_v1(uuid,text,numeric,text) from public, anon, authenticated;
grant execute on function public.credit_nmi_wallet_deposit_v1(uuid,text,numeric,text) to service_role;
