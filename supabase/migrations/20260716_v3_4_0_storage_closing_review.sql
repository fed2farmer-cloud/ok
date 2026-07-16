-- SecuredLanding v3.4.0
-- Creates required private buckets, repairs property-photo RLS across mixed ID types,
-- and enables administrator review of borrower-executed closing documents.

create or replace function public.is_secured_landing_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;

alter table public.generated_loan_documents
  add column if not exists signed_storage_path text,
  add column if not exists signed_uploaded_at timestamptz,
  add column if not exists signed_review_status text default 'not_uploaded',
  add column if not exists signed_reviewed_at timestamptz,
  add column if not exists signed_reviewed_by uuid,
  add column if not exists signed_admin_notes text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('signed-loan-documents','signed-loan-documents',false,26214400,array['application/pdf','image/jpeg','image/png','image/webp']),
  ('property-photos','property-photos',false,15728640,array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.generated_loan_documents enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='generated_loan_documents'
  loop execute format('drop policy if exists %I on public.generated_loan_documents', p.policyname); end loop;
end $$;
create policy "Borrowers and admins read generated documents"
on public.generated_loan_documents for select to authenticated
using (
  borrower_user_id = auth.uid()
  or exists (select 1 from public.loan_applications la where la.id::text = generated_loan_documents.loan_application_id::text and la.user_id = auth.uid())
  or public.is_secured_landing_admin()
);
create policy "Borrowers and admins update generated documents"
on public.generated_loan_documents for update to authenticated
using (
  borrower_user_id = auth.uid()
  or exists (select 1 from public.loan_applications la where la.id::text = generated_loan_documents.loan_application_id::text and la.user_id = auth.uid())
  or public.is_secured_landing_admin()
)
with check (
  borrower_user_id = auth.uid()
  or exists (select 1 from public.loan_applications la where la.id::text = generated_loan_documents.loan_application_id::text and la.user_id = auth.uid())
  or public.is_secured_landing_admin()
);

alter table public.property_photos enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='property_photos'
  loop execute format('drop policy if exists %I on public.property_photos', p.policyname); end loop;
end $$;
create policy "Borrowers insert own property photos"
on public.property_photos for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.loan_applications la
    where la.id::text = property_photos.loan_application_id::text
      and la.user_id = auth.uid()
  )
);
create policy "Borrowers and admins read property photos"
on public.property_photos for select to authenticated
using (
  user_id = auth.uid()
  or exists (select 1 from public.loan_applications la where la.id::text = property_photos.loan_application_id::text and la.user_id = auth.uid())
  or public.is_secured_landing_admin()
);
create policy "Borrowers and admins update property photos"
on public.property_photos for update to authenticated
using (user_id = auth.uid() or public.is_secured_landing_admin())
with check (user_id = auth.uid() or public.is_secured_landing_admin());
create policy "Borrowers and admins delete property photos"
on public.property_photos for delete to authenticated
using (user_id = auth.uid() or public.is_secured_landing_admin());

do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and (policyname ilike '%signed%document%' or policyname ilike '%property%photo%')
  loop execute format('drop policy if exists %I on storage.objects', p.policyname); end loop;
end $$;

create policy "Borrowers upload signed closing files"
on storage.objects for insert to authenticated
with check (bucket_id='signed-loan-documents' and split_part(name,'/',1)=auth.uid()::text);
create policy "Borrowers and admins read signed closing files"
on storage.objects for select to authenticated
using (bucket_id='signed-loan-documents' and (split_part(name,'/',1)=auth.uid()::text or public.is_secured_landing_admin()));
create policy "Borrowers replace signed closing files"
on storage.objects for update to authenticated
using (bucket_id='signed-loan-documents' and split_part(name,'/',1)=auth.uid()::text)
with check (bucket_id='signed-loan-documents' and split_part(name,'/',1)=auth.uid()::text);
create policy "Borrowers and admins delete signed closing files"
on storage.objects for delete to authenticated
using (bucket_id='signed-loan-documents' and (split_part(name,'/',1)=auth.uid()::text or public.is_secured_landing_admin()));

create policy "Borrowers upload property photo files"
on storage.objects for insert to authenticated
with check (bucket_id='property-photos' and split_part(name,'/',1)=auth.uid()::text);
create policy "Borrowers and admins read property photo files"
on storage.objects for select to authenticated
using (bucket_id='property-photos' and (split_part(name,'/',1)=auth.uid()::text or public.is_secured_landing_admin()));
create policy "Borrowers replace property photo files"
on storage.objects for update to authenticated
using (bucket_id='property-photos' and split_part(name,'/',1)=auth.uid()::text)
with check (bucket_id='property-photos' and split_part(name,'/',1)=auth.uid()::text);
create policy "Borrowers and admins delete property photo files"
on storage.objects for delete to authenticated
using (bucket_id='property-photos' and (split_part(name,'/',1)=auth.uid()::text or public.is_secured_landing_admin()));

create index if not exists generated_loan_documents_signed_review_idx
  on public.generated_loan_documents (signed_review_status, signed_uploaded_at desc)
  where signed_storage_path is not null;
