-- Migration: SecuredLanding V3 - Loan Documents Table, Storage Bucket, and KYC Constraint Fixes
-- Run this after 20260711_v2_notifications_messages_kyc.sql
--
-- Root causes addressed:
-- 1. loan_documents table was never created; uploads failed at the DB insert step.
-- 2. loan-documents storage bucket was never created; uploads failed at the storage step.
-- 3. kyc_submissions had a 'pending' default status not handled by the frontend.
-- 4. kyc_submissions status constraint excluded 'in_progress' and 'more_information'.
-- 5. kyc_submissions id_type constraint excluded 'military_id'.
-- 6. kyc_submissions user update RLS excluded 'more_information' status rows.

-- ============================================================
-- LOAN DOCUMENTS TABLE
-- ============================================================

create table if not exists public.loan_documents (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  loan_application_id  uuid references public.loan_applications(id) on delete set null,
  document_type        text not null default 'other',
  file_name            text not null,
  storage_path         text,
  file_url             text,
  status               text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'approved', 'rejected', 'more_information')),
  admin_notes          text,
  reviewed_by          uuid references auth.users(id) on delete set null,
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now()
);

alter table public.loan_documents enable row level security;

-- Borrowers can insert their own documents
create policy "Borrowers insert own documents"
  on public.loan_documents for insert
  with check (auth.uid() = user_id);

-- Borrowers can read their own documents
create policy "Borrowers read own documents"
  on public.loan_documents for select
  using (auth.uid() = user_id);

-- Admins can read all documents (supports both JWT role claim and admin_users table)
create policy "Admins read all documents"
  on public.loan_documents for select
  using (
    auth.jwt() ->> 'role' = 'admin'
    or exists (select 1 from public.admin_users where user_id = auth.uid())
  );

-- Admins can update document status, admin_notes, reviewed_by, reviewed_at
create policy "Admins update documents"
  on public.loan_documents for update
  using (
    auth.jwt() ->> 'role' = 'admin'
    or exists (select 1 from public.admin_users where user_id = auth.uid())
  );

create index if not exists loan_documents_user_id_idx
  on public.loan_documents (user_id);

create index if not exists loan_documents_loan_application_id_idx
  on public.loan_documents (loan_application_id);

-- ============================================================
-- LOAN DOCUMENTS STORAGE BUCKET
-- ============================================================

insert into storage.buckets (id, name, public)
values ('loan-documents', 'loan-documents', false)
on conflict (id) do nothing;

-- Borrowers can upload to their own folder (path starts with their user_id)
create policy "Borrowers upload own loan documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'loan-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Borrowers can read their own uploaded loan documents
create policy "Borrowers read own loan documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'loan-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all loan documents in storage
create policy "Admins read all loan documents storage"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'loan-documents'
    and (
      auth.jwt() ->> 'role' = 'admin'
      or exists (select 1 from public.admin_users where user_id = auth.uid())
    )
  );

-- Borrowers can delete their own loan documents (for cleanup on failed DB insert)
create policy "Borrowers delete own loan documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'loan-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- KYC SUBMISSIONS — FIX STATUS CONSTRAINT
-- ============================================================
-- The previous constraint only allowed: pending, submitted, under_review, approved, rejected.
-- The frontend uses 'in_progress' (partial save state) and 'more_information' (admin request).
-- Also change the default from 'pending' to 'in_progress' to match frontend expectations.

-- Step 1: migrate any existing 'pending' rows to 'in_progress' before changing the constraint.
-- This UPDATE is idempotent: after the first run no 'pending' rows remain, so subsequent
-- executions are safe no-ops.
update public.kyc_submissions
set status = 'in_progress'
where status = 'pending';

-- Step 2: drop the old check constraint
alter table public.kyc_submissions
  drop constraint if exists kyc_submissions_status_check;

-- Step 3: add new constraint with all valid statuses and change default
alter table public.kyc_submissions
  alter column status set default 'in_progress',
  add constraint kyc_submissions_status_check
    check (status in ('in_progress', 'submitted', 'under_review', 'approved', 'rejected', 'more_information'));

-- ============================================================
-- KYC SUBMISSIONS — FIX ID_TYPE CONSTRAINT
-- ============================================================
-- The previous constraint excluded 'military_id' which is a valid option in the frontend.

alter table public.kyc_submissions
  drop constraint if exists kyc_submissions_id_type_check;

alter table public.kyc_submissions
  add constraint kyc_submissions_id_type_check
    check (id_type in ('drivers_license', 'passport', 'state_id', 'military_id'));

-- ============================================================
-- KYC SUBMISSIONS — FIX USER UPDATE RLS POLICY
-- ============================================================
-- The old policy only allowed updates when status was 'pending' or 'rejected'.
-- Users must also be able to resubmit when status is 'in_progress' or 'more_information'.

drop policy if exists "Users update own KYC when pending" on public.kyc_submissions;

create policy "Users update own KYC"
  on public.kyc_submissions for update
  using (
    auth.uid() = user_id
    and status in ('in_progress', 'rejected', 'more_information')
  );
