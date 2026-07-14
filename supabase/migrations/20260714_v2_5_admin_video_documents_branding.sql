-- SecuredLanding v2.5.0 compatibility migration
-- Safe to run more than once.

alter table public.loan_applications
  add column if not exists borrower_video_admin_notes text,
  add column if not exists borrower_video_reviewed_at timestamptz;

alter table public.marketplace_loans
  add column if not exists borrower_video_path text,
  add column if not exists borrower_video_status text default 'not_submitted';

alter table public.generated_loan_documents
  add column if not exists borrower_user_id uuid references auth.users(id),
  add column if not exists title text,
  add column if not exists terms_snapshot jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

update public.generated_loan_documents
set title = coalesce(title, document_name, initcap(replace(document_type, '_', ' ')))
where title is null;

create unique index if not exists generated_loan_documents_loan_type_uidx
  on public.generated_loan_documents (loan_application_id, document_type);

create index if not exists generated_loan_documents_borrower_user_idx
  on public.generated_loan_documents (borrower_user_id);

alter table public.generated_loan_documents enable row level security;

drop policy if exists "Borrowers can view their generated documents" on public.generated_loan_documents;
create policy "Borrowers can view their generated documents"
on public.generated_loan_documents
for select to authenticated
using (borrower_user_id = auth.uid());

drop policy if exists "Admins can manage generated loan documents" on public.generated_loan_documents;
create policy "Admins can manage generated loan documents"
on public.generated_loan_documents
for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
