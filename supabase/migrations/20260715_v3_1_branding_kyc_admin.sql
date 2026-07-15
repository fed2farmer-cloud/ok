begin;

alter table public.kyc_submissions
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists risk_flags jsonb not null default '[]'::jsonb;

alter table public.kyc_submissions enable row level security;

drop policy if exists "Users can view their own KYC submissions" on public.kyc_submissions;
create policy "Users can view their own KYC submissions"
on public.kyc_submissions for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create their own KYC submissions" on public.kyc_submissions;
create policy "Users can create their own KYC submissions"
on public.kyc_submissions for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their own KYC submissions" on public.kyc_submissions;
create policy "Users can update their own KYC submissions"
on public.kyc_submissions for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Admins can review all KYC submissions" on public.kyc_submissions;
create policy "Admins can review all KYC submissions"
on public.kyc_submissions for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Private KYC storage: users can manage files within their own top-level folder;
-- admins may read all files for compliance review.
insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can upload their own KYC files" on storage.objects;
create policy "Users can upload their own KYC files"
on storage.objects for insert to authenticated
with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can read their own KYC files" on storage.objects;
create policy "Users can read their own KYC files"
on storage.objects for select to authenticated
using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Admins can read KYC files" on storage.objects;
create policy "Admins can read KYC files"
on storage.objects for select to authenticated
using (
  bucket_id = 'kyc-documents'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);

notify pgrst, 'reload schema';
commit;
