-- SecuredLanding V2 foundation migration
-- 1) Transparent wallet: future deposits are credited at 100% by the API.
-- 2) Borrower storytelling: optional introduction video and marketing fields.

alter table public.loan_applications
  add column if not exists borrower_video_path text,
  add column if not exists borrower_video_status text default 'not_submitted',
  add column if not exists borrower_video_admin_notes text,
  add column if not exists borrower_video_reviewed_at timestamptz,
  add column if not exists borrower_story text,
  add column if not exists loan_use_summary text,
  add column if not exists repayment_plan_summary text;

-- Keep allowed review values understandable and explicit.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'loan_applications_borrower_video_status_check'
  ) then
    alter table public.loan_applications
      add constraint loan_applications_borrower_video_status_check
      check (borrower_video_status in (
        'not_submitted', 'submitted', 'approved', 'rejected', 'more_information'
      ));
  end if;
end $$;

-- Private media bucket for borrower videos. Signed URLs should be used for playback.
insert into storage.buckets (id, name, public)
values ('borrower-videos', 'borrower-videos', false)
on conflict (id) do update set public = false;

-- Borrowers can upload and read only their own video objects.
drop policy if exists "Borrowers upload own videos" on storage.objects;
create policy "Borrowers upload own videos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'borrower-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Borrowers read own videos" on storage.objects;
create policy "Borrowers read own videos"
on storage.objects for select to authenticated
using (
  bucket_id = 'borrower-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Borrowers update own videos" on storage.objects;
create policy "Borrowers update own videos"
on storage.objects for update to authenticated
using (
  bucket_id = 'borrower-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Borrowers delete own videos" on storage.objects;
create policy "Borrowers delete own videos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'borrower-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
