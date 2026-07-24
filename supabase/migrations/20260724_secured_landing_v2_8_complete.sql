begin;
create extension if not exists pgcrypto;

alter table public.marketplace_loans
  add column if not exists investor_refund_enabled boolean not null default true,
  add column if not exists investor_refund_days integer not null default 7,
  add column if not exists protected_funds numeric(14,2) not null default 0,
  add column if not exists settled_funds numeric(14,2) not null default 0;

create unique index if not exists marketplace_loans_loan_application_id_unique
  on public.marketplace_loans(loan_application_id);

alter table public.investments
  add column if not exists refund_policy_enabled boolean not null default true,
  add column if not exists refund_period_days integer not null default 7,
  add column if not exists refund_deadline timestamptz,
  add column if not exists disbursement_eligible_at timestamptz,
  add column if not exists settled_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists policy_version text not null default '2.8.0',
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.investment_refund_requests (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null unique references public.investments(id),
  investor_user_id uuid not null references auth.users(id),
  loan_application_id bigint not null references public.loan_applications(id),
  requested_amount numeric(14,2) not null check (requested_amount > 0),
  reason text,
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_protected_investment(
  p_loan_application_id bigint,
  p_amount numeric
)
returns public.investments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_marketplace public.marketplace_loans;
  v_investment public.investments;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount < 100 then raise exception 'Minimum investment is $100'; end if;

  select * into v_marketplace
  from public.marketplace_loans
  where loan_application_id = p_loan_application_id
  for update;

  if not found then
    raise exception 'Marketplace loan not found for loan_application_id %', p_loan_application_id;
  end if;

  insert into public.investments(
    investor_user_id,
    loan_application_id,
    amount,
    status,
    invested_at,
    refund_policy_enabled,
    refund_period_days,
    refund_deadline,
    disbursement_eligible_at,
    policy_version
  )
  values (
    v_user_id,
    p_loan_application_id,
    p_amount,
    'protection_period',
    now(),
    true,
    7,
    now() + interval '7 days',
    now() + interval '7 days',
    '2.8.0'
  )
  returning * into v_investment;

  update public.marketplace_loans
  set amount_funded = coalesce(amount_funded, 0) + p_amount,
      amount_remaining = greatest(coalesce(amount_remaining, loan_amount, 0) - p_amount, 0),
      protected_funds = coalesce(protected_funds, 0) + p_amount,
      updated_at = now()
  where loan_application_id = p_loan_application_id;

  return v_investment;
end;
$$;

grant execute on function public.create_protected_investment(bigint, numeric) to authenticated;

create or replace function public.request_investment_refund(
  p_investment_id uuid,
  p_reason text default null
)
returns public.investment_refund_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.investments;
  r public.investment_refund_requests;
begin
  select * into v
  from public.investments
  where id = p_investment_id
  for update;

  if not found then raise exception 'Investment not found'; end if;
  if v.investor_user_id <> auth.uid() then raise exception 'You can only refund your own investment'; end if;
  if v.status <> 'protection_period' then raise exception 'Investment is not eligible for refund'; end if;
  if now() >= v.refund_deadline then raise exception 'The 7-day refund period has expired'; end if;

  update public.investments
  set status = 'refund_processing',
      updated_at = now()
  where id = v.id;

  insert into public.investment_refund_requests(
    investment_id,
    investor_user_id,
    loan_application_id,
    requested_amount,
    reason,
    status
  )
  values (
    v.id,
    v.investor_user_id,
    v.loan_application_id,
    v.amount,
    nullif(trim(p_reason), ''),
    'requested'
  )
  on conflict (investment_id) do update
  set reason = excluded.reason,
      status = 'requested',
      updated_at = now()
  returning * into r;

  return r;
end;
$$;

grant execute on function public.request_investment_refund(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
