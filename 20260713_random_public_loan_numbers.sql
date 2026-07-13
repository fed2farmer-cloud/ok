-- Public six-digit loan numbers for Secured Landing.
-- Internal primary keys remain unchanged for relationships and security.

create or replace function public.generate_public_loan_number()
returns bigint
language plpgsql
volatile
as $$
declare
  candidate bigint;
begin
  -- Serialize number assignment so two simultaneous applications cannot choose the same candidate.
  perform pg_advisory_xact_lock(112781);

  loop
    candidate := floor(random() * (999999 - 112782 + 1) + 112782)::bigint;
    exit when not exists (
      select 1
      from public.loan_applications
      where loan_number = candidate
    );
  end loop;

  return candidate;
end;
$$;

alter table public.loan_applications
  add column if not exists loan_number bigint;

update public.loan_applications
set loan_number = public.generate_public_loan_number()
where loan_number is null
   or loan_number <= 112781
   or loan_number > 999999;

alter table public.loan_applications
  alter column loan_number set default public.generate_public_loan_number(),
  alter column loan_number set not null;

create unique index if not exists loan_applications_loan_number_uidx
  on public.loan_applications (loan_number);

comment on column public.loan_applications.loan_number is
  'Public-facing unique six-digit loan number between 112782 and 999999. Internal id remains the relational key.';

alter table public.marketplace_loans
  add column if not exists loan_number bigint;

update public.marketplace_loans ml
set loan_number = la.loan_number
from public.loan_applications la
where ml.loan_application_id::text = la.id::text
  and ml.loan_number is distinct from la.loan_number;

create index if not exists marketplace_loans_loan_number_idx
  on public.marketplace_loans (loan_number);
