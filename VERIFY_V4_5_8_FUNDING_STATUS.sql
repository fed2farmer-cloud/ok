-- SecuredLanding v4.5.8 - read-only funding integrity verification
-- Run after 20260914_v4_5_8_funding_status_integrity.sql.

with funding as (
  select
    la.id as loan_application_id,
    la.loan_number,
    coalesce(nullif(ml.funding_goal,0), nullif(ml.loan_amount,0), nullif(la.approved_loan_amount,0), nullif(la.loan_amount,0), nullif(la.requested_loan_amount,0), 0) as goal,
    coalesce(sum(i.amount) filter (
      where lower(coalesce(i.status,'active')) not in
        ('refunded','cancelled','canceled','failed','reversed','void','voided','rejected')
    ),0) as ledger_committed,
    la.amount_funded as application_amount_funded,
    ml.amount_funded as marketplace_amount_funded,
    la.status as application_status,
    la.funding_status as application_funding_status,
    ml.status as marketplace_status,
    ml.funding_status as marketplace_funding_status,
    coalesce(ml.funding_deadline, la.funding_deadline) as funding_deadline
  from public.loan_applications la
  join public.marketplace_loans ml on ml.loan_application_id = la.id
  left join public.investments i
    on i.loan_application_id = la.id
    or i.loan_id = la.id
    or (la.loan_number is not null and i.loan_id = la.loan_number)
  group by la.id, la.loan_number, la.approved_loan_amount, la.loan_amount, la.requested_loan_amount,
           la.amount_funded, la.status, la.funding_status, la.funding_deadline,
           ml.funding_goal, ml.loan_amount, ml.amount_funded, ml.status, ml.funding_status, ml.funding_deadline
)
select
  *,
  greatest(goal-ledger_committed,0) as expected_remaining,
  case
    when goal > 0 and ledger_committed >= goal - 0.009 then 'FULLY_FUNDED'
    when funding_deadline is not null and funding_deadline <= now() then 'EXPIRED_UNDERFUNDED'
    else 'FUNDING'
  end as expected_funding_state,
  case
    when coalesce(application_amount_funded,0) = ledger_committed
     and coalesce(marketplace_amount_funded,0) = ledger_committed
     and not (lower(coalesce(application_status,''))='funded' and ledger_committed < goal - 0.009)
    then 'OK'
    else 'REVIEW'
  end as integrity_check
from funding
order by loan_number nulls last;

-- Focused test loan check.
select
  la.loan_number,
  la.status as application_status,
  la.funding_status as application_funding_status,
  la.amount_funded as application_amount_funded,
  ml.status as marketplace_status,
  ml.funding_status as marketplace_funding_status,
  ml.funding_goal,
  ml.amount_funded as marketplace_amount_funded,
  ml.amount_remaining,
  ml.funding_deadline
from public.loan_applications la
left join public.marketplace_loans ml on ml.loan_application_id=la.id
where la.loan_number=460109;
