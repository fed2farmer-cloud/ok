begin;

alter table public.loan_applications
  add column if not exists borrower_video_path text,
  add column if not exists borrower_video_status text default 'not_uploaded',
  add column if not exists borrower_video_admin_notes text,
  add column if not exists borrower_video_reviewed_at timestamptz,
  add column if not exists borrower_video_reviewed_by uuid references auth.users(id);

alter table public.loan_applications
  drop constraint if exists loan_applications_borrower_video_status_check;

alter table public.loan_applications
  add constraint loan_applications_borrower_video_status_check
  check (borrower_video_status in (
    'not_uploaded', 'under_review', 'submitted', 'approved',
    'more_information', 'rejected'
  ));

create index if not exists loan_applications_video_review_idx
  on public.loan_applications (borrower_video_status, created_at desc)
  where borrower_video_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'borrower-videos',
  'borrower-videos',
  false,
  209715200,
  array['video/mp4','video/webm','video/quicktime','video/x-msvideo']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- A borrower may upload only inside: auth.uid()/loan_application_id/file.ext
-- Existing policies with these names are replaced safely.
drop policy if exists "Borrowers upload own loan videos" on storage.objects;
create policy "Borrowers upload own loan videos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'borrower-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Borrowers manage own loan videos" on storage.objects;
create policy "Borrowers manage own loan videos"
on storage.objects for select to authenticated
using (
  bucket_id = 'borrower-videos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.admin_users a where a.user_id = auth.uid()
    )
  )
);

drop policy if exists "Borrowers update own loan videos" on storage.objects;
create policy "Borrowers update own loan videos"
on storage.objects for update to authenticated
using (
  bucket_id = 'borrower-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'borrower-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Borrowers delete own loan videos" on storage.objects;
create policy "Borrowers delete own loan videos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'borrower-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

notify pgrst, 'reload schema';
commit;
