begin;

alter table public.loan_applications
  add column if not exists requested_loan_amount numeric,
  add column if not exists approved_loan_amount numeric,
  add column if not exists counteroffer_status text,
  add column if not exists counteroffer_sent_at timestamptz,
  add column if not exists counteroffer_responded_at timestamptz,
  add column if not exists counteroffer_admin_notes text,
  add column if not exists revision_status text,
  add column if not exists revision_requested_at timestamptz,
  add column if not exists revision_requested_by uuid,
  add column if not exists revision_submitted_at timestamptz,
  add column if not exists revision_message text,
  add column if not exists revision_items jsonb default '[]'::jsonb,
  add column if not exists revision_count integer default 0;

update public.loan_applications
set requested_loan_amount = loan_amount
where requested_loan_amount is null;

create table if not exists public.loan_revision_requests (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null
    references public.loan_applications(id) on delete cascade,
  requested_by uuid,
  message text,
  requested_items jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  borrower_submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid
);

create index if not exists loan_revision_requests_loan_idx
  on public.loan_revision_requests (loan_application_id, requested_at desc);

create table if not exists public.loan_counteroffers (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null
    references public.loan_applications(id) on delete cascade,
  requested_amount numeric not null,
  proposed_amount numeric not null,
  land_value numeric not null,
  proposed_ltv numeric not null,
  borrower_interest_rate numeric,
  repayment_term_months integer,
  admin_notes text,
  status text not null default 'pending_borrower_acceptance',
  created_by uuid,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists loan_counteroffers_loan_idx
  on public.loan_counteroffers (loan_application_id, created_at desc);

alter table public.loan_counteroffers
  drop constraint if exists loan_counteroffers_fifty_percent_ltv_check;

alter table public.loan_counteroffers
  add constraint loan_counteroffers_fifty_percent_ltv_check
  check (
    land_value > 0
    and proposed_amount > 0
    and proposed_amount <= land_value * 0.50
    and proposed_ltv <= 50.0001
  );

create or replace function public.enforce_loan_fifty_percent_ltv()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('Approved', 'Funded')
     and coalesce(new.land_value, 0) > 0
     and coalesce(new.loan_amount, 0) > new.land_value * 0.50 then
    raise exception
      'Approved loan amount % exceeds the 50 percent LTV maximum of %',
      new.loan_amount,
      new.land_value * 0.50;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_loan_fifty_percent_ltv_trigger
  on public.loan_applications;

create trigger enforce_loan_fifty_percent_ltv_trigger
before insert or update of status, loan_amount, land_value
on public.loan_applications
for each row
execute function public.enforce_loan_fifty_percent_ltv();

notify pgrst, 'reload schema';

commit;
