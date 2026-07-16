-- SecuredLanding v3.2.0
-- Multiple-loan closing package selector, signed closing-document uploads,
-- and a definitive property-photo RLS repair.

-- Signed document tracking on generated forms.
alter table public.generated_loan_documents
  add column if not exists signed_storage_path text,
  add column if not exists signed_uploaded_at timestamptz,
  add column if not exists signed_review_status text default 'not_uploaded',
  add column if not exists signed_reviewed_at timestamptz,
  add column if not exists signed_reviewed_by uuid,
  add column if not exists signed_admin_notes text;

-- Borrowers may read/update generated forms attached to their own loans.
alter table public.generated_loan_documents enable row level security;
drop policy if exists "Borrowers read their generated loan documents" on public.generated_loan_documents;
drop policy if exists "Borrowers update their generated loan documents" on public.generated_loan_documents;
create policy "Borrowers read their generated loan documents"
on public.generated_loan_documents for select to authenticated
using (
  borrower_user_id = auth.uid()
  or exists (select 1 from public.loan_applications la where la.id = generated_loan_documents.loan_application_id and la.user_id = auth.uid())
  or public.is_secured_landing_admin()
);
create policy "Borrowers update their generated loan documents"
on public.generated_loan_documents for update to authenticated
using (
  borrower_user_id = auth.uid()
  or exists (select 1 from public.loan_applications la where la.id = generated_loan_documents.loan_application_id and la.user_id = auth.uid())
  or public.is_secured_landing_admin()
)
with check (
  borrower_user_id = auth.uid()
  or exists (select 1 from public.loan_applications la where la.id = generated_loan_documents.loan_application_id and la.user_id = auth.uid())
  or public.is_secured_landing_admin()
);

-- Private signed closing-document bucket.
insert into storage.buckets (id, name, public, file_size_limit)
values ('signed-loan-documents', 'signed-loan-documents', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname ilike '%signed%loan%document%'
  loop execute format('drop policy if exists %I on storage.objects', p.policyname); end loop;
end $$;
create policy "Borrowers upload signed loan documents"
on storage.objects for insert to authenticated
with check (bucket_id='signed-loan-documents' and split_part(name,'/',1)=auth.uid()::text);
create policy "Borrowers read signed loan documents"
on storage.objects for select to authenticated
using (bucket_id='signed-loan-documents' and (split_part(name,'/',1)=auth.uid()::text or public.is_secured_landing_admin()));
create policy "Borrowers replace signed loan documents"
on storage.objects for update to authenticated
using (bucket_id='signed-loan-documents' and split_part(name,'/',1)=auth.uid()::text)
with check (bucket_id='signed-loan-documents' and split_part(name,'/',1)=auth.uid()::text);
create policy "Borrowers delete signed loan documents"
on storage.objects for delete to authenticated
using (bucket_id='signed-loan-documents' and (split_part(name,'/',1)=auth.uid()::text or public.is_secured_landing_admin()));

-- Definitive property photo repair: authorize from ownership of the related loan.
-- This avoids depending on property_photos.user_id being populated exactly as expected.
alter table public.property_photos enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='property_photos'
  loop execute format('drop policy if exists %I on public.property_photos', p.policyname); end loop;
end $$;
create policy "Loan owners insert property photos"
on public.property_photos for insert to authenticated
with check (
  exists (
    select 1 from public.loan_applications la
    where la.id = property_photos.loan_application_id
      and la.user_id = auth.uid()
  )
);
create policy "Loan owners read property photos"
on public.property_photos for select to authenticated
using (
  exists (select 1 from public.loan_applications la where la.id = property_photos.loan_application_id and la.user_id = auth.uid())
  or public.is_secured_landing_admin()
);
create policy "Loan owners update property photos"
on public.property_photos for update to authenticated
using (exists (select 1 from public.loan_applications la where la.id = property_photos.loan_application_id and la.user_id = auth.uid()) or public.is_secured_landing_admin())
with check (exists (select 1 from public.loan_applications la where la.id = property_photos.loan_application_id and la.user_id = auth.uid()) or public.is_secured_landing_admin());
create policy "Loan owners delete property photos"
on public.property_photos for delete to authenticated
using (exists (select 1 from public.loan_applications la where la.id = property_photos.loan_application_id and la.user_id = auth.uid()) or public.is_secured_landing_admin());

insert into storage.buckets (id, name, public, file_size_limit)
values ('property-photos','property-photos',false,15728640)
on conflict (id) do update set public=false, file_size_limit=15728640;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and bucket_id is null
  loop null; end loop;
end $$;

-- Drop only policies whose names indicate they govern this bucket.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname ilike '%property%photo%'
  loop execute format('drop policy if exists %I on storage.objects', p.policyname); end loop;
end $$;
create policy "Loan owners upload property photo objects"
on storage.objects for insert to authenticated
with check (bucket_id='property-photos' and split_part(name,'/',1)=auth.uid()::text);
create policy "Loan owners read property photo objects"
on storage.objects for select to authenticated
using (bucket_id='property-photos' and (split_part(name,'/',1)=auth.uid()::text or public.is_secured_landing_admin()));
create policy "Loan owners delete property photo objects"
on storage.objects for delete to authenticated
using (bucket_id='property-photos' and (split_part(name,'/',1)=auth.uid()::text or public.is_secured_landing_admin()));
