-- SecuredLanding v4.1 servicing verification queries
-- Run after 20260811_v4_servicing_payment_settlement_fix.sql.

-- 1) Confirm helper functions exist.
select
  to_regprocedure('public.generate_payment_schedule_v4(bigint,date)') as payment_schedule_function,
  to_regprocedure('public.mark_due_payments_v4()') as mark_due_function,
  to_regprocedure('public.settle_borrower_payment_v4(uuid)') as settlement_function,
  to_regprocedure('public.admin_servicing_summary_v4()') as admin_summary_function;

-- 2) Confirm auto schedule triggers exist.
select
  trigger_name,
  event_manipulation,
  action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'loan_applications'
  and trigger_name in (
    'trg_auto_payment_schedule_insert_v4',
    'trg_auto_payment_schedule_update_v4'
  )
order by trigger_name, event_manipulation;

-- 3) Confirm the duplicate settled-payment guard exists.
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'borrower_payments'
  and indexname = 'uq_borrower_payments_one_settled_per_schedule';

-- 4) Find any duplicate settled rows that still need cleanup. Expected result: 0 rows.
select
  schedule_id,
  count(*) as settled_count
from public.borrower_payments
where schedule_id is not null
  and lower(status) = 'settled'
group by schedule_id
having count(*) > 1;

-- 5) Admin summary JSON.
select
  key,
  value
from jsonb_each(public.admin_servicing_summary_v4())
order by key;

-- 6) Per-loan servicing summary. Replace 977005 with another loan number as needed.
select
  la.loan_number,
  la.loan_amount,
  la.amount_funded,
  count(lps.id) as schedule_rows,
  sum(lps.expected_total) as expected_total,
  sum(lps.collected_principal) as collected_principal,
  sum(lps.collected_interest) as collected_interest,
  sum(lps.collected_principal + lps.collected_interest) as collected_total,
  count(*) filter (where lower(lps.status) = 'paid') as paid_rows,
  count(*) filter (where lower(lps.status) = 'missed') as missed_rows,
  count(*) filter (where lower(lps.status) = 'upcoming') as upcoming_rows
from public.loan_applications la
left join public.loan_payment_schedule lps
  on lps.loan_number = la.loan_number
where la.loan_number = 977005
group by la.loan_number, la.loan_amount, la.amount_funded;

-- 7) First three installments for a loan. Replace 977005 with another loan number as needed.
select
  installment_number as inst,
  status,
  collected_principal as principal,
  collected_interest as interest,
  expected_total,
  due_date
from public.loan_payment_schedule
where loan_number = 977005
  and installment_number in (1, 2, 3)
order by installment_number;
