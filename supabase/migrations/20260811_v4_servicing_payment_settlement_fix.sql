-- SecuredLanding v4.1 servicing payment settlement fix
-- NON-DESTRUCTIVE. Adds the tested repayment safeguards around borrower_payments,
-- schedule settlement, duplicate protection, admin summary JSON, and auto schedule generation.

begin;
create extension if not exists pgcrypto;

-- Keep the borrower payment table compatible with NMI/manual/Square style payment rows.
alter table if exists public.borrower_payments add column if not exists payment_number bigint;
alter table if exists public.borrower_payments add column if not exists loan_number bigint;
alter table if exists public.borrower_payments add column if not exists borrower_user_id uuid;
alter table if exists public.borrower_payments add column if not exists schedule_id uuid;
alter table if exists public.borrower_payments add column if not exists processor text;
alter table if exists public.borrower_payments add column if not exists processor_transaction_id text;
alter table if exists public.borrower_payments add column if not exists idempotency_key text;
alter table if exists public.borrower_payments add column if not exists amount numeric(14,2);
alter table if exists public.borrower_payments add column if not exists status text;
alter table if exists public.borrower_payments add column if not exists raw_reference jsonb;
alter table if exists public.borrower_payments add column if not exists created_at timestamptz;
alter table if exists public.borrower_payments add column if not exists settled_at timestamptz;

alter table if exists public.borrower_payments alter column payment_number set default floor(random()*900000+100000)::bigint;
alter table if exists public.borrower_payments alter column processor set default 'manual_test';
alter table if exists public.borrower_payments alter column status set default 'pending';
alter table if exists public.borrower_payments alter column raw_reference set default '{}'::jsonb;
alter table if exists public.borrower_payments alter column created_at set default now();

update public.borrower_payments set payment_number = floor(random()*900000+100000)::bigint where payment_number is null;
update public.borrower_payments set processor = 'manual_test' where processor is null;
update public.borrower_payments set status = 'pending' where status is null;
update public.borrower_payments set raw_reference = '{}'::jsonb where raw_reference is null;
update public.borrower_payments set created_at = now() where created_at is null;

create unique index if not exists borrower_payments_payment_number_uidx on public.borrower_payments(payment_number) where payment_number is not null;
create unique index if not exists borrower_payments_idempotency_key_uidx on public.borrower_payments(idempotency_key) where idempotency_key is not null;
create index if not exists borrower_payments_loan_number_idx on public.borrower_payments(loan_number);
create index if not exists borrower_payments_schedule_id_idx on public.borrower_payments(schedule_id);

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'borrower_payments_status_check') then
    alter table public.borrower_payments drop constraint borrower_payments_status_check;
  end if;
end $$;

alter table public.borrower_payments
  add constraint borrower_payments_status_check
  check (
    status is null
    or lower(status) in (
      'created',
      'pending',
      'processing',
      'authorized',
      'paid',
      'completed',
      'settled',
      'failed',
      'canceled',
      'cancelled',
      'voided',
      'refunded',
      'reversed',
      'exception'
    )
  );

-- Reverse older duplicate settled rows before adding the uniqueness guard.
with ranked as (
  select
    id,
    row_number() over (
      partition by schedule_id
      order by coalesce(settled_at, created_at) desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.borrower_payments
  where schedule_id is not null
    and lower(status) = 'settled'
)
update public.borrower_payments bp
set
  status = 'reversed',
  settled_at = null,
  raw_reference = coalesce(bp.raw_reference, '{}'::jsonb) || jsonb_build_object(
    'auto_reversed_duplicate_settlement', true,
    'reversed_by_migration', '20260811_v4_servicing_payment_settlement_fix'
  )
from ranked r
where bp.id = r.id
  and r.rn > 1;

create unique index if not exists uq_borrower_payments_one_settled_per_schedule
on public.borrower_payments(schedule_id)
where schedule_id is not null
  and lower(status) = 'settled';

create or replace function public.generate_payment_schedule_v4(
  p_loan_number bigint,
  p_first_due date default (current_date + interval '1 month')::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  l record;
  r numeric;
  pmt numeric;
  bal numeric;
  ip numeric;
  pp numeric;
  i int;
  due date;
begin
  select
    loan_amount,
    coalesce(borrower_interest_rate, 10) as rate,
    coalesce(repayment_term_months, 12) as months
  into l
  from public.loan_applications
  where loan_number = p_loan_number;

  if not found then
    raise exception 'Loan % not found', p_loan_number;
  end if;

  if coalesce(l.months, 0) <= 0 then
    raise exception 'Loan % has invalid repayment term', p_loan_number;
  end if;

  delete from public.loan_payment_schedule where loan_number = p_loan_number;

  r := coalesce(l.rate, 10) / 100 / 12;
  bal := coalesce(l.loan_amount, 0);
  pmt := case when r = 0 then bal / l.months else bal * r / (1 - power(1 + r, -l.months)) end;
  due := p_first_due;

  for i in 1..l.months loop
    ip := round(bal * r, 2);
    pp := case when i = l.months then bal else least(round(pmt - ip, 2), bal) end;

    insert into public.loan_payment_schedule(
      loan_number,
      installment_number,
      due_date,
      expected_principal,
      expected_interest,
      status
    ) values (
      p_loan_number,
      i,
      due,
      pp,
      ip,
      'upcoming'
    );

    bal := greatest(bal - pp, 0);
    due := (due + interval '1 month')::date;
  end loop;

  return l.months;
end $$;

create or replace function public.auto_generate_payment_schedule_v4()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.loan_number is not null
     and coalesce(new.loan_amount, 0) > 0
     and coalesce(new.amount_funded, 0) >= coalesce(new.loan_amount, 0)
     and not exists (
       select 1
       from public.loan_payment_schedule s
       where s.loan_number = new.loan_number
     ) then
    perform public.generate_payment_schedule_v4(new.loan_number, (current_date + interval '1 month')::date);
  end if;

  return new;
end $$;

drop trigger if exists trg_auto_payment_schedule_insert_v4 on public.loan_applications;
create trigger trg_auto_payment_schedule_insert_v4
after insert on public.loan_applications
for each row execute function public.auto_generate_payment_schedule_v4();

drop trigger if exists trg_auto_payment_schedule_update_v4 on public.loan_applications;
create trigger trg_auto_payment_schedule_update_v4
after update of loan_number, loan_amount, amount_funded, status, borrower_interest_rate, repayment_term_months on public.loan_applications
for each row execute function public.auto_generate_payment_schedule_v4();

create or replace function public.mark_due_payments_v4()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.loan_payment_schedule
  set status = case
    when due_date < current_date then 'missed'
    when due_date = current_date then 'due'
    else status
  end
  where lower(status) in ('upcoming', 'due', 'late')
    and due_date <= current_date;

  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.settle_borrower_payment_v4(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.borrower_payments%rowtype;
  s public.loan_payment_schedule%rowtype;
  remaining numeric;
  principal numeric;
  interest numeric;
  unallocated numeric;
  pos record;
  total_pos numeric;
  share numeric;
begin
  select * into p
  from public.borrower_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if lower(coalesce(p.status, '')) = 'settled' and p.settled_at is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'payment_id', p.id);
  end if;

  if p.schedule_id is not null then
    select * into s
    from public.loan_payment_schedule
    where id = p.schedule_id
    for update;
  else
    select * into s
    from public.loan_payment_schedule
    where loan_number = p.loan_number
      and lower(status) in ('due', 'missed', 'late', 'partial', 'upcoming')
    order by
      case lower(status)
        when 'due' then 1
        when 'missed' then 2
        when 'late' then 3
        when 'partial' then 4
        else 5
      end,
      due_date,
      installment_number
    limit 1
    for update;
  end if;

  if not found then
    raise exception 'Schedule installment not found';
  end if;

  if exists (
    select 1
    from public.borrower_payments existing
    where existing.schedule_id = s.id
      and existing.id <> p.id
      and lower(existing.status) = 'settled'
  ) then
    update public.borrower_payments
    set
      status = 'reversed',
      schedule_id = s.id,
      raw_reference = coalesce(raw_reference, '{}'::jsonb) || jsonb_build_object(
        'duplicate_settlement_blocked', true,
        'blocked_at', now()
      )
    where id = p.id;

    return jsonb_build_object('ok', true, 'duplicate', true, 'reversed', true, 'payment_id', p.id, 'schedule_id', s.id);
  end if;

  remaining := coalesce(p.amount, 0);
  interest := least(remaining, greatest(coalesce(s.expected_interest, 0) - coalesce(s.collected_interest, 0), 0));
  remaining := remaining - interest;
  principal := least(remaining, greatest(coalesce(s.expected_principal, 0) - coalesce(s.collected_principal, 0), 0));
  remaining := remaining - principal;
  unallocated := greatest(remaining, 0);

  update public.loan_payment_schedule
  set
    collected_interest = coalesce(collected_interest, 0) + interest,
    collected_principal = coalesce(collected_principal, 0) + principal,
    status = case
      when coalesce(collected_interest, 0) + interest + coalesce(collected_principal, 0) + principal >= coalesce(expected_total, 0) - 0.01 then 'paid'
      else 'partial'
    end,
    paid_at = case
      when coalesce(collected_interest, 0) + interest + coalesce(collected_principal, 0) + principal >= coalesce(expected_total, 0) - 0.01 then now()
      else paid_at
    end
  where id = s.id;

  insert into public.payment_allocations(borrower_payment_id, loan_number, allocation_type, amount)
  select p.id, p.loan_number, allocation_type, amount
  from (values
    ('principal'::text, principal),
    ('investor_interest'::text, interest)
  ) as allocation_rows(allocation_type, amount)
  where amount > 0;

  select coalesce(sum(current_principal), 0) into total_pos
  from public.investor_positions
  where loan_number = p.loan_number
    and status = 'active';

  if total_pos > 0 then
    for pos in
      select *
      from public.investor_positions
      where loan_number = p.loan_number
        and status = 'active'
    loop
      share := pos.current_principal / total_pos;
      insert into public.investor_distributions(
        borrower_payment_id,
        loan_number,
        investor_user_id,
        principal_amount,
        interest_amount,
        status,
        available_at
      ) values (
        p.id,
        p.loan_number,
        pos.investor_user_id,
        round(principal * share, 2),
        round(interest * share, 2),
        'available',
        now()
      );
    end loop;
  end if;

  update public.borrower_payments
  set
    status = 'settled',
    schedule_id = s.id,
    settled_at = now(),
    raw_reference = coalesce(raw_reference, '{}'::jsonb) || jsonb_build_object(
      'settled_by', 'settle_borrower_payment_v4',
      'settled_at', now(),
      'principal', principal,
      'interest', interest,
      'unallocated', unallocated
    )
  where id = p.id;

  insert into public.loan_servicing_events(loan_number, event_type, amount, details)
  values (
    p.loan_number,
    'borrower_payment_settled',
    p.amount,
    jsonb_build_object('payment_id', p.id, 'schedule_id', s.id, 'principal', principal, 'interest', interest, 'unallocated', unallocated)
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'payment_id', p.id,
    'schedule_id', s.id,
    'principal', principal,
    'interest', interest,
    'unallocated', unallocated
  );
end $$;

create or replace function public.admin_servicing_summary_v4()
returns jsonb
language sql
security definer
set search_path = public
as $$
select jsonb_build_object(
  'loan_applications', (
    select jsonb_build_object(
      'total_loans', count(*),
      'funded_loans', count(*) filter (where coalesce(amount_funded, 0) >= coalesce(loan_amount, 0) and coalesce(loan_amount, 0) > 0),
      'approved_loans', count(*) filter (where lower(coalesce(status, '')) = 'approved'),
      'not_funded_loans', count(*) filter (where coalesce(amount_funded, 0) = 0),
      'partially_funded_loans', count(*) filter (where coalesce(amount_funded, 0) > 0 and coalesce(amount_funded, 0) < coalesce(loan_amount, 0))
    )
    from public.loan_applications
  ),
  'payment_schedule', (
    select jsonb_build_object(
      'schedule_rows', count(*),
      'due_rows', count(*) filter (where lower(status) = 'due'),
      'paid_rows', count(*) filter (where lower(status) = 'paid'),
      'missed_rows', count(*) filter (where lower(status) = 'missed'),
      'overdue_rows', count(*) filter (where lower(status) in ('late', 'missed')),
      'upcoming_rows', count(*) filter (where lower(status) = 'upcoming'),
      'expected_total', coalesce(sum(expected_total), 0),
      'collected_principal', coalesce(sum(collected_principal), 0),
      'collected_interest', coalesce(sum(collected_interest), 0),
      'collected_total', coalesce(sum(collected_principal + collected_interest), 0)
    )
    from public.loan_payment_schedule
  ),
  'borrower_payments', (
    select jsonb_build_object(
      'payment_rows', count(*),
      'pending_payments', count(*) filter (where lower(status) in ('pending', 'created', 'processing', 'authorized')),
      'completed_payments', count(*) filter (where lower(status) in ('paid', 'completed', 'settled')),
      'failed_payments', count(*) filter (where lower(status) in ('failed', 'canceled', 'cancelled', 'voided', 'refunded', 'reversed', 'exception')),
      'settled_amount', coalesce(sum(amount) filter (where lower(status) = 'settled'), 0),
      'reversed_amount', coalesce(sum(amount) filter (where lower(status) = 'reversed'), 0)
    )
    from public.borrower_payments
  ),
  'payment_allocations', (
    select jsonb_build_object(
      'allocation_rows', count(*),
      'allocated_amount', coalesce(sum(amount), 0),
      'principal_allocated', coalesce(sum(amount) filter (where allocation_type = 'principal'), 0),
      'interest_allocated', coalesce(sum(amount) filter (where allocation_type = 'investor_interest'), 0)
    )
    from public.payment_allocations
  ),
  'investor_positions', (
    select jsonb_build_object(
      'position_rows', count(*),
      'active_positions', count(*) filter (where status = 'active'),
      'original_principal', coalesce(sum(original_principal), 0),
      'current_principal', coalesce(sum(current_principal), 0)
    )
    from public.investor_positions
  ),
  'loan_notices', (
    select jsonb_build_object(
      'notice_rows', count(*),
      'pending_notices', count(*) filter (where status = 'queued'),
      'sent_notices', count(*) filter (where status = 'sent'),
      'read_notices', count(*) filter (where status = 'read')
    )
    from public.loan_notices
  ),
  'servicing_events', (
    select jsonb_build_object(
      'event_rows', count(*),
      'total_event_amount', coalesce(sum(amount), 0)
    )
    from public.loan_servicing_events
  )
);
$$;

commit;
