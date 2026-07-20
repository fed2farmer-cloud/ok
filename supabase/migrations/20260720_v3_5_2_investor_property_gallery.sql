-- SecuredLanding v3.5.2
-- Permit authenticated investors to read only approved property-photo records
-- and create signed URLs only for approved objects in the private bucket.

alter table public.property_photos
  add column if not exists review_status text not null default 'pending';

update public.property_photos
set review_status = 'pending'
where review_status is null or review_status = '';

create index if not exists property_photos_approved_loan_idx
  on public.property_photos (loan_application_id, review_status);

drop policy if exists "Authenticated users can view approved property photos"
  on public.property_photos;

create policy "Authenticated users can view approved property photos"
on public.property_photos
for select
to authenticated
using (review_status = 'approved');

drop policy if exists "Authenticated users can view approved property photo objects"
  on storage.objects;

create policy "Authenticated users can view approved property photo objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'property-photos'
  and exists (
    select 1
    from public.property_photos photo
    where photo.storage_path = storage.objects.name
      and photo.review_status = 'approved'
  )
);
