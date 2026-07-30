-- SecuredLanding v3.5 Financial Ledger and End-to-End Funding
-- Run after the existing investor wallet / protection migrations.

create extension if not exists pgcrypto;

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null unique,
  account_name text not null,
  account_type text not null check (account_type in (
    'investor_available_cash','investor_protected_funds','investor_active_principal',
    'loan_disbursable_funds','borrower_disbursed_cash','payment_clearing',
    'principal_receivable','interest_receivable','investor_interest_payable',
    'company_fee_revenue','refund_payable','processor_suspense'
  )),
  normal_balance text not null check (normal_balance in ('debit','credit')),
  owner_user_id uuid references auth.users(id) on delete cascade,
  loan_application_id bigint,
  currency text not null default 'USD',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists financial_accounts_owner_type_uq
  on public.financial_accounts(owner_user_id, account_type)
  where owner_user_id is not null and loan_application_id is null;
create unique index if not exists financial_accounts_loan_type_uq
  on public.financial_accounts(loan_application_id, account_type)
  where loan_application_id is not null and owner_user_id is null;

create table if not exists public.financial_ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  transaction_type text not null,
  status text not null default 'posted' check (status in ('pending','posted','reversed','failed')),
  reference_type text,
  reference_id text,
  description text,
  effective_at timestamptz not null default now(),
  posted_at timestamptz,
  reversed_transaction_id uuid references public.financial_ledger_transactions(id),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists financial_ledger_transactions_reference_idx
  on public.financial_ledger_transactions(reference_type, reference_id);

create table if not exists public.financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.financial_ledger_transactions(id) on delete restrict,
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  entry_side text not null check (entry_side in ('debit','credit')),
  amount numeric(18,2) not null check (amount > 0),
  memo text,
  created_at timestamptz not null default now()
);
create index if not exists financial_ledger_entries_tx_idx on public.financial_ledger_entries(transaction_id);
create index if not exists financial_ledger_entries_account_idx on public.financial_ledger_entries(account_id);

create table if not exists public.funding_holds (
  id uuid primary key default gen_random_uuid(),
  investment_id bigint not null unique,
  loan_application_id bigint not null,
  investor_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(18,2) not null check (amount > 0),
  status text not null default 'protected' check (status in ('protected','refund_requested','released','refunded','cancelled')),
  hold_until timestamptz not null,
  released_at timestamptz,
  refunded_at timestamptz,
  release_transaction_id uuid references public.financial_ledger_transactions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funding_holds_due_idx on public.funding_holds(status, hold_until);
create index if not exists funding_holds_loan_idx on public.funding_holds(loan_application_id);

create table if not exists public.borrower_disbursements (
  id uuid primary key default gen_random_uuid(),
  loan_application_id bigint not null,
  borrower_user_id uuid references auth.users(id) on delete set null,
  amount numeric(18,2) not null check (amount > 0),
  status text not null default 'completed' check (status in ('pending','processing','completed','failed','reversed')),
  processor_reference text,
  notes text,
  ledger_transaction_id uuid references public.financial_ledger_transactions(id),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.repayment_allocations (
  id uuid primary key default gen_random_uuid(),
  loan_application_id bigint not null,
  borrower_user_id uuid references auth.users(id) on delete set null,
  gross_amount numeric(18,2) not null check (gross_amount > 0),
  principal_amount numeric(18,2) not null default 0,
  investor_interest_amount numeric(18,2) not null default 0,
  company_fee_amount numeric(18,2) not null default 0,
  late_fee_amount numeric(18,2) not null default 0,
  status text not null default 'posted' check (status in ('pending','posted','reversed','failed')),
  payment_reference text,
  ledger_transaction_id uuid references public.financial_ledger_transactions(id),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (round(gross_amount,2) = round(principal_amount + investor_interest_amount + company_fee_amount + late_fee_amount,2))
);

create table if not exists public.investor_distributions (
  id uuid primary key default gen_random_uuid(),
  repayment_allocation_id uuid references public.repayment_allocations(id) on delete set null,
  investment_id bigint not null,
  investor_id uuid not null references auth.users(id) on delete cascade,
  loan_application_id bigint not null,
  principal_amount numeric(18,2) not null default 0,
  interest_amount numeric(18,2) not null default 0,
  status text not null default 'available' check (status in ('pending','available','paid','reversed','failed')),
  ledger_transaction_id uuid references public.financial_ledger_transactions(id),
  available_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  status text not null default 'open' check (status in ('open','resolved','ignored')),
  reference_type text,
  reference_id text,
  expected_amount numeric(18,2),
  actual_amount numeric(18,2),
  difference_amount numeric(18,2) generated always as (coalesce(actual_amount,0)-coalesce(expected_amount,0)) stored,
  notes text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.is_securedlanding_finance_admin()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.admin_users where user_id=auth.uid());
$$;
grant execute on function public.is_securedlanding_finance_admin() to authenticated;

create or replace function public.ensure_financial_account(
  p_account_type text,
  p_owner_user_id uuid default null,
  p_loan_application_id bigint default null,
  p_account_name text default null
)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_id uuid; v_code text; v_normal text;
begin
  if (p_owner_user_id is null) = (p_loan_application_id is null) then
    raise exception 'Exactly one account owner or loan ID is required';
  end if;
  v_code := p_account_type || ':' || coalesce(p_owner_user_id::text, p_loan_application_id::text);
  v_normal := case when p_account_type in ('company_fee_revenue','investor_interest_payable','refund_payable') then 'credit' else 'debit' end;
  insert into public.financial_accounts(account_code,account_name,account_type,normal_balance,owner_user_id,loan_application_id)
  values(v_code,coalesce(p_account_name,replace(initcap(p_account_type),'_',' ')),p_account_type,v_normal,p_owner_user_id,p_loan_application_id)
  on conflict(account_code) do update set active=true,updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.assert_balanced_ledger_transaction()
returns trigger language plpgsql set search_path=public as $$
declare v_debits numeric; v_credits numeric;
begin
  select coalesce(sum(amount) filter(where entry_side='debit'),0), coalesce(sum(amount) filter(where entry_side='credit'),0)
  into v_debits,v_credits from public.financial_ledger_entries where transaction_id=new.id;
  if round(v_debits,2) <> round(v_credits,2) then
    raise exception 'Ledger transaction is not balanced. Debits %, credits %',v_debits,v_credits;
  end if;
  new.posted_at := coalesce(new.posted_at,now());
  return new;
end;
$$;
drop trigger if exists financial_ledger_balance_check on public.financial_ledger_transactions;
create constraint trigger financial_ledger_balance_check
  after insert or update of status on public.financial_ledger_transactions
  deferrable initially deferred for each row
  when (new.status='posted') execute function public.assert_balanced_ledger_transaction();

create or replace view public.financial_account_balances as
select a.id,a.account_code,a.account_name,a.account_type,a.owner_user_id,a.loan_application_id,a.currency,
  coalesce(sum(case when e.entry_side=a.normal_balance then e.amount else -e.amount end) filter(where t.status='posted'),0)::numeric(18,2) as balance
from public.financial_accounts a
left join public.financial_ledger_entries e on e.account_id=a.id
left join public.financial_ledger_transactions t on t.id=e.transaction_id
group by a.id;

create or replace function public.release_expired_funding_holds_v35()
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare h record; v_tx uuid; v_protected uuid; v_disbursable uuid; v_count int:=0;
begin
  if not public.is_securedlanding_finance_admin() then raise exception 'Administrator access required'; end if;
  for h in select * from public.funding_holds where status='protected' and hold_until<=now() for update skip locked loop
    v_protected := public.ensure_financial_account('investor_protected_funds',h.investor_id,null,'Investor Protected Funds');
    v_disbursable := public.ensure_financial_account('loan_disbursable_funds',null,h.loan_application_id,'Loan Disbursable Funds');
    insert into public.financial_ledger_transactions(idempotency_key,transaction_type,reference_type,reference_id,description,created_by,status)
    values('hold-release:'||h.id,'funding_hold_release','funding_hold',h.id::text,'Investor refund period expired; funds eligible for borrower disbursement.',auth.uid(),'pending')
    on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key returning id into v_tx;
    if not exists(select 1 from public.financial_ledger_entries where transaction_id=v_tx) then
      insert into public.financial_ledger_entries(transaction_id,account_id,entry_side,amount,memo) values
      (v_tx,v_disbursable,'debit',h.amount,'Eligible borrower funding'),
      (v_tx,v_protected,'credit',h.amount,'Release investor-protected funds');
      update public.financial_ledger_transactions set status='posted' where id=v_tx;
    end if;
    update public.funding_holds set status='released',released_at=now(),release_transaction_id=v_tx,updated_at=now() where id=h.id;
    update public.investments set status='settled',settled_at=coalesce(settled_at,now()),updated_at=now() where id=h.investment_id and status='protection_period';
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('released_count',v_count);
end;
$$;
grant execute on function public.release_expired_funding_holds_v35() to authenticated;

create or replace function public.disburse_loan_funds_v35(p_loan_application_id bigint,p_amount numeric,p_note text default null)
returns public.borrower_disbursements
language plpgsql security definer set search_path=public
as $$
declare v_available numeric; v_tx uuid; v_source uuid; v_dest uuid; v_row public.borrower_disbursements; v_borrower uuid;
begin
  if not public.is_securedlanding_finance_admin() then raise exception 'Administrator access required'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Disbursement amount must be positive'; end if;
  select user_id into v_borrower from public.loan_applications where id=p_loan_application_id;
  if not found then raise exception 'Loan application not found'; end if;
  v_source:=public.ensure_financial_account('loan_disbursable_funds',null,p_loan_application_id,'Loan Disbursable Funds');
  v_dest:=public.ensure_financial_account('borrower_disbursed_cash',null,p_loan_application_id,'Borrower Disbursed Cash');
  select balance into v_available from public.financial_account_balances where id=v_source;
  if coalesce(v_available,0)<p_amount then raise exception 'Only % is eligible for disbursement',coalesce(v_available,0); end if;
  insert into public.borrower_disbursements(loan_application_id,borrower_user_id,amount,status,notes,created_by,completed_at)
  values(p_loan_application_id,v_borrower,p_amount,'completed',nullif(trim(p_note),''),auth.uid(),now()) returning * into v_row;
  insert into public.financial_ledger_transactions(idempotency_key,transaction_type,reference_type,reference_id,description,created_by,status)
  values('disbursement:'||v_row.id,'borrower_disbursement','borrower_disbursement',v_row.id::text,coalesce(p_note,'Borrower disbursement'),auth.uid(),'pending') returning id into v_tx;
  insert into public.financial_ledger_entries(transaction_id,account_id,entry_side,amount,memo) values
    (v_tx,v_dest,'debit',p_amount,'Borrower cash disbursed'),
    (v_tx,v_source,'credit',p_amount,'Reduce eligible funding');
  update public.financial_ledger_transactions set status='posted' where id=v_tx;
  update public.borrower_disbursements set ledger_transaction_id=v_tx where id=v_row.id returning * into v_row;
  update public.loan_applications set status=case when status='Funded' then 'Disbursed' else status end where id=p_loan_application_id;
  return v_row;
end;
$$;
grant execute on function public.disburse_loan_funds_v35(bigint,numeric,text) to authenticated;

-- Backfill current protected investments into holds. This does not create ledger entries for historical wallet activity.
insert into public.funding_holds(investment_id,loan_application_id,investor_id,amount,status,hold_until,released_at,refunded_at)
select i.id,i.loan_id,i.investor_id,i.amount,
  case when i.status='refunded' then 'refunded' when i.status in ('settled','active') then 'released' else 'protected' end,
  coalesce(i.refund_deadline,i.created_at+interval '7 days'),i.settled_at,i.refunded_at
from public.investments i
where i.status in ('protection_period','settled','active','refunded')
on conflict(investment_id) do nothing;

-- Seed ledger position for protected investments only when no investment transaction exists yet.
do $$
declare i record; v_tx uuid; v_available uuid; v_protected uuid;
begin
  for i in select i.* from public.investments i where i.status='protection_period' loop
    if not exists(select 1 from public.financial_ledger_transactions where idempotency_key='investment:'||i.id) then
      v_available:=public.ensure_financial_account('investor_available_cash',i.investor_id,null,'Investor Available Cash');
      v_protected:=public.ensure_financial_account('investor_protected_funds',i.investor_id,null,'Investor Protected Funds');
      insert into public.financial_ledger_transactions(idempotency_key,transaction_type,reference_type,reference_id,description,status)
      values('investment:'||i.id,'investment_funding','investment',i.id::text,'Historical protected investment ledger opening','pending') returning id into v_tx;
      insert into public.financial_ledger_entries(transaction_id,account_id,entry_side,amount,memo) values
        (v_tx,v_protected,'debit',i.amount,'Protected investment principal'),
        (v_tx,v_available,'credit',i.amount,'Available cash invested');
      update public.financial_ledger_transactions set status='posted' where id=v_tx;
    end if;
  end loop;
end $$;

alter table public.financial_accounts enable row level security;
alter table public.financial_ledger_transactions enable row level security;
alter table public.financial_ledger_entries enable row level security;
alter table public.funding_holds enable row level security;
alter table public.borrower_disbursements enable row level security;
alter table public.repayment_allocations enable row level security;
alter table public.investor_distributions enable row level security;
alter table public.financial_reconciliation_events enable row level security;

create policy "Finance admins manage accounts" on public.financial_accounts for all to authenticated using(public.is_securedlanding_finance_admin()) with check(public.is_securedlanding_finance_admin());
create policy "Finance admins manage ledger transactions" on public.financial_ledger_transactions for all to authenticated using(public.is_securedlanding_finance_admin()) with check(public.is_securedlanding_finance_admin());
create policy "Finance admins manage ledger entries" on public.financial_ledger_entries for all to authenticated using(public.is_securedlanding_finance_admin()) with check(public.is_securedlanding_finance_admin());
create policy "Finance admins manage funding holds" on public.funding_holds for all to authenticated using(public.is_securedlanding_finance_admin()) with check(public.is_securedlanding_finance_admin());
create policy "Investors view own funding holds" on public.funding_holds for select to authenticated using(investor_id=auth.uid());
create policy "Finance admins manage disbursements" on public.borrower_disbursements for all to authenticated using(public.is_securedlanding_finance_admin()) with check(public.is_securedlanding_finance_admin());
create policy "Borrowers view own disbursements" on public.borrower_disbursements for select to authenticated using(borrower_user_id=auth.uid());
create policy "Finance admins manage repayments" on public.repayment_allocations for all to authenticated using(public.is_securedlanding_finance_admin()) with check(public.is_securedlanding_finance_admin());
create policy "Finance admins manage distributions" on public.investor_distributions for all to authenticated using(public.is_securedlanding_finance_admin()) with check(public.is_securedlanding_finance_admin());
create policy "Investors view own distributions" on public.investor_distributions for select to authenticated using(investor_id=auth.uid());
create policy "Finance admins manage reconciliation" on public.financial_reconciliation_events for all to authenticated using(public.is_securedlanding_finance_admin()) with check(public.is_securedlanding_finance_admin());

-- Views inherit underlying RLS in PostgreSQL 15+ when security_invoker is enabled.
alter view public.financial_account_balances set (security_invoker=true);
grant select on public.financial_account_balances to authenticated;
grant select on public.funding_holds,public.financial_reconciliation_events to authenticated;

notify pgrst,'reload schema';
