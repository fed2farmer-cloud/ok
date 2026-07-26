-- SecuredLanding v3.2.3 — targeted borrower-signature RPC repair
-- Purpose: create public.ensure_borrower_signature_requests(bigint)
-- for the deployed schema where loan/document IDs are bigint.
-- Safe to run more than once. This script intentionally does not wrap the
-- whole repair in one transaction, so a later optional policy issue cannot
-- roll back the RPC itself.

create extension if not exists pgcrypto;

-- 1) Confirm the parent tables and bigint IDs used by this deployment.
do $$
declare
  v_loan_id_type text;
  v_document_id_type text;
begin
  select data_type into v_loan_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'loan_applications'
    and column_name = 'id';

  select data_type into v_document_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'generated_loan_documents'
    and column_name = 'id';

  if v_loan_id_type is null then
    raise exception 'Missing public.loan_applications.id';
  end if;

  if v_document_id_type is null then
    raise exception 'Missing public.generated_loan_documents.id';
  end if;

  if v_loan_id_type <> 'bigint' then
    raise exception 'Expected loan_applications.id bigint; found %', v_loan_id_type;
  end if;

  if v_document_id_type <> 'bigint' then
    raise exception 'Expected generated_loan_documents.id bigint; found %', v_document_id_type;
  end if;
end $$;

-- 2) Add only the generated-document fields the RPC needs.
alter table public.generated_loan_documents
  add column if not exists signature_status text not null default 'not_required',
  add column if not exists signature_required boolean not null default false,
  add column if not exists document_version text not null default '1',
  add column if not exists document_hash text,
  add column if not exists locked_after_signature boolean not null default true,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

-- 3) Create/repair the request table using bigint foreign keys.
create table if not exists public.document_signature_requests (
  id uuid primary key default gen_random_uuid(),
  generated_document_id bigint not null
    references public.generated_loan_documents(id) on delete cascade,
  loan_application_id bigint not null
    references public.loan_applications(id) on delete cascade,
  signer_user_id uuid not null
    references auth.users(id) on delete cascade,
  signer_role text not null default 'borrower',
  status text not null default 'pending',
  expires_at timestamptz,
  requested_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Repair missing request-table columns if a partial earlier migration created it.
alter table public.document_signature_requests
  add column if not exists generated_document_id bigint,
  add column if not exists loan_application_id bigint,
  add column if not exists signer_user_id uuid,
  add column if not exists signer_role text not null default 'borrower',
  add column if not exists status text not null default 'pending',
  add column if not exists expires_at timestamptz,
  add column if not exists requested_by uuid,
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists viewed_at timestamptz,
  add column if not exists signed_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists decline_reason text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Fail clearly if an old incompatible UUID version of this table still exists.
do $$
declare
  v_generated_type text;
  v_loan_type text;
begin
  select data_type into v_generated_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'document_signature_requests'
    and column_name = 'generated_document_id';

  select data_type into v_loan_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'document_signature_requests'
    and column_name = 'loan_application_id';

  if v_generated_type <> 'bigint' or v_loan_type <> 'bigint' then
    raise exception
      'document_signature_requests has incompatible ID types (generated_document_id %, loan_application_id %). Run RESET_PARTIAL_TABLES.sql, then rerun this migration.',
      v_generated_type, v_loan_type;
  end if;
end $$;

create unique index if not exists document_signature_requests_unique_signer
  on public.document_signature_requests
  (generated_document_id, signer_user_id, signer_role);

create index if not exists document_signature_requests_loan_idx
  on public.document_signature_requests (loan_application_id);

create index if not exists document_signature_requests_signer_idx
  on public.document_signature_requests (signer_user_id, status);

-- 4) Create the exact RPC name and argument expected by ClosingCenter.tsx.
create or replace function public.ensure_borrower_signature_requests(
  p_loan_application_id bigint
)
returns setof public.document_signature_requests
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_borrower_user_id uuid;
  v_is_admin boolean := false;
  v_document record;
  v_request public.document_signature_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- admin_users is optional for borrower use. Only consult it when present.
  if to_regclass('public.admin_users') is not null then
    execute 'select exists (select 1 from public.admin_users where user_id = $1)'
      into v_is_admin
      using auth.uid();
  end if;

  select la.user_id
    into v_borrower_user_id
  from public.loan_applications la
  where la.id = p_loan_application_id
    and (la.user_id = auth.uid() or v_is_admin)
  limit 1;

  if v_borrower_user_id is null then
    raise exception 'Loan not found or access denied';
  end if;

  for v_document in
    select g.id
    from public.generated_loan_documents g
    where g.loan_application_id = p_loan_application_id
    order by g.id
  loop
    update public.generated_loan_documents
       set signature_required = true,
           signature_status = case
             when signed_at is not null then 'signed'
             else 'ready_for_signature'
           end,
           status = case
             when signed_at is not null then status
             else 'ready_for_signature'
           end,
           updated_at = now()
     where id = v_document.id;

    insert into public.document_signature_requests (
      generated_document_id,
      loan_application_id,
      signer_user_id,
      signer_role,
      status,
      requested_by
    ) values (
      v_document.id,
      p_loan_application_id,
      v_borrower_user_id,
      'borrower',
      'pending',
      auth.uid()
    )
    on conflict (generated_document_id, signer_user_id, signer_role)
    do update set
      updated_at = now(),
      requested_by = coalesce(
        public.document_signature_requests.requested_by,
        excluded.requested_by
      )
    returning * into v_request;

    return next v_request;
  end loop;

  return;
end;
$$;

revoke all on function public.ensure_borrower_signature_requests(bigint) from public;
grant execute on function public.ensure_borrower_signature_requests(bigint) to authenticated;
grant execute on function public.ensure_borrower_signature_requests(bigint) to service_role;

-- 5) Permit borrowers to read their own generated requests.
alter table public.document_signature_requests enable row level security;

drop policy if exists "borrower reads own signature requests" on public.document_signature_requests;
create policy "borrower reads own signature requests"
on public.document_signature_requests
for select to authenticated
using (
  signer_user_id = auth.uid()
  or (
    to_regclass('public.admin_users') is not null
    and exists (
      select 1 from public.admin_users a where a.user_id = auth.uid()
    )
  )
);

grant select on public.document_signature_requests to authenticated;

-- 6) Force PostgREST/Supabase API to discover the new function.
notify pgrst, 'reload schema';

-- 7) Final verification: this must return one row.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'ensure_borrower_signature_requests';
