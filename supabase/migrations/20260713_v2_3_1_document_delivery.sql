create extension if not exists pgcrypto;
create table if not exists public.generated_loan_documents (
 id uuid primary key default gen_random_uuid(), loan_application_id bigint not null references public.loan_applications(id) on delete cascade,
 borrower_user_id uuid not null references auth.users(id) on delete cascade, document_type text not null, title text not null,
 status text not null default 'ready_for_review' check(status in('draft','ready_for_review','reviewed','signed','completed','void')),
 terms_snapshot jsonb not null default '{}'::jsonb, acknowledged_at timestamptz, signed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(loan_application_id,document_type));
create index if not exists generated_loan_documents_borrower_idx on public.generated_loan_documents(borrower_user_id,loan_application_id);
alter table public.generated_loan_documents enable row level security;
drop policy if exists "Borrowers view own generated documents" on public.generated_loan_documents;
create policy "Borrowers view own generated documents" on public.generated_loan_documents for select using(borrower_user_id=auth.uid() or public.is_secured_landing_admin());
drop policy if exists "Borrowers acknowledge own generated documents" on public.generated_loan_documents;
create policy "Borrowers acknowledge own generated documents" on public.generated_loan_documents for update using(borrower_user_id=auth.uid() or public.is_secured_landing_admin()) with check(borrower_user_id=auth.uid() or public.is_secured_landing_admin());
drop policy if exists "Admins manage generated documents" on public.generated_loan_documents;
create policy "Admins manage generated documents" on public.generated_loan_documents for all using(public.is_secured_landing_admin()) with check(public.is_secured_landing_admin());
