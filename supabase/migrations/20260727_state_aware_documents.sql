begin;

alter table public.generated_loan_documents
  add column if not exists document_state text,
  add column if not exists template_version text,
  add column if not exists generated_at timestamptz default now();

alter table public.generated_loan_documents
  drop constraint if exists generated_loan_documents_state_check;

alter table public.generated_loan_documents
  add constraint generated_loan_documents_state_check
  check (
    document_state is null
    or document_state in (
      'CA','TX','AZ','NV','WA','OR',
      'CO','UT','VA','NC','AR','MO'
    )
  );

create index if not exists generated_loan_documents_state_idx
  on public.generated_loan_documents
  (loan_application_id, document_state);

-- Backfill state metadata from the collateral property's loan application.
-- Existing titles are intentionally not rewritten here; use the admin
-- regeneration action after installing the frontend patch.
update public.generated_loan_documents gd
set
  document_state = upper(trim(la.state)),
  template_version = coalesce(
    gd.template_version,
    upper(trim(la.state)) || '-2026.1'
  ),
  generated_at = coalesce(gd.generated_at, gd.created_at, now())
from public.loan_applications la
where gd.loan_application_id = la.id
  and upper(trim(la.state)) in (
    'CA','TX','AZ','NV','WA','OR',
    'CO','UT','VA','NC','AR','MO'
  )
  and (
    gd.document_state is null
    or gd.template_version is null
  );

-- Database guard: prevent a generated document from being saved with a
-- state different from the collateral property state.
create or replace function public.enforce_generated_document_property_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_state text;
begin
  select upper(trim(state))
  into expected_state
  from public.loan_applications
  where id = new.loan_application_id;

  if expected_state is null or expected_state = '' then
    raise exception
      'Loan application % has no property state',
      new.loan_application_id;
  end if;

  if expected_state not in (
    'CA','TX','AZ','NV','WA','OR',
    'CO','UT','VA','NC','AR','MO'
  ) then
    raise exception
      'Unsupported property state % for loan application %',
      expected_state,
      new.loan_application_id;
  end if;

  if new.document_state is null or trim(new.document_state) = '' then
    new.document_state := expected_state;
  end if;

  new.document_state := upper(trim(new.document_state));

  if new.document_state <> expected_state then
    raise exception
      'Document state % does not match property state % for loan application %',
      new.document_state,
      expected_state,
      new.loan_application_id;
  end if;

  new.generated_at := coalesce(new.generated_at, now());
  return new;
end;
$$;

drop trigger if exists enforce_generated_document_property_state_trigger
  on public.generated_loan_documents;

create trigger enforce_generated_document_property_state_trigger
before insert or update of loan_application_id, document_state
on public.generated_loan_documents
for each row
execute function public.enforce_generated_document_property_state();

notify pgrst, 'reload schema';

commit;
