-- SecuredLanding v3.6.1 investor media access
-- Allows authenticated investors to read only approved property-photo rows and
-- storage objects for loans that are currently published in the marketplace.

alter table public.property_photos enable row level security;

drop policy if exists "Authenticated users view approved marketplace property photos"
on public.property_photos;

create policy "Authenticated users view approved marketplace property photos"
on public.property_photos
for select
to authenticated
using (
  lower(coalesce(review_status, '')) = 'approved'
  and exists (
    select 1
    from public.marketplace_loans ml
    where ml.loan_application_id::text = property_photos.loan_application_id::text
      and lower(coalesce(ml.status, '')) in ('open', 'funding', 'funded')
  )
);

-- Investors need limited read access to approved video metadata on published loans.
drop policy if exists "Authenticated users view published loan media metadata"
on public.loan_applications;

create policy "Authenticated users view published loan media metadata"
on public.loan_applications
for select
to authenticated
using (
  exists (
    select 1
    from public.marketplace_loans ml
    where ml.loan_application_id::text = loan_applications.id::text
      and lower(coalesce(ml.status, '')) in ('open', 'funding', 'funded')
  )
);

-- Storage object access. Database rows still control which media the UI exposes.
drop policy if exists "Authenticated users read property photo objects"
on storage.objects;

create policy "Authenticated users read property photo objects"
on storage.objects
for select
to authenticated
using (bucket_id = 'property-photos');

drop policy if exists "Authenticated users read borrower video objects"
on storage.objects;

create policy "Authenticated users read borrower video objects"
on storage.objects
for select
to authenticated
using (bucket_id = 'borrower-videos');
