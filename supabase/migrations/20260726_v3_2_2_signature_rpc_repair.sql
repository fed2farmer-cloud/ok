-- SecuredLanding v3.2.2 — Closing Center signature RPC repair
-- Repairs the failed v3.2 migration for databases where:
--   public.generated_loan_documents.id is bigint
--   public.loan_applications.id is bigint
-- Safe to run more than once.

begin;

create extension if not exists pgcrypto;

-- Verify the two parent ID types before creating foreign keys.
do $$
declare
  v_generated_id_type text;
  v_loan_id_type text;
begin
  select data_type into v_generated_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'generated_loan_documents'
    and column_name = 'id';

  select data_type into v_loan_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'loan_applications'
    and column_name = 'id';

  if v_generated_id_type is null then
    raise exception 'public.generated_loan_documents.id was not found';
  end if;
  if v_loan_id_type is null then
    raise exception 'public.loan_applications.id was not found';
  end if;
  if v_generated_id_type <> 'bigint' then
    raise exception 'Expected generated_loan_documents.id to be bigint, found %', v_generated_id_type;
  end if;
  if v_loan_id_type <> 'bigint' then
    raise exception 'Expected loan_applications.id to be bigint, found %', v_loan_id_type;
  end if;
end $$;

alter table public.generated_loan_documents
  add column if not exists signature_status text not null default 'not_required',
  add column if not exists signature_required boolean not null default false,
  add column if not exists document_version text not null default '1',
  add column if not exists document_hash text,
  add column if not exists locked_after_signature boolean not null default true,
  add column if not exists signed_by uuid references auth.users(id);

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
  updated_at timestamptz not null default now(),
  unique (generated_document_id, signer_user_id, signer_role)
);

create table if not exists public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  signature_request_id uuid not null unique
    references public.document_signature_requests(id) on delete cascade,
  generated_document_id bigint not null
    references public.generated_loan_documents(id) on delete cascade,
  loan_application_id bigint not null
    references public.loan_applications(id) on delete cascade,
  signer_user_id uuid not null
    references auth.users(id) on delete cascade,
  signer_legal_name text not null,
  signature_method text not null
    check (signature_method in ('typed', 'drawn')),
  typed_signature text,
  drawn_signature_data_url text,
  consent_version text not null default 'v1',
  consent_accepted boolean not null default true,
  consent_text_hash text not null,
  document_version text not null default '1',
  document_hash text,
  ip_address inet,
  user_agent text,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.signature_audit_events (
  id bigint generated always as identity primary key,
  signature_request_id uuid
    references public.document_signature_requests(id) on delete set null,
  generated_document_id bigint
    references public.generated_loan_documents(id) on delete set null,
  loan_application_id bigint
    references public.loan_applications(id) on delete set null,
  actor_user_id uuid
    references auth.users(id) on delete set null,
  event_type text not null,
  event_details jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists document_signature_requests_loan_idx
  on public.document_signature_requests (loan_application_id);
create index if not exists document_signature_requests_signer_idx
  on public.document_signature_requests (signer_user_id, status);
create index if not exists document_signatures_loan_idx
  on public.document_signatures (loan_application_id);
create index if not exists signature_audit_events_loan_idx
  on public.signature_audit_events (loan_application_id, created_at desc);

alter table public.document_signature_requests enable row level security;
alter table public.document_signatures enable row level security;
alter table public.signature_audit_events enable row level security;

-- Avoid depending on a project-specific admin helper inside RLS.
drop policy if exists "borrower reads own signature requests" on public.document_signature_requests;
create policy "borrower reads own signature requests"
on public.document_signature_requests
for select to authenticated
using (
  signer_user_id = auth.uid()
  or exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  )
);

drop policy if exists "borrower reads own signatures" on public.document_signatures;
create policy "borrower reads own signatures"
on public.document_signatures
for select to authenticated
using (
  signer_user_id = auth.uid()
  or exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  )
);

drop policy if exists "borrower reads own signature audit" on public.signature_audit_events;
create policy "borrower reads own signature audit"
on public.signature_audit_events
for select to authenticated
using (
  actor_user_id = auth.uid()
  or exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  )
);

create or replace function public.ensure_borrower_signature_requests(
  p_loan_application_id bigint
)
returns setof public.document_signature_requests
language plpgsql
security definer
set search_path = public
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

  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  ) into v_is_admin;

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
    update public.generated_loan_documents g
    set signature_required = true,
        signature_status = case
          when g.signed_at is not null then 'signed'
          else 'ready_for_signature'
        end,
        status = case
          when g.signed_at is not null then g.status
          else 'ready_for_signature'
        end,
        updated_at = now()
    where g.id = v_document.id;

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
      requested_by = coalesce(public.document_signature_requests.requested_by, excluded.requested_by)
    returning * into v_request;

    return next v_request;
  end loop;

  return;
end;
$$;

create or replace function public.mark_signature_request_viewed(
  p_signature_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.document_signature_requests%rowtype;
begin
  select * into v_request
  from public.document_signature_requests
  where id = p_signature_request_id
    and signer_user_id = auth.uid();

  if not found then
    raise exception 'Signature request not found';
  end if;

  if v_request.status = 'pending' then
    update public.document_signature_requests
    set status = 'viewed',
        viewed_at = coalesce(viewed_at, now()),
        updated_at = now()
    where id = v_request.id;
  end if;

  insert into public.signature_audit_events (
    signature_request_id,
    generated_document_id,
    loan_application_id,
    actor_user_id,
    event_type
  ) values (
    v_request.id,
    v_request.generated_document_id,
    v_request.loan_application_id,
    auth.uid(),
    'document_viewed'
  );
end;
$$;

create or replace function public.complete_document_signature(
  p_signature_request_id uuid,
  p_signer_legal_name text,
  p_signature_method text,
  p_typed_signature text,
  p_drawn_signature_data_url text,
  p_consent_version text,
  p_consent_text_hash text,
  p_document_hash text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.document_signature_requests%rowtype;
  v_signature_id uuid;
  v_remaining integer;
begin
  select * into v_request
  from public.document_signature_requests
  where id = p_signature_request_id
    and signer_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Signature request not found';
  end if;
  if v_request.status not in ('pending', 'viewed') then
    raise exception 'Document is not available for signing';
  end if;
  if nullif(trim(p_signer_legal_name), '') is null then
    raise exception 'Legal name is required';
  end if;
  if p_signature_method not in ('typed', 'drawn') then
    raise exception 'Invalid signature method';
  end if;
  if p_signature_method = 'typed' and nullif(trim(coalesce(p_typed_signature, '')), '') is null then
    raise exception 'Typed signature is required';
  end if;
  if p_signature_method = 'drawn' and nullif(trim(coalesce(p_drawn_signature_data_url, '')), '') is null then
    raise exception 'Drawn signature is required';
  end if;

  insert into public.document_signatures (
    signature_request_id,
    generated_document_id,
    loan_application_id,
    signer_user_id,
    signer_legal_name,
    signature_method,
    typed_signature,
    drawn_signature_data_url,
    consent_version,
    consent_text_hash,
    document_version,
    document_hash,
    user_agent
  ) values (
    v_request.id,
    v_request.generated_document_id,
    v_request.loan_application_id,
    auth.uid(),
    trim(p_signer_legal_name),
    p_signature_method,
    nullif(trim(coalesce(p_typed_signature, '')), ''),
    nullif(trim(coalesce(p_drawn_signature_data_url, '')), ''),
    coalesce(nullif(p_consent_version, ''), 'v1'),
    p_consent_text_hash,
    coalesce((
      select g.document_version
      from public.generated_loan_documents g
      where g.id = v_request.generated_document_id
    ), '1'),
    p_document_hash,
    p_user_agent
  ) returning id into v_signature_id;

  update public.document_signature_requests
  set status = 'signed',
      signed_at = now(),
      updated_at = now()
  where id = v_request.id;

  update public.generated_loan_documents
  set signature_status = 'signed',
      status = 'signed',
      signed_at = now(),
      signed_by = auth.uid(),
      document_hash = coalesce(p_document_hash, document_hash),
      updated_at = now()
  where id = v_request.generated_document_id;

  insert into public.signature_audit_events (
    signature_request_id,
    generated_document_id,
    loan_application_id,
    actor_user_id,
    event_type,
    event_details,
    user_agent
  ) values (
    v_request.id,
    v_request.generated_document_id,
    v_request.loan_application_id,
    auth.uid(),
    'document_signed',
    jsonb_build_object(
      'signature_method', p_signature_method,
      'signature_id', v_signature_id
    ),
    p_user_agent
  );

  select count(*) into v_remaining
  from public.document_signature_requests
  where loan_application_id = v_request.loan_application_id
    and status <> 'signed';

  -- These workflow tables may differ between installations, so update them only when present.
  if v_remaining = 0 then
    if to_regclass('public.closing_tasks') is not null then
      update public.closing_tasks
      set status = 'completed',
          completed_at = now()
      where loan_application_id = v_request.loan_application_id
        and task_key = 'signatures';
    end if;

    if to_regclass('public.loan_closings') is not null then
      update public.loan_closings
      set progress_percent = greatest(coalesce(progress_percent, 0), 55),
          stage = 'investor_funding',
          updated_at = now()
      where loan_application_id = v_request.loan_application_id;
    end if;

    -- Notification insert is intentionally omitted here because installations
    -- may have different borrower_notifications column definitions.
  end if;

  return v_signature_id;
end;
$$;

revoke all on function public.ensure_borrower_signature_requests(bigint) from public;
revoke all on function public.mark_signature_request_viewed(uuid) from public;
revoke all on function public.complete_document_signature(uuid,text,text,text,text,text,text,text,text) from public;

grant execute on function public.ensure_borrower_signature_requests(bigint) to authenticated;
grant execute on function public.mark_signature_request_viewed(uuid) to authenticated;
grant execute on function public.complete_document_signature(uuid,text,text,text,text,text,text,text,text) to authenticated;

grant select on public.document_signature_requests to authenticated;
grant select on public.document_signatures to authenticated;
grant select on public.signature_audit_events to authenticated;

-- Ask PostgREST to refresh its schema cache immediately.
notify pgrst, 'reload schema';

commit;

-- Expected verification result: one row with argument p_loan_application_id bigint.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'ensure_borrower_signature_requests';
