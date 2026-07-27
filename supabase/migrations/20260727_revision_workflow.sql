alter table public.loan_applications
add column if not exists revision_status text,
add column if not exists revision_requested_at timestamptz,
add column if not exists revision_requested_by uuid,
add column if not exists revision_submitted_at timestamptz,
add column if not exists revision_message text,
add column if not exists revision_items jsonb default '[]'::jsonb,
add column if not exists revision_count integer default 0;

create table if not exists public.loan_revision_requests(
 id uuid primary key default gen_random_uuid(),
 loan_application_id uuid references public.loan_applications(id) on delete cascade,
 requested_by uuid,
 message text,
 requested_items jsonb default '[]'::jsonb,
 status text default 'pending',
 requested_at timestamptz default now(),
 borrower_submitted_at timestamptz,
 reviewed_at timestamptz,
 reviewed_by uuid
);
