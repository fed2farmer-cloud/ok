-- Fix borrower document ownership checks and tighten document/storage RLS.

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select lower(
    coalesce(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() -> 'user_metadata' ->> 'role',
      auth.jwt() ->> 'role',
      ''
    )
  );
$$;

alter table public.loan_applications enable row level security;

drop policy if exists "Borrowers read own loan applications" on public.loan_applications;
create policy "Borrowers read own loan applications"
  on public.loan_applications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Borrowers insert own loan applications" on public.loan_applications;
create policy "Borrowers insert own loan applications"
  on public.loan_applications for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Borrowers update own loan applications" on public.loan_applications;
create policy "Borrowers update own loan applications"
  on public.loan_applications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins read all loan applications" on public.loan_applications;
create policy "Admins read all loan applications"
  on public.loan_applications for select to authenticated
  using (public.current_app_role() = 'admin');

drop policy if exists "Admins update loan applications" on public.loan_applications;
create policy "Admins update loan applications"
  on public.loan_applications for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

do $$
begin
  if to_regclass('public.loan_documents') is null then
    create table public.loan_documents (
      id                  uuid primary key default gen_random_uuid(),
      loan_application_id uuid not null references public.loan_applications(id) on delete cascade,
      user_id             uuid not null references auth.users(id) on delete cascade,
      document_type       text not null,
      file_name           text not null,
      storage_path        text not null,
      file_url            text,
      public_url          text,
      status              text not null default 'submitted',
      admin_notes         text,
      reviewed_by         uuid references auth.users(id) on delete set null,
      reviewed_at         timestamptz,
      created_at          timestamptz not null default now()
    );
  else
    alter table public.loan_documents
      add column if not exists file_url text,
      add column if not exists public_url text,
      add column if not exists status text default 'submitted',
      add column if not exists admin_notes text,
      add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
      add column if not exists reviewed_at timestamptz,
      add column if not exists created_at timestamptz default now();
  end if;
end $$;

alter table public.loan_documents enable row level security;

drop policy if exists "Borrowers read own loan documents" on public.loan_documents;
create policy "Borrowers read own loan documents"
  on public.loan_documents for select to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.loan_applications la
      where la.id = loan_documents.loan_application_id
        and la.user_id = auth.uid()
    )
  );

drop policy if exists "Borrowers insert own loan documents" on public.loan_documents;
create policy "Borrowers insert own loan documents"
  on public.loan_documents for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.loan_applications la
      where la.id = loan_documents.loan_application_id
        and la.user_id = auth.uid()
    )
  );

drop policy if exists "Borrowers delete own loan documents" on public.loan_documents;
create policy "Borrowers delete own loan documents"
  on public.loan_documents for delete to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.loan_applications la
      where la.id = loan_documents.loan_application_id
        and la.user_id = auth.uid()
    )
  );

drop policy if exists "Admins read all loan documents" on public.loan_documents;
create policy "Admins read all loan documents"
  on public.loan_documents for select to authenticated
  using (public.current_app_role() = 'admin');

drop policy if exists "Admins update loan documents" on public.loan_documents;
create policy "Admins update loan documents"
  on public.loan_documents for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('loan-documents', 'loan-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Borrowers upload own loan documents" on storage.objects;
create policy "Borrowers upload own loan documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'loan-documents'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 2
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.loan_applications la
      where la.id::text = (storage.foldername(name))[2]
        and la.user_id = auth.uid()
    )
  );

drop policy if exists "Borrowers read own loan documents" on storage.objects;
create policy "Borrowers read own loan documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'loan-documents'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 2
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.loan_applications la
      where la.id::text = (storage.foldername(name))[2]
        and la.user_id = auth.uid()
    )
  );

drop policy if exists "Borrowers delete own loan documents" on storage.objects;
create policy "Borrowers delete own loan documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'loan-documents'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 2
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.loan_applications la
      where la.id::text = (storage.foldername(name))[2]
        and la.user_id = auth.uid()
    )
  );

drop policy if exists "Admins read all loan documents" on storage.objects;
create policy "Admins read all loan documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'loan-documents'
    and public.current_app_role() = 'admin'
  );

drop policy if exists "Authenticated users upload KYC docs" on storage.objects;
drop policy if exists "Users upload own KYC docs" on storage.objects;
create policy "Users upload own KYC docs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners read their KYC docs" on storage.objects;
create policy "Owners read their KYC docs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Owners delete KYC docs" on storage.objects;
create policy "Owners delete KYC docs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'kyc-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Admins read all KYC docs" on storage.objects;
create policy "Admins read all KYC docs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and public.current_app_role() = 'admin'
  );
