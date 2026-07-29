begin;

-- Permanent identity for each investor position. The UUID is the immutable
-- system identifier; certificate_number is the investor-facing identifier.
alter table public.investments
  add column if not exists certificate_uuid uuid default gen_random_uuid(),
  add column if not exists certificate_number text,
  add column if not exists original_investor_id uuid,
  add column if not exists current_owner_id uuid,
  add column if not exists transfer_count integer not null default 0,
  add column if not exists transfer_locked boolean not null default false,
  add column if not exists certificate_issued_at timestamptz;

update public.investments
set
  certificate_uuid = coalesce(certificate_uuid, gen_random_uuid()),
  original_investor_id = coalesce(original_investor_id, investor_id),
  current_owner_id = coalesce(current_owner_id, investor_id),
  certificate_issued_at = coalesce(certificate_issued_at, created_at, now())
where certificate_uuid is null
   or original_investor_id is null
   or current_owner_id is null
   or certificate_issued_at is null;

create unique index if not exists investments_certificate_uuid_key
  on public.investments(certificate_uuid);

create unique index if not exists investments_certificate_number_key
  on public.investments(certificate_number)
  where certificate_number is not null;

create index if not exists investments_current_owner_idx
  on public.investments(current_owner_id);

-- Generate a readable certificate linked to the public loan number.
-- Example: SLI-2026-889568-000123
create or replace function public.format_investment_certificate_number(
  p_investment_id bigint,
  p_loan_id bigint,
  p_created_at timestamptz default now()
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_loan_number text;
  v_year text;
begin
  select coalesce(la.loan_number::text, p_loan_id::text)
    into v_loan_number
  from public.loan_applications la
  where la.id = p_loan_id;

  v_loan_number := coalesce(v_loan_number, p_loan_id::text);
  v_year := to_char(coalesce(p_created_at, now()), 'YYYY');

  return 'SLI-' || v_year || '-' || v_loan_number || '-' || lpad(p_investment_id::text, 6, '0');
end;
$$;

create or replace function public.assign_investment_certificate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.certificate_uuid := coalesce(new.certificate_uuid, gen_random_uuid());
  new.original_investor_id := coalesce(new.original_investor_id, new.investor_id);
  new.current_owner_id := coalesce(new.current_owner_id, new.investor_id);
  new.certificate_issued_at := coalesce(new.certificate_issued_at, new.created_at, now());

  if new.certificate_number is null or btrim(new.certificate_number) = '' then
    if new.id is null then
      raise exception 'Investment id must be assigned before certificate generation';
    end if;
    new.certificate_number := public.format_investment_certificate_number(
      new.id,
      new.loan_id,
      new.created_at
    );
  end if;

  return new;
end;
$$;

drop trigger if exists investments_assign_certificate on public.investments;
create trigger investments_assign_certificate
before insert on public.investments
for each row execute function public.assign_investment_certificate();

-- Backfill certificates for investments created before this migration.
update public.investments i
set certificate_number = public.format_investment_certificate_number(i.id, i.loan_id, i.created_at)
where i.certificate_number is null or btrim(i.certificate_number) = '';

alter table public.investments
  alter column certificate_uuid set not null,
  alter column certificate_number set not null,
  alter column original_investor_id set not null,
  alter column current_owner_id set not null,
  alter column certificate_issued_at set not null;

-- Keep certificate identity immutable after issuance.
create or replace function public.protect_investment_certificate_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.certificate_uuid is distinct from new.certificate_uuid
     or old.certificate_number is distinct from new.certificate_number
     or old.original_investor_id is distinct from new.original_investor_id
     or old.certificate_issued_at is distinct from new.certificate_issued_at then
    raise exception 'Investment certificate identity is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists investments_protect_certificate_identity on public.investments;
create trigger investments_protect_certificate_identity
before update on public.investments
for each row execute function public.protect_investment_certificate_identity();

-- Ownership history foundation for a future secondary market.
create table if not exists public.investment_ownership_history (
  id bigint generated always as identity primary key,
  investment_id bigint not null references public.investments(id) on delete restrict,
  certificate_uuid uuid not null,
  certificate_number text not null,
  from_owner_id uuid references auth.users(id) on delete set null,
  to_owner_id uuid not null references auth.users(id) on delete restrict,
  transfer_type text not null default 'issuance',
  purchase_price numeric(14,2),
  principal_transferred numeric(14,2) not null,
  transfer_status text not null default 'completed',
  transfer_reference text,
  transferred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint investment_ownership_history_transfer_type_check
    check (transfer_type in ('issuance','secondary_sale','gift','estate','correction')),
  constraint investment_ownership_history_status_check
    check (transfer_status in ('pending','completed','cancelled','reversed'))
);

create index if not exists investment_ownership_history_investment_idx
  on public.investment_ownership_history(investment_id, transferred_at desc);
create index if not exists investment_ownership_history_certificate_idx
  on public.investment_ownership_history(certificate_number);
create index if not exists investment_ownership_history_owner_idx
  on public.investment_ownership_history(to_owner_id, transferred_at desc);

insert into public.investment_ownership_history (
  investment_id,
  certificate_uuid,
  certificate_number,
  from_owner_id,
  to_owner_id,
  transfer_type,
  purchase_price,
  principal_transferred,
  transfer_status,
  transferred_at
)
select
  i.id,
  i.certificate_uuid,
  i.certificate_number,
  null,
  i.original_investor_id,
  'issuance',
  i.amount,
  i.amount,
  'completed',
  coalesce(i.created_at, now())
from public.investments i
where not exists (
  select 1
  from public.investment_ownership_history h
  where h.investment_id = i.id
    and h.transfer_type = 'issuance'
);

-- Recreate portfolio view so certificate data is available in the UI.
drop view if exists public.investor_portfolio_v29;
create view public.investor_portfolio_v29 as
select
  i.id as investment_id,
  i.investor_id,
  i.current_owner_id,
  i.original_investor_id,
  i.certificate_uuid,
  i.certificate_number,
  i.certificate_issued_at,
  i.transfer_count,
  i.transfer_locked,
  i.loan_id as internal_loan_id,
  la.loan_number as public_loan_number,
  coalesce(ml.business_name, la.business_name, 'Investment') as business_name,
  i.amount,
  i.investor_interest_rate,
  i.term_months,
  i.status,
  i.created_at,
  i.refund_policy_enabled,
  i.refund_period_days,
  coalesce(i.protection_expires_at, i.refund_deadline) as protection_expires_at,
  i.refunded_at,
  i.settled_at,
  i.activated_at,
  case
    when i.status = 'protection_period' and coalesce(i.protection_expires_at, i.refund_deadline) > now() then 'Protected'
    when i.status in ('refund_requested','refund_processing') then 'Refund Processing'
    when i.status = 'refunded' then 'Refunded'
    when i.status in ('settled','active') then 'Active'
    when i.status = 'cancelled' then 'Cancelled'
    when i.status = 'failed' then 'Failed'
    else initcap(replace(coalesce(i.status,'pending'),'_',' '))
  end as display_status,
  (i.status = 'protection_period' and coalesce(i.protection_expires_at, i.refund_deadline) > now()) as refund_eligible
from public.investments i
join public.loan_applications la on la.id = i.loan_id
left join public.marketplace_loans ml on ml.loan_application_id = i.loan_id
where i.current_owner_id = i.investor_id;

grant select on public.investor_portfolio_v29 to authenticated;

alter table public.investment_ownership_history enable row level security;

drop policy if exists "owners can view certificate history" on public.investment_ownership_history;
create policy "owners can view certificate history"
on public.investment_ownership_history
for select to authenticated
using (
  to_owner_id = auth.uid()
  or from_owner_id = auth.uid()
  or exists (
    select 1 from public.investments i
    where i.id = investment_ownership_history.investment_id
      and i.current_owner_id = auth.uid()
  )
);

-- No client insert/update policy is intentionally granted. Future transfers
-- should be performed by a security-definer RPC after compliance checks.

grant select on public.investment_ownership_history to authenticated;
grant execute on function public.format_investment_certificate_number(bigint,bigint,timestamptz) to authenticated;

notify pgrst, 'reload schema';
commit;
