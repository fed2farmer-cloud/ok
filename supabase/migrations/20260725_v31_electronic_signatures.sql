-- SecuredLanding v3.1
-- Electronic signatures and closing-document workflow
-- Run in Supabase SQL Editor after reviewing in a staging environment.

create extension if not exists pgcrypto;

create table if not exists public.document_signature_requests (
  id uuid primary key default gen_random_uuid(),
  generated_document_id uuid not null references public.generated_loan_documents(id) on delete cascade,
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade,
  signer_user_id uuid not null references auth.users(id) on delete cascade,
  signer_role text not null default 'borrower'
    check (signer_role in ('borrower', 'investor', 'admin', 'witness', 'notary')),
  status text not null default 'pending'
    check (status in ('pending', 'viewed', 'signed', 'declined', 'expired', 'cancelled')),
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
  generated_document_id uuid not null
    references public.generated_loan_documents(id) on delete cascade,
  loan_application_id uuid not null
    references public.loan_applications(id) on delete cascade,
  signer_user_id uuid not null references auth.users(id) on delete cascade,
  signer_legal_name text not null,
  signature_method text not null
    check (signature_method in ('typed', 'drawn')),
  typed_signature text,
  drawn_signature_data_url text,
  consent_version text not null default 'v1',
  consent_accepted boolean not null default false,
  consent_text_hash text not null,
  document_version text not null default '1',
  document_hash text,
  ip_address inet,
  user_agent text,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (signature_method = 'typed' and typed_signature is not null)
    or
    (signature_method = 'drawn' and drawn_signature_data_url is not null)
  )
);

create table if not exists public.signature_audit_events (
  id bigint generated always as identity primary key,
  signature_request_id uuid
    references public.document_signature_requests(id) on delete set null,
  generated_document_id uuid
    references public.generated_loan_documents(id) on delete set null,
  loan_application_id uuid
    references public.loan_applications(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_details jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.generated_loan_documents
  add column if not exists signature_status text not null default 'not_required',
  add column if not exists signature_required boolean not null default false,
  add column if not exists document_version text not null default '1',
  add column if not exists document_hash text,
  add column if not exists locked_after_signature boolean not null default true,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_by uuid references auth.users(id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'generated_loan_documents_signature_status_check'
  ) then
    alter table public.generated_loan_documents
      add constraint generated_loan_documents_signature_status_check
      check (
        signature_status in (
          'not_required',
          'ready_for_signature',
          'partially_signed',
          'signed',
          'declined',
          'voided'
        )
      );
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_signature_request_updated_at
on public.document_signature_requests;

create trigger set_signature_request_updated_at
before update on public.document_signature_requests
for each row execute function public.set_updated_at();

create index if not exists idx_signature_requests_signer
  on public.document_signature_requests(signer_user_id, status);

create index if not exists idx_signature_requests_loan
  on public.document_signature_requests(loan_application_id, status);

create index if not exists idx_signature_audit_loan
  on public.signature_audit_events(loan_application_id, created_at desc);

alter table public.document_signature_requests enable row level security;
alter table public.document_signatures enable row level security;
alter table public.signature_audit_events enable row level security;

drop policy if exists "borrowers read own signature requests"
on public.document_signature_requests;

create policy "borrowers read own signature requests"
on public.document_signature_requests
for select
to authenticated
using (signer_user_id = auth.uid());

drop policy if exists "borrowers update own pending signature requests"
on public.document_signature_requests;

create policy "borrowers update own pending signature requests"
on public.document_signature_requests
for update
to authenticated
using (signer_user_id = auth.uid() and status in ('pending', 'viewed'))
with check (signer_user_id = auth.uid());

drop policy if exists "borrowers read own signatures"
on public.document_signatures;

create policy "borrowers read own signatures"
on public.document_signatures
for select
to authenticated
using (signer_user_id = auth.uid());

drop policy if exists "borrowers insert own signatures"
on public.document_signatures;

create policy "borrowers insert own signatures"
on public.document_signatures
for insert
to authenticated
with check (signer_user_id = auth.uid());

drop policy if exists "borrowers read own signature audit"
on public.signature_audit_events;

create policy "borrowers read own signature audit"
on public.signature_audit_events
for select
to authenticated
using (
  actor_user_id = auth.uid()
  or exists (
    select 1
    from public.loan_applications la
    where la.id = signature_audit_events.loan_application_id
      and la.user_id = auth.uid()
  )
);

create or replace function public.request_borrower_signature(
  p_generated_document_id uuid,
  p_expires_at timestamptz default null
)
returns public.document_signature_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.generated_loan_documents%rowtype;
  v_loan public.loan_applications%rowtype;
  v_request public.document_signature_requests%rowtype;
begin
  select *
  into v_doc
  from public.generated_loan_documents
  where id = p_generated_document_id;

  if not found then
    raise exception 'Generated document not found';
  end if;

  select *
  into v_loan
  from public.loan_applications
  where id = v_doc.loan_application_id;

  if not found or v_loan.user_id is null then
    raise exception 'Borrower account not found for this loan';
  end if;

  update public.generated_loan_documents
  set signature_required = true,
      signature_status = 'ready_for_signature'
  where id = v_doc.id;

  insert into public.document_signature_requests (
    generated_document_id,
    loan_application_id,
    signer_user_id,
    signer_role,
    status,
    expires_at,
    requested_by
  )
  values (
    v_doc.id,
    v_doc.loan_application_id,
    v_loan.user_id,
    'borrower',
    'pending',
    p_expires_at,
    auth.uid()
  )
  on conflict (generated_document_id, signer_user_id, signer_role)
  do update
  set status = 'pending',
      expires_at = excluded.expires_at,
      requested_by = excluded.requested_by,
      requested_at = now(),
      viewed_at = null,
      signed_at = null,
      declined_at = null,
      decline_reason = null,
      updated_at = now()
  returning * into v_request;

  insert into public.signature_audit_events (
    signature_request_id,
    generated_document_id,
    loan_application_id,
    actor_user_id,
    event_type
  )
  values (
    v_request.id,
    v_doc.id,
    v_doc.loan_application_id,
    auth.uid(),
    'signature_requested'
  );

  return v_request;
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
  select *
  into v_request
  from public.document_signature_requests
  where id = p_signature_request_id
    and signer_user_id = auth.uid();

  if not found then
    raise exception 'Signature request not found';
  end if;

  if v_request.status = 'pending' then
    update public.document_signature_requests
    set status = 'viewed',
        viewed_at = coalesce(viewed_at, now())
    where id = v_request.id;
  end if;

  insert into public.signature_audit_events (
    signature_request_id,
    generated_document_id,
    loan_application_id,
    actor_user_id,
    event_type
  )
  values (
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
begin
  select *
  into v_request
  from public.document_signature_requests
  where id = p_signature_request_id
    and signer_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Signature request not found';
  end if;

  if v_request.status not in ('pending', 'viewed') then
    raise exception 'Signature request is not available for signing';
  end if;

  if v_request.expires_at is not null and v_request.expires_at < now() then
    update public.document_signature_requests
    set status = 'expired'
    where id = v_request.id;

    raise exception 'Signature request has expired';
  end if;

  if nullif(trim(p_signer_legal_name), '') is null then
    raise exception 'Legal name is required';
  end if;

  if p_signature_method not in ('typed', 'drawn') then
    raise exception 'Invalid signature method';
  end if;

  if p_signature_method = 'typed'
     and nullif(trim(coalesce(p_typed_signature, '')), '') is null then
    raise exception 'Typed signature is required';
  end if;

  if p_signature_method = 'drawn'
     and nullif(trim(coalesce(p_drawn_signature_data_url, '')), '') is null then
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
    consent_accepted,
    consent_text_hash,
    document_version,
    document_hash,
    user_agent
  )
  values (
    v_request.id,
    v_request.generated_document_id,
    v_request.loan_application_id,
    auth.uid(),
    trim(p_signer_legal_name),
    p_signature_method,
    nullif(trim(coalesce(p_typed_signature, '')), ''),
    nullif(trim(coalesce(p_drawn_signature_data_url, '')), ''),
    coalesce(nullif(trim(p_consent_version), ''), 'v1'),
    true,
    p_consent_text_hash,
    (
      select document_version
      from public.generated_loan_documents
      where id = v_request.generated_document_id
    ),
    p_document_hash,
    p_user_agent
  )
  returning id into v_signature_id;

  update public.document_signature_requests
  set status = 'signed',
      signed_at = now()
  where id = v_request.id;

  update public.generated_loan_documents
  set signature_status = 'signed',
      signed_at = now(),
      signed_by = auth.uid(),
      document_hash = coalesce(p_document_hash, document_hash)
  where id = v_request.generated_document_id;

  update public.closing_tasks
  set status = 'completed',
      completed_at = now()
  where loan_application_id = v_request.loan_application_id
    and task_key in ('signatures', 'signatures_pending');

  insert into public.signature_audit_events (
    signature_request_id,
    generated_document_id,
    loan_application_id,
    actor_user_id,
    event_type,
    event_details,
    user_agent
  )
  values (
    v_request.id,
    v_request.generated_document_id,
    v_request.loan_application_id,
    auth.uid(),
    'document_signed',
    jsonb_build_object(
      'signature_method', p_signature_method,
      'consent_version', p_consent_version,
      'signature_id', v_signature_id
    ),
    p_user_agent
  );

  return v_signature_id;
end;
$$;

grant execute on function public.mark_signature_request_viewed(uuid)
to authenticated;

grant execute on function public.complete_document_signature(
  uuid, text, text, text, text, text, text, text, text
) to authenticated;

-- request_borrower_signature should normally be called only by trusted admin code.
revoke all on function public.request_borrower_signature(uuid, timestamptz)
from public, anon, authenticated;
