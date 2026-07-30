begin;

-- SecuredLanding v3.4 Tax Administration hardening.
-- Safe to run after 20260729_v3_3_tax_center.sql.

create or replace function public.audit_tax_document_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.tax_document_audit (tax_document_id, actor_user_id, action, details)
    values (new.id, auth.uid(), 'created', jsonb_build_object('new', to_jsonb(new)));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.tax_document_audit (tax_document_id, actor_user_id, action, details)
    values (
      new.id,
      auth.uid(),
      case
        when new.status = 'corrected' and old.status is distinct from new.status then 'corrected'
        when new.status = 'voided' and old.status is distinct from new.status then 'voided'
        when new.status = 'available' and old.status is distinct from new.status then 'issued'
        else 'updated'
      end,
      jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
    );
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.tax_document_audit (tax_document_id, actor_user_id, action, details)
    values (old.id, auth.uid(), 'deleted', jsonb_build_object('old', to_jsonb(old)));
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists tax_documents_audit_trigger on public.tax_documents;
create trigger tax_documents_audit_trigger
after insert or update or delete on public.tax_documents
for each row execute function public.audit_tax_document_changes();

create or replace function public.set_tax_document_timestamps()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();

  if new.status = 'available' and new.issued_at is null then
    new.issued_at = now();
  end if;

  if new.status = 'corrected' and new.corrected_at is null then
    new.corrected_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists tax_documents_timestamp_trigger on public.tax_documents;
create trigger tax_documents_timestamp_trigger
before insert or update on public.tax_documents
for each row execute function public.set_tax_document_timestamps();

create index if not exists tax_documents_recipient_role_idx
  on public.tax_documents(recipient_role);

create index if not exists tax_documents_form_type_idx
  on public.tax_documents(form_type);

create index if not exists tax_documents_created_at_idx
  on public.tax_documents(created_at desc);

grant execute on function public.audit_tax_document_changes() to authenticated;
grant execute on function public.set_tax_document_timestamps() to authenticated;

notify pgrst, 'reload schema';
commit;
