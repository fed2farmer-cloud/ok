-- ============================================================
-- SECUREDLANDING MEDIA STORAGE FIX
-- Fixes signed URL access for:
--   1. Borrower videos
--   2. Property photos
--   3. Marketplace media
--
-- IMPORTANT:
-- PostgreSQL comments use --, not //
-- ============================================================


-- ============================================================
-- 1. CREATE OR UPDATE STORAGE BUCKETS
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'borrower-videos',
  'borrower-videos',
  false,
  209715200,
  array[
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 209715200,
  allowed_mime_types = excluded.allowed_mime_types;


insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'property-photos',
  'property-photos',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = excluded.allowed_mime_types;


-- Some earlier versions may have used loan-photos.
-- Keeping this bucket available prevents old uploads from breaking.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'loan-photos',
  'loan-photos',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================
-- 2. REMOVE OLD OR CONFLICTING MEDIA POLICIES
-- ============================================================

drop policy if exists "Authenticated users can view borrower videos"
on storage.objects;

drop policy if exists "Authenticated users can upload borrower videos"
on storage.objects;

drop policy if exists "Users can update borrower videos"
on storage.objects;

drop policy if exists "Users can delete borrower videos"
on storage.objects;

drop policy if exists "Authenticated users can view property photos"
on storage.objects;

drop policy if exists "Authenticated users can upload property photos"
on storage.objects;

drop policy if exists "Users can update property photos"
on storage.objects;

drop policy if exists "Users can delete property photos"
on storage.objects;

drop policy if exists "Marketplace users can read approved media"
on storage.objects;

drop policy if exists "SecuredLanding media read access"
on storage.objects;

drop policy if exists "SecuredLanding media upload access"
on storage.objects;

drop policy if exists "SecuredLanding media update access"
on storage.objects;

drop policy if exists "SecuredLanding media delete access"
on storage.objects;


-- ============================================================
-- 3. READ ACCESS
--
-- This is required for createSignedUrl() to work.
-- Signed URLs will fail unless the logged-in investor/admin has
-- SELECT permission for the storage object.
-- ============================================================

create policy "SecuredLanding media read access"
on storage.objects
for select
to authenticated
using (
  bucket_id in (
    'borrower-videos',
    'property-photos',
    'loan-photos'
  )
);


-- ============================================================
-- 4. UPLOAD ACCESS
--
-- Logged-in borrowers and admins may upload media.
-- ============================================================

create policy "SecuredLanding media upload access"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in (
    'borrower-videos',
    'property-photos',
    'loan-photos'
  )
);


-- ============================================================
-- 5. UPDATE ACCESS
-- ============================================================

create policy "SecuredLanding media update access"
on storage.objects
for update
to authenticated
using (
  bucket_id in (
    'borrower-videos',
    'property-photos',
    'loan-photos'
  )
)
with check (
  bucket_id in (
    'borrower-videos',
    'property-photos',
    'loan-photos'
  )
);


-- ============================================================
-- 6. DELETE ACCESS
-- ============================================================

create policy "SecuredLanding media delete access"
on storage.objects
for delete
to authenticated
using (
  bucket_id in (
    'borrower-videos',
    'property-photos',
    'loan-photos'
  )
);


-- ============================================================
-- 7. ENSURE LOAN VIDEO COLUMNS EXIST
-- ============================================================

alter table if exists public.loan_applications
add column if not exists borrower_video_path text;

alter table if exists public.loan_applications
add column if not exists borrower_video_status text
default 'not_submitted';

alter table if exists public.loan_applications
add column if not exists borrower_video_admin_notes text;

alter table if exists public.loan_applications
add column if not exists borrower_video_reviewed_at timestamptz;

alter table if exists public.loan_applications
add column if not exists borrower_video_reviewed_by uuid;


-- ============================================================
-- 8. NORMALIZE VIDEO STATUS VALUES
-- ============================================================

update public.loan_applications
set borrower_video_status = lower(trim(borrower_video_status))
where borrower_video_status is not null;

update public.loan_applications
set borrower_video_status = 'not_submitted'
where borrower_video_status is null
   or trim(borrower_video_status) = '';

update public.loan_applications
set borrower_video_status = 'approved'
where borrower_video_status in (
  'approve',
  'accepted',
  'complete',
  'completed'
);

update public.loan_applications
set borrower_video_status = 'submitted'
where borrower_video_status in (
  'pending',
  'pending_review',
  'under_review',
  'uploaded'
);

update public.loan_applications
set borrower_video_status = 'rejected'
where borrower_video_status in (
  'deny',
  'denied'
);


-- ============================================================
-- 9. REMOVE BUCKET PREFIX FROM VIDEO PATHS
--
-- Supabase expects:
--   user-id/loan-id/video.mp4
--
-- It should not be:
--   borrower-videos/user-id/loan-id/video.mp4
-- ============================================================

update public.loan_applications
set borrower_video_path =
  regexp_replace(
    borrower_video_path,
    '^/?borrower-videos/',
    '',
    'i'
  )
where borrower_video_path is not null
  and borrower_video_path ~* '^/?borrower-videos/';


-- Remove leading slash from stored paths.

update public.loan_applications
set borrower_video_path =
  regexp_replace(
    borrower_video_path,
    '^/+',
    ''
  )
where borrower_video_path is not null;


-- ============================================================
-- 10. PROPERTY PHOTOS TABLE
-- ============================================================

create table if not exists public.property_photos (
  id uuid primary key default gen_random_uuid(),

  loan_application_id uuid not null
    references public.loan_applications(id)
    on delete cascade,

  user_id uuid references auth.users(id)
    on delete set null,

  storage_bucket text not null
    default 'property-photos',

  storage_path text not null,

  file_name text,

  caption text,

  status text not null
    default 'submitted',

  is_cover boolean not null
    default false,

  admin_notes text,

  reviewed_by uuid,

  reviewed_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);


-- Add missing columns when property_photos already existed.

alter table if exists public.property_photos
add column if not exists loan_application_id uuid;

alter table if exists public.property_photos
add column if not exists user_id uuid;

alter table if exists public.property_photos
add column if not exists storage_bucket text
default 'property-photos';

alter table if exists public.property_photos
add column if not exists storage_path text;

alter table if exists public.property_photos
add column if not exists file_name text;

alter table if exists public.property_photos
add column if not exists caption text;

alter table if exists public.property_photos
add column if not exists status text
default 'submitted';

alter table if exists public.property_photos
add column if not exists is_cover boolean
default false;

alter table if exists public.property_photos
add column if not exists admin_notes text;

alter table if exists public.property_photos
add column if not exists reviewed_by uuid;

alter table if exists public.property_photos
add column if not exists reviewed_at timestamptz;

alter table if exists public.property_photos
add column if not exists created_at timestamptz
default now();

alter table if exists public.property_photos
add column if not exists updated_at timestamptz
default now();


-- ============================================================
-- 11. NORMALIZE PROPERTY PHOTO RECORDS
-- ============================================================

update public.property_photos
set storage_bucket = 'property-photos'
where storage_bucket is null
   or trim(storage_bucket) = '';

update public.property_photos
set status = lower(trim(status))
where status is not null;

update public.property_photos
set status = 'submitted'
where status is null
   or trim(status) = '';

update public.property_photos
set status = 'approved'
where status in (
  'approve',
  'accepted',
  'complete',
  'completed'
);

update public.property_photos
set status = 'submitted'
where status in (
  'pending',
  'pending_review',
  'under_review',
  'uploaded'
);

update public.property_photos
set status = 'rejected'
where status in (
  'deny',
  'denied'
);


-- Remove duplicated bucket names from stored photo paths.

update public.property_photos
set storage_path =
  regexp_replace(
    storage_path,
    '^/?property-photos/',
    '',
    'i'
  )
where storage_path is not null
  and storage_path ~* '^/?property-photos/';

update public.property_photos
set storage_path =
  regexp_replace(
    storage_path,
    '^/?loan-photos/',
    '',
    'i'
  )
where storage_path is not null
  and storage_path ~* '^/?loan-photos/';

update public.property_photos
set storage_path =
  regexp_replace(
    storage_path,
    '^/+',
    ''
  )
where storage_path is not null;


-- ============================================================
-- 12. PROPERTY PHOTO ROW-LEVEL SECURITY
-- ============================================================

alter table public.property_photos enable row level security;


drop policy if exists "Users can view property photos"
on public.property_photos;

drop policy if exists "Users can add property photos"
on public.property_photos;

drop policy if exists "Users can update property photos"
on public.property_photos;

drop policy if exists "Users can delete property photos"
on public.property_photos;

drop policy if exists "Authenticated users can view property photos"
on public.property_photos;

drop policy if exists "Authenticated users can insert property photos"
on public.property_photos;

drop policy if exists "Authenticated users can update property photos"
on public.property_photos;

drop policy if exists "Authenticated users can delete property photos"
on public.property_photos;


create policy "Authenticated users can view property photos"
on public.property_photos
for select
to authenticated
using (true);


create policy "Authenticated users can insert property photos"
on public.property_photos
for insert
to authenticated
with check (
  auth.uid() is not null
);


create policy "Authenticated users can update property photos"
on public.property_photos
for update
to authenticated
using (
  auth.uid() is not null
)
with check (
  auth.uid() is not null
);


create policy "Authenticated users can delete property photos"
on public.property_photos
for delete
to authenticated
using (
  auth.uid() is not null
);


-- ============================================================
-- 13. INDEXES FOR MARKETPLACE MEDIA
-- ============================================================

create index if not exists
property_photos_loan_application_id_idx
on public.property_photos(loan_application_id);

create index if not exists
property_photos_status_idx
on public.property_photos(status);

create index if not exists
property_photos_cover_idx
on public.property_photos(loan_application_id, is_cover);

create index if not exists
loan_applications_video_status_idx
on public.loan_applications(borrower_video_status);


-- ============================================================
-- 14. AUTOMATIC UPDATED_AT TIMESTAMP
-- ============================================================

create or replace function public.set_property_photos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


drop trigger if exists property_photos_updated_at_trigger
on public.property_photos;


create trigger property_photos_updated_at_trigger
before update on public.property_photos
for each row
execute function public.set_property_photos_updated_at();


-- ============================================================
-- 15. ENSURE ONLY ONE COVER PHOTO PER LOAN
-- ============================================================

create unique index if not exists
property_photos_one_cover_per_loan_idx
on public.property_photos(loan_application_id)
where is_cover = true;


-- ============================================================
-- 16. GRANTS
-- ============================================================

grant select, insert, update, delete
on public.property_photos
to authenticated;

grant usage on schema storage
to authenticated;


-- ============================================================
-- 17. DIAGNOSTIC RESULTS
--
-- These results will show after running the SQL.
-- ============================================================

select
  id,
  business_name,
  borrower_video_status,
  borrower_video_path
from public.loan_applications
where borrower_video_path is not null
order by created_at desc;


select
  id,
  loan_application_id,
  storage_bucket,
  storage_path,
  status,
  is_cover
from public.property_photos
order by created_at desc;


select
  bucket_id,
  name,
  created_at
from storage.objects
where bucket_id in (
  'borrower-videos',
  'property-photos',
  'loan-photos'
)
order by created_at desc;