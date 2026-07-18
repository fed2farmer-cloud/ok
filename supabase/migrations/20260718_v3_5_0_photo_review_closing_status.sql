-- SecuredLanding v3.5.0
-- Property photo moderation and complete closing-document status support.

alter table if exists public.property_photos
  add column if not exists review_status text not null default 'submitted',
  add column if not exists admin_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists is_cover boolean not null default false;

alter table if exists public.generated_loan_documents
  add column if not exists signed_storage_path text,
  add column if not exists signed_uploaded_at timestamptz,
  add column if not exists signed_review_status text not null default 'not_uploaded',
  add column if not exists signed_reviewed_at timestamptz,
  add column if not exists signed_reviewed_by uuid,
  add column if not exists signed_admin_notes text;

-- Existing uploaded documents should enter the admin review queue.
update public.generated_loan_documents
set signed_review_status = 'uploaded'
where signed_storage_path is not null
  and coalesce(signed_review_status, 'not_uploaded') = 'not_uploaded';

-- Existing photos remain private until reviewed.
update public.property_photos
set review_status = coalesce(review_status, 'submitted');

alter table public.property_photos enable row level security;

drop policy if exists "Admins can review property photos" on public.property_photos;
create policy "Admins can review property photos"
on public.property_photos
for all
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Borrowers may continue to manage their own photos.
drop policy if exists "Borrowers can view own property photos" on public.property_photos;
create policy "Borrowers can view own property photos"
on public.property_photos for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Borrowers can insert own property photos" on public.property_photos;
create policy "Borrowers can insert own property photos"
on public.property_photos for insert to authenticated
with check (user_id = auth.uid() and review_status = 'submitted');

drop policy if exists "Borrowers can delete own property photos" on public.property_photos;
create policy "Borrowers can delete own property photos"
on public.property_photos for delete to authenticated
using (user_id = auth.uid());

create index if not exists property_photos_review_status_idx on public.property_photos(review_status);
create index if not exists generated_loan_documents_signed_review_status_idx on public.generated_loan_documents(signed_review_status);
