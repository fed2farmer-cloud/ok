-- Secured Landing v2.3.0 Closing Center
-- Compatible with public.loan_applications.id bigint.

create extension if not exists pgcrypto;

create table if not exists public.loan_closings (
  id uuid primary key default gen_random_uuid(),
  loan_application_id bigint not null unique references public.loan_applications(id) on delete cascade,
  borrower_user_id uuid references auth.users(id) on delete cascade,
  stage text not null default 'borrower_actions',
  progress_percent integer not null default 12 check (progress_percent between 0 and 100),
  approved_loan_amount numeric(14,2) not null default 0,
  borrower_interest_rate numeric(7,3) not null default 0,
  investor_interest_rate numeric(7,3) not null default 0,
  repayment_term_months integer not null default 36,
  monthly_payment numeric(14,2),
  terms_locked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.closing_tasks (
  id uuid primary key default gen_random_uuid(),
  loan_closing_id uuid not null references public.loan_closings(id) on delete cascade,
  loan_application_id bigint not null references public.loan_applications(id) on delete cascade,
  task_key text not null,
  title text not null,
  status text not null default 'pending' check (status in ('pending','submitted','complete','waived','blocked')),
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (loan_application_id, task_key)
);

create table if not exists public.borrower_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_application_id bigint references public.loan_applications(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null default 'loan_update',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.loan_timeline_events (
  id uuid primary key default gen_random_uuid(),
  loan_application_id bigint not null references public.loan_applications(id) on delete cascade,
  event_key text not null,
  title text not null,
  description text,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists loan_closings_borrower_user_id_idx on public.loan_closings (borrower_user_id);
create index if not exists closing_tasks_loan_closing_id_idx on public.closing_tasks (loan_closing_id);
create index if not exists borrower_notifications_user_id_idx on public.borrower_notifications (user_id);
create index if not exists loan_timeline_events_application_id_idx on public.loan_timeline_events (loan_application_id);

alter table public.loan_closings enable row level security;
alter table public.closing_tasks enable row level security;
alter table public.borrower_notifications enable row level security;
alter table public.loan_timeline_events enable row level security;

create or replace function public.is_secured_landing_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;

drop policy if exists "Borrowers view own closings" on public.loan_closings;
create policy "Borrowers view own closings" on public.loan_closings for select
using (borrower_user_id = auth.uid() or public.is_secured_landing_admin());

drop policy if exists "Admins manage closings" on public.loan_closings;
create policy "Admins manage closings" on public.loan_closings for all
using (public.is_secured_landing_admin()) with check (public.is_secured_landing_admin());

drop policy if exists "Borrowers view own closing tasks" on public.closing_tasks;
create policy "Borrowers view own closing tasks" on public.closing_tasks for select
using (exists(select 1 from public.loan_applications l where l.id = closing_tasks.loan_application_id and (l.user_id = auth.uid() or public.is_secured_landing_admin())));

drop policy if exists "Admins manage closing tasks" on public.closing_tasks;
create policy "Admins manage closing tasks" on public.closing_tasks for all
using (public.is_secured_landing_admin()) with check (public.is_secured_landing_admin());

drop policy if exists "Users view own notifications" on public.borrower_notifications;
create policy "Users view own notifications" on public.borrower_notifications for select
using (user_id = auth.uid() or public.is_secured_landing_admin());

drop policy if exists "Admins create notifications" on public.borrower_notifications;
create policy "Admins create notifications" on public.borrower_notifications for insert
with check (public.is_secured_landing_admin());

drop policy if exists "Users update own notifications" on public.borrower_notifications;
create policy "Users update own notifications" on public.borrower_notifications for update
using (user_id = auth.uid() or public.is_secured_landing_admin())
with check (user_id = auth.uid() or public.is_secured_landing_admin());

drop policy if exists "Borrowers view own timeline" on public.loan_timeline_events;
create policy "Borrowers view own timeline" on public.loan_timeline_events for select
using (exists(select 1 from public.loan_applications l where l.id = loan_timeline_events.loan_application_id and (l.user_id = auth.uid() or public.is_secured_landing_admin())));

drop policy if exists "Admins manage timeline" on public.loan_timeline_events;
create policy "Admins manage timeline" on public.loan_timeline_events for all
using (public.is_secured_landing_admin()) with check (public.is_secured_landing_admin());
