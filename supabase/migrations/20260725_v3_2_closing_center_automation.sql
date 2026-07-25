-- SecuredLanding v3.2 Closing Center Automation
-- Fixes v3.1 bigint loan ID compatibility and creates borrower signature requests.
create extension if not exists pgcrypto;

alter table public.generated_loan_documents
  add column if not exists signature_status text not null default 'not_required',
  add column if not exists signature_required boolean not null default false,
  add column if not exists document_version text not null default '1',
  add column if not exists document_hash text,
  add column if not exists locked_after_signature boolean not null default true,
  add column if not exists signed_by uuid references auth.users(id);

create table if not exists public.document_signature_requests (
  id uuid primary key default gen_random_uuid(),
  generated_document_id uuid not null references public.generated_loan_documents(id) on delete cascade,
  loan_application_id bigint not null references public.loan_applications(id) on delete cascade,
  signer_user_id uuid not null references auth.users(id) on delete cascade,
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
  signature_request_id uuid not null unique references public.document_signature_requests(id) on delete cascade,
  generated_document_id uuid not null references public.generated_loan_documents(id) on delete cascade,
  loan_application_id bigint not null references public.loan_applications(id) on delete cascade,
  signer_user_id uuid not null references auth.users(id) on delete cascade,
  signer_legal_name text not null,
  signature_method text not null check (signature_method in ('typed','drawn')),
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
  signature_request_id uuid references public.document_signature_requests(id) on delete set null,
  generated_document_id uuid references public.generated_loan_documents(id) on delete set null,
  loan_application_id bigint references public.loan_applications(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_details jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.document_signature_requests enable row level security;
alter table public.document_signatures enable row level security;
alter table public.signature_audit_events enable row level security;

drop policy if exists "borrower reads own signature requests" on public.document_signature_requests;
create policy "borrower reads own signature requests" on public.document_signature_requests
for select to authenticated using (signer_user_id=auth.uid() or public.is_secured_landing_admin());

drop policy if exists "borrower reads own signatures" on public.document_signatures;
create policy "borrower reads own signatures" on public.document_signatures
for select to authenticated using (signer_user_id=auth.uid() or public.is_secured_landing_admin());

drop policy if exists "borrower reads own signature audit" on public.signature_audit_events;
create policy "borrower reads own signature audit" on public.signature_audit_events
for select to authenticated using (actor_user_id=auth.uid() or public.is_secured_landing_admin());

create or replace function public.ensure_borrower_signature_requests(p_loan_application_id bigint)
returns setof public.document_signature_requests
language plpgsql security definer set search_path=public as $$
declare v_user uuid; v_doc record; v_req public.document_signature_requests%rowtype;
begin
  select user_id into v_user from public.loan_applications
  where id=p_loan_application_id and (user_id=auth.uid() or public.is_secured_landing_admin());
  if v_user is null then raise exception 'Loan not found or access denied'; end if;

  for v_doc in select id, document_type from public.generated_loan_documents where loan_application_id=p_loan_application_id loop
    update public.generated_loan_documents set
      signature_required=true,
      signature_status=case when signed_at is not null then 'signed' else 'ready_for_signature' end,
      status=case when signed_at is not null then status else 'ready_for_signature' end,
      updated_at=now()
    where id=v_doc.id;

    insert into public.document_signature_requests(generated_document_id,loan_application_id,signer_user_id,signer_role,status,requested_by)
    values(v_doc.id,p_loan_application_id,v_user,'borrower','pending',auth.uid())
    on conflict(generated_document_id,signer_user_id,signer_role) do update set
      status=case when document_signature_requests.status='signed' then 'signed' else document_signature_requests.status end,
      updated_at=now()
    returning * into v_req;
    return next v_req;
  end loop;
end; $$;

create or replace function public.mark_signature_request_viewed(p_signature_request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r public.document_signature_requests%rowtype;
begin
 select * into r from public.document_signature_requests where id=p_signature_request_id and signer_user_id=auth.uid();
 if not found then raise exception 'Signature request not found'; end if;
 if r.status='pending' then update public.document_signature_requests set status='viewed',viewed_at=coalesce(viewed_at,now()),updated_at=now() where id=r.id; end if;
 insert into public.signature_audit_events(signature_request_id,generated_document_id,loan_application_id,actor_user_id,event_type)
 values(r.id,r.generated_document_id,r.loan_application_id,auth.uid(),'document_viewed');
end; $$;

create or replace function public.complete_document_signature(
 p_signature_request_id uuid,p_signer_legal_name text,p_signature_method text,p_typed_signature text,
 p_drawn_signature_data_url text,p_consent_version text,p_consent_text_hash text,p_document_hash text default null,p_user_agent text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare r public.document_signature_requests%rowtype; sid uuid; remaining int;
begin
 select * into r from public.document_signature_requests where id=p_signature_request_id and signer_user_id=auth.uid() for update;
 if not found then raise exception 'Signature request not found'; end if;
 if r.status not in ('pending','viewed') then raise exception 'Document is not available for signing'; end if;
 if nullif(trim(p_signer_legal_name),'') is null then raise exception 'Legal name is required'; end if;
 if p_signature_method not in ('typed','drawn') then raise exception 'Invalid signature method'; end if;

 insert into public.document_signatures(signature_request_id,generated_document_id,loan_application_id,signer_user_id,signer_legal_name,signature_method,typed_signature,drawn_signature_data_url,consent_version,consent_text_hash,document_version,document_hash,user_agent)
 values(r.id,r.generated_document_id,r.loan_application_id,auth.uid(),trim(p_signer_legal_name),p_signature_method,nullif(trim(coalesce(p_typed_signature,'')),''),nullif(trim(coalesce(p_drawn_signature_data_url,'')),''),p_consent_version,p_consent_text_hash,coalesce((select document_version from public.generated_loan_documents where id=r.generated_document_id),'1'),p_document_hash,p_user_agent)
 returning id into sid;

 update public.document_signature_requests set status='signed',signed_at=now(),updated_at=now() where id=r.id;
 update public.generated_loan_documents set signature_status='signed',status='signed',signed_at=now(),signed_by=auth.uid(),document_hash=coalesce(p_document_hash,document_hash),updated_at=now() where id=r.generated_document_id;
 insert into public.signature_audit_events(signature_request_id,generated_document_id,loan_application_id,actor_user_id,event_type,event_details,user_agent)
 values(r.id,r.generated_document_id,r.loan_application_id,auth.uid(),'document_signed',jsonb_build_object('signature_method',p_signature_method,'signature_id',sid),p_user_agent);

 select count(*) into remaining from public.document_signature_requests where loan_application_id=r.loan_application_id and status<>'signed';
 if remaining=0 then
   update public.closing_tasks set status='completed',completed_at=now() where loan_application_id=r.loan_application_id and task_key='signatures';
   update public.loan_closings set progress_percent=greatest(coalesce(progress_percent,0),55),stage='investor_funding',updated_at=now() where loan_application_id=r.loan_application_id;
   insert into public.borrower_notifications(user_id,loan_application_id,title,message,notification_type)
   values(auth.uid(),r.loan_application_id,'Closing documents completed','All required closing documents have been signed. Your loan is moving to investor funding.','signatures_complete');
 end if;
 return sid;
end; $$;

grant execute on function public.ensure_borrower_signature_requests(bigint) to authenticated;
grant execute on function public.mark_signature_request_viewed(uuid) to authenticated;
grant execute on function public.complete_document_signature(uuid,text,text,text,text,text,text,text,text) to authenticated;

-- Prepare existing generated documents immediately.
update public.generated_loan_documents set signature_required=true,
 signature_status=case when signed_at is not null then 'signed' else 'ready_for_signature' end,
 status=case when signed_at is not null then status else 'ready_for_signature' end,
 updated_at=now();
