-- SecuredLanding v4.0 lifecycle foundation
-- NON-DESTRUCTIVE. Run RESET_TEST_LOAN_DATA.sql separately only when you intentionally want to clear test loan data.
begin;
create extension if not exists pgcrypto;

create or replace function public.generate_random_public_number(p_table regclass, p_column text)
returns bigint language plpgsql security definer set search_path=public as $$
declare n bigint; exists_row boolean; begin
  loop
    n := floor(random()*900000+100000)::bigint;
    execute format('select exists(select 1 from %s where %I=$1)',p_table,p_column) into exists_row using n;
    exit when not exists_row;
  end loop; return n;
end $$;

alter table if exists public.loan_applications add column if not exists loan_number bigint;
create unique index if not exists loan_applications_loan_number_uidx on public.loan_applications(loan_number) where loan_number is not null;
create or replace function public.assign_loan_number_v4() returns trigger language plpgsql as $$ begin
 if new.loan_number is null then new.loan_number:=public.generate_random_public_number('public.loan_applications'::regclass,'loan_number'); end if;
 if tg_op='UPDATE' and old.loan_number is not null and new.loan_number<>old.loan_number then raise exception 'loan_number is immutable'; end if;
 return new; end $$;
drop trigger if exists trg_assign_loan_number_v4 on public.loan_applications;
create trigger trg_assign_loan_number_v4 before insert or update of loan_number on public.loan_applications for each row execute function public.assign_loan_number_v4();

create table if not exists public.loan_payment_schedule(
 id uuid primary key default gen_random_uuid(), loan_number bigint not null, installment_number int not null, due_date date not null,
 expected_principal numeric(14,2) not null default 0, expected_interest numeric(14,2) not null default 0,
 expected_total numeric(14,2) generated always as (expected_principal+expected_interest) stored,
 collected_principal numeric(14,2) not null default 0, collected_interest numeric(14,2) not null default 0,
 status text not null default 'upcoming' check(status in('upcoming','due','partial','paid','late','missed','waived')),
 paid_at timestamptz, created_at timestamptz not null default now(), unique(loan_number,installment_number));

create table if not exists public.borrower_payments(
 id uuid primary key default gen_random_uuid(), payment_number bigint unique not null default floor(random()*900000+100000)::bigint,
 loan_number bigint not null, borrower_user_id uuid, schedule_id uuid references public.loan_payment_schedule(id), processor text not null,
 processor_transaction_id text, idempotency_key text unique not null, amount numeric(14,2) not null check(amount>0),
 status text not null default 'created' check(status in('created','processing','authorized','settled','failed','voided','refunded','exception')),
 raw_reference jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), settled_at timestamptz);

create table if not exists public.payment_allocations(
 id uuid primary key default gen_random_uuid(), borrower_payment_id uuid not null references public.borrower_payments(id) on delete cascade,
 loan_number bigint not null, allocation_type text not null check(allocation_type in('principal','investor_interest','company_revenue','late_fee','other')),
 amount numeric(14,2) not null, investor_user_id uuid, position_id uuid, created_at timestamptz not null default now());

create table if not exists public.investor_positions(
 id uuid primary key default gen_random_uuid(), loan_number bigint not null, investor_user_id uuid not null,
 original_principal numeric(14,2) not null, current_principal numeric(14,2) not null, acquired_at timestamptz not null default now(),
 source text not null default 'primary', status text not null default 'active', unique(id,loan_number));

create table if not exists public.investor_distributions(
 id uuid primary key default gen_random_uuid(), distribution_number bigint unique not null default floor(random()*900000+100000)::bigint,
 borrower_payment_id uuid not null references public.borrower_payments(id), loan_number bigint not null, investor_user_id uuid not null,
 principal_amount numeric(14,2) not null default 0, interest_amount numeric(14,2) not null default 0,
 status text not null default 'pending' check(status in('pending','available','paid','held','reversed')),
 created_at timestamptz not null default now(), available_at timestamptz);

create table if not exists public.secondary_market_listings(
 id uuid primary key default gen_random_uuid(), listing_number bigint unique not null default floor(random()*900000+100000)::bigint,
 loan_number bigint not null, seller_user_id uuid not null, position_id uuid not null references public.investor_positions(id),
 principal_offered numeric(14,2) not null check(principal_offered>0), asking_price numeric(14,2) not null check(asking_price>0),
 principal_remaining numeric(14,2) not null, status text not null default 'open' check(status in('open','reserved','partial','sold','cancelled','expired','ineligible')),
 expires_at timestamptz, created_at timestamptz not null default now());
create table if not exists public.secondary_market_trades(
 id uuid primary key default gen_random_uuid(), trade_number bigint unique not null default floor(random()*900000+100000)::bigint,
 listing_id uuid not null references public.secondary_market_listings(id), loan_number bigint not null, seller_user_id uuid not null, buyer_user_id uuid not null,
 principal_amount numeric(14,2) not null, purchase_price numeric(14,2) not null, status text not null default 'pending' check(status in('pending','settled','failed','reversed')),
 idempotency_key text unique not null, created_at timestamptz not null default now(), settled_at timestamptz);

create table if not exists public.financial_exceptions(
 id uuid primary key default gen_random_uuid(), loan_number bigint, severity text not null default 'warning', exception_type text not null,
 source text, source_reference text, expected_amount numeric(14,2), actual_amount numeric(14,2), status text not null default 'open',
 details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid);

create table if not exists public.loan_notices(
 id uuid primary key default gen_random_uuid(), notice_number bigint unique not null default floor(random()*900000+100000)::bigint,
 loan_number bigint not null, recipient_user_id uuid, recipient_role text not null check(recipient_role in('borrower','investor','admin')),
 notice_type text not null, subject text not null, body text not null, delivery_channel text not null default 'in_app',
 status text not null default 'queued' check(status in('queued','sent','delivered','failed','read')),
 created_at timestamptz not null default now(), sent_at timestamptz, read_at timestamptz);

create table if not exists public.loan_servicing_events(
 id uuid primary key default gen_random_uuid(), loan_number bigint not null, event_type text not null, event_date timestamptz not null default now(),
 amount numeric(14,2), details jsonb not null default '{}'::jsonb, created_by uuid);

create or replace view public.admin_servicing_summary as
select l.loan_number,
 coalesce(sum(s.expected_total),0)::numeric(14,2) expected_total,
 coalesce(sum(s.collected_principal+s.collected_interest),0)::numeric(14,2) collected_total,
 coalesce(sum(greatest(s.expected_total-(s.collected_principal+s.collected_interest),0)),0)::numeric(14,2) outstanding_total,
 count(*) filter(where s.status in('late','missed')) overdue_installments,
 min(s.due_date) filter(where s.status in('upcoming','due','partial','late','missed')) next_due_date
from public.loan_applications l left join public.loan_payment_schedule s on s.loan_number=l.loan_number group by l.loan_number;

commit;
-- Atomic servicing helpers (run after base objects above)
create or replace function public.generate_payment_schedule_v4(p_loan_number bigint, p_first_due date default (current_date+interval '1 month')::date)
returns integer language plpgsql security definer set search_path=public as $$
declare l record; r numeric; pmt numeric; bal numeric; ip numeric; pp numeric; i int; due date; begin
 select loan_amount,coalesce(borrower_interest_rate,10) rate,coalesce(repayment_term_months,12) months into l from loan_applications where loan_number=p_loan_number;
 if not found then raise exception 'Loan % not found',p_loan_number; end if;
 delete from loan_payment_schedule where loan_number=p_loan_number;
 r:=l.rate/100/12; bal:=l.loan_amount; pmt:=case when r=0 then bal/l.months else bal*r/(1-power(1+r,-l.months)) end; due:=p_first_due;
 for i in 1..l.months loop ip:=round(bal*r,2); pp:=case when i=l.months then bal else least(round(pmt-ip,2),bal) end; insert into loan_payment_schedule(loan_number,installment_number,due_date,expected_principal,expected_interest,status) values(p_loan_number,i,due,pp,ip,'upcoming'); bal:=greatest(bal-pp,0); due:=(due+interval '1 month')::date; end loop; return l.months; end $$;

create or replace function public.mark_due_payments_v4()
returns integer language plpgsql security definer set search_path=public as $$ declare n int; begin
 update loan_payment_schedule set status=case when due_date<current_date then 'missed' when due_date=current_date then 'due' else status end where status in('upcoming','due','late') and due_date<=current_date; get diagnostics n=row_count; return n; end $$;

create or replace function public.settle_borrower_payment_v4(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p borrower_payments%rowtype; s loan_payment_schedule%rowtype; remaining numeric; principal numeric; interest numeric; pos record; total_pos numeric; share numeric; begin
 select * into p from borrower_payments where id=p_payment_id for update; if not found then raise exception 'Payment not found'; end if;
 if p.status='settled' then return jsonb_build_object('ok',true,'duplicate',true); end if;
 select * into s from loan_payment_schedule where id=p.schedule_id for update; if not found then raise exception 'Schedule installment not found'; end if;
 remaining:=p.amount; interest:=least(remaining,greatest(s.expected_interest-s.collected_interest,0)); remaining:=remaining-interest; principal:=least(remaining,greatest(s.expected_principal-s.collected_principal,0));
 update loan_payment_schedule set collected_interest=collected_interest+interest,collected_principal=collected_principal+principal,status=case when collected_interest+interest+collected_principal+principal>=expected_total then 'paid' else 'partial' end,paid_at=case when collected_interest+interest+collected_principal+principal>=expected_total then now() else paid_at end where id=s.id;
 insert into payment_allocations(borrower_payment_id,loan_number,allocation_type,amount) values(p.id,p.loan_number,'principal',principal),(p.id,p.loan_number,'investor_interest',interest);
 select coalesce(sum(current_principal),0) into total_pos from investor_positions where loan_number=p.loan_number and status='active';
 if total_pos>0 then for pos in select * from investor_positions where loan_number=p.loan_number and status='active' loop share:=pos.current_principal/total_pos; insert into investor_distributions(borrower_payment_id,loan_number,investor_user_id,principal_amount,interest_amount,status,available_at) values(p.id,p.loan_number,pos.investor_user_id,round(principal*share,2),round(interest*share,2),'available',now()); end loop; end if;
 update borrower_payments set status='settled',settled_at=now() where id=p.id; return jsonb_build_object('ok',true,'principal',principal,'interest',interest); end $$;
