-- SecuredLanding v4.5.9 — Closing document sync + Manual/Test notarization
-- Safe to rerun.
--
-- Goals:
--   1) When every required generated closing document is signed, automatically
--      complete BOTH "Review generated loan documents" and "Sign closing documents".
--   2) Keep the Proof API integration installed but allow a secure admin-only
--      Manual/Test notarization path while Proof API access is not subscribed.
--   3) Keep notarization and county recording as independent closing requirements.

alter table public.proof_notary_transactions
  add column if not exists manual_mode boolean not null default false,
  add column if not exists manual_status text not null default 'not_started',
  add column if not exists manual_scheduled_at timestamptz,
  add column if not exists manual_completed_at timestamptz,
  add column if not exists manual_document_path text,
  add column if not exists manual_document_name text,
  add column if not exists manual_notes text,
  add column if not exists manual_updated_by uuid references auth.users(id),
  add column if not exists manual_updated_at timestamptz;

alter table public.proof_notary_transactions
  drop constraint if exists proof_notary_transactions_manual_status_check;

alter table public.proof_notary_transactions
  add constraint proof_notary_transactions_manual_status_check
  check (manual_status in ('not_started','scheduled','completed','cancelled'));

insert into storage.buckets (id, name, public)
values ('notarized-loan-documents', 'notarized-loan-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Admins read notarized loan documents" on storage.objects;
create policy "Admins read notarized loan documents"
on storage.objects for select to authenticated
using (bucket_id = 'notarized-loan-documents' and public.is_secured_landing_admin());

drop policy if exists "Admins upload notarized loan documents" on storage.objects;
create policy "Admins upload notarized loan documents"
on storage.objects for insert to authenticated
with check (bucket_id = 'notarized-loan-documents' and public.is_secured_landing_admin());

drop policy if exists "Admins update notarized loan documents" on storage.objects;
create policy "Admins update notarized loan documents"
on storage.objects for update to authenticated
using (bucket_id = 'notarized-loan-documents' and public.is_secured_landing_admin())
with check (bucket_id = 'notarized-loan-documents' and public.is_secured_landing_admin());

drop policy if exists "Admins delete notarized loan documents" on storage.objects;
create policy "Admins delete notarized loan documents"
on storage.objects for delete to authenticated
using (bucket_id = 'notarized-loan-documents' and public.is_secured_landing_admin());

create or replace function public.sync_closing_document_tasks(p_loan_application_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required integer := 0;
  v_signed integer := 0;
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.loan_applications
  where id = p_loan_application_id;

  if v_user_id is null then
    raise exception 'Loan not found';
  end if;

  -- Direct calls are restricted to the borrower who owns the loan or an admin.
  -- auth.uid() is NULL during trusted migration/trigger execution and is allowed.
  if auth.uid() is not null
     and auth.uid() <> v_user_id
     and not public.is_secured_landing_admin() then
    raise exception 'Access denied';
  end if;

  select
    count(*) filter (where coalesce(signature_required, true)),
    count(*) filter (
      where coalesce(signature_required, true)
        and (signed_at is not null or lower(coalesce(signature_status,'')) = 'signed')
    )
  into v_required, v_signed
  from public.generated_loan_documents
  where loan_application_id = p_loan_application_id;

  if v_required > 0 and v_signed >= v_required then
    update public.closing_tasks
    set status = 'complete', completed_at = coalesce(completed_at, now())
    where loan_application_id = p_loan_application_id
      and task_key in ('loan_documents','signatures')
      and status <> 'waived';

    update public.loan_closings
    set progress_percent = greatest(coalesce(progress_percent, 0), 55),
        updated_at = now()
    where loan_application_id = p_loan_application_id;
  elsif v_required > 0 then
    update public.closing_tasks
    set status = case when task_key = 'loan_documents' then 'submitted' else 'pending' end,
        completed_at = null
    where loan_application_id = p_loan_application_id
      and task_key in ('loan_documents','signatures')
      and status not in ('waived','blocked');
  else
    update public.closing_tasks
    set status = 'pending', completed_at = null
    where loan_application_id = p_loan_application_id
      and task_key in ('loan_documents','signatures')
      and status not in ('waived','blocked');
  end if;
end;
$$;

grant execute on function public.sync_closing_document_tasks(bigint) to authenticated;

create or replace function public.trigger_sync_closing_document_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan_application_id bigint;
begin
  if tg_op = 'DELETE' then
    v_loan_application_id := old.loan_application_id;
  else
    v_loan_application_id := new.loan_application_id;
  end if;

  perform public.sync_closing_document_tasks(v_loan_application_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists document_signature_requests_closing_sync on public.document_signature_requests;
create trigger document_signature_requests_closing_sync
after insert or update or delete
on public.document_signature_requests
for each row execute function public.trigger_sync_closing_document_tasks();

drop trigger if exists generated_loan_documents_closing_sync on public.generated_loan_documents;
create trigger generated_loan_documents_closing_sync
after insert or update or delete
on public.generated_loan_documents
for each row execute function public.trigger_sync_closing_document_tasks();

create or replace function public.admin_update_manual_notary(
  p_loan_application_id bigint,
  p_manual_status text,
  p_scheduled_at timestamptz default null,
  p_notes text default null,
  p_document_path text default null,
  p_document_name text default null
)
returns public.proof_notary_transactions
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_borrower_user_id uuid;
  v_row public.proof_notary_transactions%rowtype;
begin
  if not public.is_secured_landing_admin() then
    raise exception 'Admin access required';
  end if;

  if p_manual_status not in ('not_started','scheduled','completed','cancelled') then
    raise exception 'Invalid manual notarization status';
  end if;

  select user_id into v_borrower_user_id
  from public.loan_applications
  where id = p_loan_application_id;

  if v_borrower_user_id is null then
    raise exception 'Loan not found or borrower account missing';
  end if;

  insert into public.proof_notary_transactions (
    loan_application_id,
    borrower_user_id,
    provider,
    environment,
    status,
    manual_mode,
    manual_status,
    manual_scheduled_at,
    manual_completed_at,
    manual_document_path,
    manual_document_name,
    manual_notes,
    manual_updated_by,
    manual_updated_at,
    updated_at
  ) values (
    p_loan_application_id,
    v_borrower_user_id,
    'proof',
    'fairfax',
    case p_manual_status
      when 'scheduled' then 'manual_scheduled'
      when 'completed' then 'manual_completed'
      when 'cancelled' then 'manual_cancelled'
      else 'not_started'
    end,
    true,
    p_manual_status,
    case when p_manual_status = 'scheduled' then coalesce(p_scheduled_at, now()) else p_scheduled_at end,
    case when p_manual_status = 'completed' then now() else null end,
    p_document_path,
    p_document_name,
    p_notes,
    auth.uid(),
    now(),
    now()
  )
  on conflict (loan_application_id) do update set
    manual_mode = true,
    manual_status = excluded.manual_status,
    manual_scheduled_at = case
      when excluded.manual_status = 'scheduled' then coalesce(excluded.manual_scheduled_at, proof_notary_transactions.manual_scheduled_at, now())
      when excluded.manual_status = 'not_started' then null
      else proof_notary_transactions.manual_scheduled_at
    end,
    manual_completed_at = case
      when excluded.manual_status = 'completed' then coalesce(proof_notary_transactions.manual_completed_at, now())
      else null
    end,
    manual_document_path = coalesce(excluded.manual_document_path, proof_notary_transactions.manual_document_path),
    manual_document_name = coalesce(excluded.manual_document_name, proof_notary_transactions.manual_document_name),
    manual_notes = excluded.manual_notes,
    manual_updated_by = auth.uid(),
    manual_updated_at = now(),
    status = excluded.status,
    last_error = null,
    updated_at = now()
  returning * into v_row;

  update public.closing_tasks
  set status = case p_manual_status
      when 'completed' then 'complete'
      when 'scheduled' then 'submitted'
      when 'cancelled' then 'pending'
      else 'pending'
    end,
    completed_at = case when p_manual_status = 'completed' then coalesce(completed_at, now()) else null end
  where loan_application_id = p_loan_application_id
    and task_key = 'online_notary';

  -- IMPORTANT: county_recording is intentionally NOT changed here.
  if p_manual_status in ('scheduled','completed') then
    insert into public.loan_timeline_events (loan_application_id, event_key, title, description, actor_user_id)
    values (
      p_loan_application_id,
      case when p_manual_status = 'completed' then 'manual_notary_completed' else 'manual_notary_scheduled' end,
      case when p_manual_status = 'completed' then 'Manual notarization completed' else 'Manual notarization scheduled' end,
      case when p_manual_status = 'completed'
        then 'The remote/manual notarization step was marked complete. County recording remains separate.'
        else 'A manual notarization appointment was scheduled while Proof API automation is inactive.'
      end,
      auth.uid()
    );
  end if;

  return v_row;
end;
$$;

grant execute on function public.admin_update_manual_notary(bigint,text,timestamptz,text,text,text) to authenticated;

-- Repair existing closings immediately, including legacy loans whose signature
-- rows were completed before automatic task synchronization existed.
do $$
declare
  r record;
begin
  for r in select loan_application_id from public.loan_closings loop
    perform public.sync_closing_document_tasks(r.loan_application_id);
  end loop;
end;
$$;

comment on column public.proof_notary_transactions.manual_mode is
'When true, notarization is being tracked manually while Proof API automation is unavailable or intentionally bypassed.';
comment on column public.proof_notary_transactions.manual_document_path is
'Private storage path of the completed notarized PDF. County recording remains a separate task.';
