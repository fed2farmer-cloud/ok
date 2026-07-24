-- Secured Landing v2.8.0
-- Investor-only 7-day investment cancellation/refund protection.
-- This creates NO borrower cancellation or refund right.
-- Designed for the synchronized v2.5+ schema using BIGINT loan_application_id.

begin;
create extension if not exists pgcrypto;

create table if not exists public.platform_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.platform_settings(setting_key, setting_value)
values ('investor_refund_policy',
  '{"enabled":true,"default_days":7,"manual_admin_review":false,"policy_version":"2.8.0"}'::jsonb)
on conflict (setting_key) do nothing;

alter table public.marketplace_loans
  add column if not exists investor_refund_enabled boolean not null default true,
  add column if not exists investor_refund_days integer not null default 7,
  add column if not exists protected_funds numeric(14,2) not null default 0,
  add column if not exists settled_funds numeric(14,2) not null default 0;

alter table public.marketplace_loans
  drop constraint if exists marketplace_loans_investor_refund_days_check;
alter table public.marketplace_loans
  add constraint marketplace_loans_investor_refund_days_check
  check (investor_refund_days between 0 and 30);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  investor_user_id uuid not null references auth.users(id) on delete restrict,
  loan_application_id bigint not null references public.loan_applications(id) on delete restrict,
  marketplace_loan_id uuid references public.marketplace_loans(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'protection_period',
  invested_at timestamptz not null default now(),
  refund_policy_enabled boolean not null default true,
  refund_period_days integer not null default 7,
  refund_deadline timestamptz,
  disbursement_eligible_at timestamptz,
  settled_at timestamptz,
  refunded_at timestamptz,
  cancelled_at timestamptz,
  policy_version text not null default '2.8.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.investments
  add column if not exists investor_user_id uuid,
  add column if not exists loan_application_id bigint,
  add column if not exists marketplace_loan_id uuid,
  add column if not exists amount numeric(14,2),
  add column if not exists status text default 'protection_period',
  add column if not exists invested_at timestamptz default now(),
  add column if not exists refund_policy_enabled boolean not null default true,
  add column if not exists refund_period_days integer not null default 7,
  add column if not exists refund_deadline timestamptz,
  add column if not exists disbursement_eligible_at timestamptz,
  add column if not exists settled_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists policy_version text not null default '2.8.0',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.investments drop constraint if exists investments_status_check;
alter table public.investments add constraint investments_status_check check (status in (
  'payment_pending','protection_period','refund_requested','refund_processing',
  'refunded','settled','active','cancelled','failed'
));

create index if not exists investments_investor_idx
  on public.investments(investor_user_id, created_at desc);
create index if not exists investments_deadline_idx
  on public.investments(status, refund_deadline);
create index if not exists investments_loan_idx
  on public.investments(loan_application_id, status);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  investment_id uuid references public.investments(id) on delete set null,
  transaction_type text not null,
  amount numeric(14,2) not null,
  status text not null default 'completed',
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.investment_refund_requests (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null unique references public.investments(id) on delete restrict,
  investor_user_id uuid not null references auth.users(id) on delete restrict,
  loan_application_id bigint not null references public.loan_applications(id) on delete restrict,
  requested_amount numeric(14,2) not null check (requested_amount > 0),
  reason text,
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  admin_notes text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.investment_refund_requests
  drop constraint if exists investment_refund_requests_status_check;
alter table public.investment_refund_requests
  add constraint investment_refund_requests_status_check check (status in (
    'requested','approved','rejected','processing','completed','failed','cancelled'
  ));

create table if not exists public.investment_audit_events (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_key text not null,
  description text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.investor_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investment_id uuid references public.investments(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null default 'investment_update',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.initialize_investment_protection()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_enabled boolean := true;
  v_days integer := 7;
begin
  select coalesce(investor_refund_enabled,true), coalesce(investor_refund_days,7)
    into v_enabled, v_days
  from public.marketplace_loans
  where loan_application_id = new.loan_application_id
  limit 1;

  new.invested_at := coalesce(new.invested_at, now());
  new.refund_policy_enabled := v_enabled;
  new.refund_period_days := case when v_enabled then v_days else 0 end;
  new.refund_deadline := case when v_enabled then new.invested_at + make_interval(days=>v_days) else new.invested_at end;
  new.disbursement_eligible_at := new.refund_deadline;
  new.status := case when v_enabled and v_days > 0 then 'protection_period' else 'settled' end;
  new.settled_at := case when not v_enabled or v_days = 0 then now() else null end;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists initialize_investment_protection_trigger on public.investments;
create trigger initialize_investment_protection_trigger
before insert on public.investments
for each row execute function public.initialize_investment_protection();

create or replace function public.refresh_marketplace_investment_totals(p_loan_id bigint)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.marketplace_loans ml
  set protected_funds = coalesce((
        select sum(amount) from public.investments
        where loan_application_id=p_loan_id
        and status in ('protection_period','refund_requested','refund_processing')
      ),0),
      settled_funds = coalesce((
        select sum(amount) from public.investments
        where loan_application_id=p_loan_id
        and status in ('settled','active')
      ),0),
      amount_funded = coalesce((
        select sum(amount) from public.investments
        where loan_application_id=p_loan_id
        and status not in ('refunded','cancelled','failed')
      ),0),
      amount_remaining = greatest(
        coalesce(ml.funding_goal,ml.loan_amount,0) -
        coalesce((select sum(amount) from public.investments
          where loan_application_id=p_loan_id
          and status not in ('refunded','cancelled','failed')),0),0),
      updated_at=now()
  where ml.loan_application_id=p_loan_id;
end $$;

create or replace function public.after_investment_change_refresh_totals()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.refresh_marketplace_investment_totals(coalesce(new.loan_application_id,old.loan_application_id));
  return coalesce(new,old);
end $$;

drop trigger if exists investment_totals_refresh_trigger on public.investments;
create trigger investment_totals_refresh_trigger
after insert or update or delete on public.investments
for each row execute function public.after_investment_change_refresh_totals();

create or replace function public.request_investment_refund(
  p_investment_id uuid, p_reason text default null
)
returns public.investment_refund_requests
language plpgsql security definer set search_path=public as $$
declare
  v public.investments;
  r public.investment_refund_requests;
begin
  select * into v from public.investments where id=p_investment_id for update;
  if not found then raise exception 'Investment not found'; end if;
  if v.investor_user_id <> auth.uid() then raise exception 'You can only refund your own investment'; end if;
  if not v.refund_policy_enabled then raise exception 'Refund protection is not enabled'; end if;
  if now() >= v.refund_deadline then raise exception 'The 7-day investment refund period has expired'; end if;
  if v.status <> 'protection_period' then raise exception 'Investment is not eligible for refund'; end if;

  update public.investments set status='refund_processing',updated_at=now() where id=v.id;

  insert into public.investment_refund_requests(
    investment_id,investor_user_id,loan_application_id,requested_amount,reason,status
  ) values (v.id,v.investor_user_id,v.loan_application_id,v.amount,nullif(trim(p_reason),''),'approved')
  on conflict(investment_id) do update set
    reason=excluded.reason,status='approved',requested_at=now(),updated_at=now()
  returning * into r;

  insert into public.investment_audit_events(
    investment_id,actor_user_id,event_key,description,before_state,after_state
  ) values (
    v.id,auth.uid(),'refund_requested',
    'Investor requested cancellation within the protected period.',
    jsonb_build_object('status',v.status),jsonb_build_object('status','refund_processing')
  );

  insert into public.investor_notifications(user_id,investment_id,title,message,notification_type)
  values(v.investor_user_id,v.id,'Refund request received',
    'Your investment refund request was received within the seven-day protection period.',
    'refund_requested');

  return r;
end $$;

grant execute on function public.request_investment_refund(uuid,text) to authenticated;

create or replace function public.complete_investment_refund(
  p_refund_request_id uuid, p_admin_notes text default null
)
returns public.investment_refund_requests
language plpgsql security definer set search_path=public as $$
declare
  r public.investment_refund_requests;
  v public.investments;
begin
  if not public.is_secured_landing_admin() then raise exception 'Administrator access required'; end if;

  select * into r from public.investment_refund_requests
  where id=p_refund_request_id for update;
  if not found then raise exception 'Refund request not found'; end if;
  if r.status in ('completed','rejected','cancelled') then raise exception 'Refund request is already final'; end if;

  select * into v from public.investments where id=r.investment_id for update;

  insert into public.wallet_transactions(
    user_id,investment_id,transaction_type,amount,status,description,metadata
  ) values (
    v.investor_user_id,v.id,'investment_refund',v.amount,'completed',
    'Principal returned during the seven-day investor protection period.',
    jsonb_build_object('refund_request_id',r.id,'policy_version','2.8.0')
  );

  update public.investments
  set status='refunded',refunded_at=now(),cancelled_at=now(),updated_at=now()
  where id=v.id;

  update public.investment_refund_requests
  set status='completed',reviewed_at=coalesce(reviewed_at,now()),
      reviewed_by=coalesce(reviewed_by,auth.uid()),
      admin_notes=coalesce(nullif(trim(p_admin_notes),''),admin_notes),
      processed_at=now(),updated_at=now()
  where id=r.id returning * into r;

  insert into public.investment_audit_events(
    investment_id,actor_user_id,event_key,description,after_state
  ) values(v.id,auth.uid(),'refund_completed',
    'Investment principal returned to investor wallet.',
    jsonb_build_object('status','refunded'));

  insert into public.investor_notifications(user_id,investment_id,title,message,notification_type)
  values(v.investor_user_id,v.id,'Investment refunded',
    'Your investment principal was returned to your wallet.','refund_completed');

  perform public.refresh_marketplace_investment_totals(v.loan_application_id);
  return r;
end $$;

grant execute on function public.complete_investment_refund(uuid,text) to authenticated;

create or replace function public.settle_expired_investment_protection()
returns integer language plpgsql security definer set search_path=public as $$
declare
  n integer := 0;
  x record;
begin
  for x in select id,investor_user_id,loan_application_id,amount
    from public.investments
    where status='protection_period' and refund_deadline <= now()
    for update skip locked
  loop
    update public.investments set status='settled',settled_at=now(),updated_at=now()
    where id=x.id;

    insert into public.investment_audit_events(investment_id,event_key,description,after_state)
    values(x.id,'protection_expired',
      'The investor cancellation period expired; funds are eligible for borrower disbursement.',
      jsonb_build_object('status','settled'));

    insert into public.investor_notifications(user_id,investment_id,title,message,notification_type)
    values(x.investor_user_id,x.id,'Investment is now final',
      'Your seven-day protection period expired. The funds are now committed.',
      'protection_expired');

    perform public.refresh_marketplace_investment_totals(x.loan_application_id);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace view public.loan_disbursement_availability as
select
  ml.loan_application_id,
  ml.loan_amount,
  coalesce(ml.protected_funds,0) protected_funds,
  coalesce(ml.settled_funds,0) settled_funds,
  coalesce((select sum(i.amount) from public.investments i
    where i.loan_application_id=ml.loan_application_id
    and i.status in ('settled','active')),0) available_for_disbursement
from public.marketplace_loans ml;

alter table public.platform_settings enable row level security;
alter table public.investments enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.investment_refund_requests enable row level security;
alter table public.investment_audit_events enable row level security;
alter table public.investor_notifications enable row level security;

drop policy if exists "Authenticated read refund policy" on public.platform_settings;
create policy "Authenticated read refund policy" on public.platform_settings
for select to authenticated using(true);

drop policy if exists "Admins manage platform settings" on public.platform_settings;
create policy "Admins manage platform settings" on public.platform_settings
for all to authenticated using(public.is_secured_landing_admin())
with check(public.is_secured_landing_admin());

drop policy if exists "Investors view own investments" on public.investments;
create policy "Investors view own investments" on public.investments
for select to authenticated using(investor_user_id=auth.uid() or public.is_secured_landing_admin());

drop policy if exists "Investors create own investments" on public.investments;
create policy "Investors create own investments" on public.investments
for insert to authenticated with check(investor_user_id=auth.uid());

drop policy if exists "Admins manage investments" on public.investments;
create policy "Admins manage investments" on public.investments
for all to authenticated using(public.is_secured_landing_admin())
with check(public.is_secured_landing_admin());

drop policy if exists "Users view own wallet transactions" on public.wallet_transactions;
create policy "Users view own wallet transactions" on public.wallet_transactions
for select to authenticated using(user_id=auth.uid() or public.is_secured_landing_admin());

drop policy if exists "Investors view own refund requests" on public.investment_refund_requests;
create policy "Investors view own refund requests" on public.investment_refund_requests
for select to authenticated using(investor_user_id=auth.uid() or public.is_secured_landing_admin());

drop policy if exists "Admins manage refund requests" on public.investment_refund_requests;
create policy "Admins manage refund requests" on public.investment_refund_requests
for all to authenticated using(public.is_secured_landing_admin())
with check(public.is_secured_landing_admin());

drop policy if exists "Investors view own audit events" on public.investment_audit_events;
create policy "Investors view own audit events" on public.investment_audit_events
for select to authenticated using(
  public.is_secured_landing_admin() or exists(
    select 1 from public.investments i
    where i.id=investment_audit_events.investment_id and i.investor_user_id=auth.uid()
  )
);

drop policy if exists "Users view own investor notifications" on public.investor_notifications;
create policy "Users view own investor notifications" on public.investor_notifications
for select to authenticated using(user_id=auth.uid() or public.is_secured_landing_admin());

notify pgrst, 'reload schema';
commit;
