-- Allows signed-in marketplace investors to read approved property photo rows
-- and retrieve approved photo/video files from private Supabase Storage buckets.

alter table if exists public.property_photos enable row level security;

drop policy if exists "Authenticated users can view approved property photos" on public.property_photos;
create policy "Authenticated users can view approved property photos"
on public.property_photos
for select
to authenticated
using (lower(coalesce(review_status, '')) = 'approved');

-- Storage policies are intentionally limited to SELECT and these two buckets.
drop policy if exists "Authenticated users can read property photos" on storage.objects;
create policy "Authenticated users can read property photos"
on storage.objects
for select
to authenticated
using (bucket_id = 'property-photos');

drop policy if exists "Authenticated users can read borrower videos" on storage.objects;
create policy "Authenticated users can read borrower videos"
on storage.objects
for select
to authenticated
using (bucket_id = 'borrower-videos');

-- Keep both buckets private; the app creates signed URLs.
update storage.buckets set public = false where id in ('property-photos', 'borrower-videos');
