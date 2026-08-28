create or replace function public.get_secondary_loan_performance_v1(p_loan_number bigint)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
with s as (
  select installment_number,due_date,expected_interest,expected_total,
         lower(coalesce(status,'')) as status,paid_at
  from public.loan_payment_schedule
  where loan_number=p_loan_number
), stats as (
  select
    count(*)::int as scheduled,
    count(*) filter (where status='paid')::int as paid,
    count(*) filter (where status='paid' and paid_at is not null
      and paid_at <= (due_date::timestamp + interval '1 day' - interval '1 second'))::int as on_time,
    count(*) filter (where status in ('late','missed','past_due','delinquent'))::int
      + count(*) filter (where status='paid' and paid_at is not null
        and paid_at > (due_date::timestamp + interval '1 day' - interval '1 second'))::int as late_missed,
    coalesce(sum(expected_interest) filter (where status not in ('paid','waived')),0)::numeric as remaining_interest
  from s
), nxt as (
  select due_date,expected_total
  from s
  where status not in ('paid','waived')
  order by installment_number
  limit 1
), l as (
  select coalesce(loan_amount,0)::numeric as loan_amount
  from public.loan_applications
  where loan_number=p_loan_number
  limit 1
)
select jsonb_build_object(
  'loan_number',p_loan_number,
  'paid',stats.paid,
  'on_time',stats.on_time,
  'late_missed',stats.late_missed,
  'scheduled',stats.scheduled,
  'next_date',nxt.due_date,
  'next_total',nxt.expected_total,
  'remaining_interest',stats.remaining_interest,
  'loan_amount',coalesce(l.loan_amount,0)
)
from stats
left join nxt on true
left join l on true;
$$;

grant execute on function public.get_secondary_loan_performance_v1(bigint) to authenticated;
notify pgrst,'reload schema';
