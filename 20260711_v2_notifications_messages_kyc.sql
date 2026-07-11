-- Migration: SecuredLanding V2 - Notifications, Messages, Property Photos, KYC
-- Run this after 20260710_v2_transparent_wallet_and_borrower_video.sql

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  body          text,
  link_url      text,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Service role insert notifications"
  on public.notifications for insert
  with check (true);

create index if not exists notifications_user_id_read_idx
  on public.notifications (user_id, read);

-- ============================================================
-- MESSAGES
-- ============================================================
create table if not exists public.messages (
  id                   uuid primary key default gen_random_uuid(),
  sender_id            uuid not null references auth.users(id) on delete cascade,
  recipient_id         uuid not null references auth.users(id) on delete cascade,
  loan_application_id  uuid references public.loan_applications(id) on delete set null,
  body                 text not null,
  read                 boolean not null default false,
  sender_role          text check (sender_role in ('borrower', 'investor', 'admin')),
  created_at           timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Participants read their messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Authenticated users send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "Recipients mark messages read"
  on public.messages for update
  using (auth.uid() = recipient_id);

create index if not exists messages_sender_idx    on public.messages (sender_id);
create index if not exists messages_recipient_idx on public.messages (recipient_id);
create index if not exists messages_loan_idx      on public.messages (loan_application_id);

-- ============================================================
-- PROPERTY PHOTOS
-- ============================================================
create table if not exists public.property_photos (
  id                   uuid primary key default gen_random_uuid(),
  loan_application_id  uuid not null references public.loan_applications(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  storage_path         text not null,
  caption              text,
  created_at           timestamptz not null default now()
);

alter table public.property_photos enable row level security;

create policy "Owners read their property photos"
  on public.property_photos for select
  using (auth.uid() = user_id);

create policy "Investors and admin read property photos"
  on public.property_photos for select
  using (
    exists (
      select 1 from public.loan_applications la
      where la.id = property_photos.loan_application_id
        and (la.user_id = auth.uid() or auth.jwt() ->> 'role' in ('investor', 'admin'))
    )
  );

create policy "Owners insert property photos"
  on public.property_photos for insert
  with check (auth.uid() = user_id);

create policy "Owners delete own property photos"
  on public.property_photos for delete
  using (auth.uid() = user_id);

create index if not exists property_photos_loan_idx on public.property_photos (loan_application_id);

-- ============================================================
-- KYC SUBMISSIONS
-- ============================================================
create table if not exists public.kyc_submissions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references auth.users(id) on delete cascade,
  status           text not null default 'pending'
    check (status in ('pending', 'submitted', 'under_review', 'approved', 'rejected')),
  full_legal_name  text,
  date_of_birth    date,
  ssn_last4        text,
  address          text,
  id_type          text check (id_type in ('drivers_license', 'passport', 'state_id')),
  id_doc_path      text,
  selfie_path      text,
  admin_notes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.kyc_submissions enable row level security;

create policy "Users read own KYC"
  on public.kyc_submissions for select
  using (auth.uid() = user_id);

create policy "Users insert own KYC"
  on public.kyc_submissions for insert
  with check (auth.uid() = user_id);

create policy "Users update own KYC when pending"
  on public.kyc_submissions for update
  using (auth.uid() = user_id and status in ('pending', 'rejected'));

create policy "Admins read all KYC"
  on public.kyc_submissions for select
  using (auth.jwt() ->> 'role' = 'admin');

create policy "Admins update KYC status"
  on public.kyc_submissions for update
  using (auth.jwt() ->> 'role' = 'admin');

-- Auto-update updated_at
create or replace function public.kyc_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kyc_updated_at on public.kyc_submissions;
create trigger kyc_updated_at
  before update on public.kyc_submissions
  for each row execute function public.kyc_set_updated_at();

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- Property photos bucket (public read after upload)
insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', false)
on conflict (id) do nothing;

create policy "Authenticated users upload property photos"
  on storage.objects for insert
  with check (bucket_id = 'property-photos' and auth.role() = 'authenticated');

create policy "Owners read their property photos storage"
  on storage.objects for select
  using (bucket_id = 'property-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owners delete property photos"
  on storage.objects for delete
  using (bucket_id = 'property-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- KYC documents bucket (restricted)
insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

create policy "Authenticated users upload KYC docs"
  on storage.objects for insert
  with check (bucket_id = 'kyc-documents' and auth.role() = 'authenticated');

create policy "Owners read their KYC docs"
  on storage.objects for select
  using (bucket_id = 'kyc-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Admins read all KYC docs"
  on storage.objects for select
  using (bucket_id = 'kyc-documents' and auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- Enable Realtime for new tables
-- ============================================================
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.messages;
