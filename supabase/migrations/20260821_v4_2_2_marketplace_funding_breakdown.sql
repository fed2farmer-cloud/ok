-- SecuredLanding v4.2.2
-- Marketplace funding breakdown: Sold / Pending Protection / Available
-- Safe to re-run.

create or replace view public.marketplace_funding_breakdown_v1 as
select
    ml.id as marketplace_id,
    la.id as loan_application_id,
    la.loan_number,
    coalesce(
        la.loan_amount,
        la.approved_loan_amount,
        la.requested_loan_amount,
        ml.funding_goal,
        ml.loan_amount,
        0
    )::numeric as funding_goal,
    coalesce(sum(i.amount) filter (
        where lower(coalesce(i.status,'')) in
        ('active','funded','completed','settled')
    ),0)::numeric as sold_amount,
    coalesce(sum(i.amount) filter (
        where lower(coalesce(i.status,'')) = 'protection_period'
    ),0)::numeric as protected_amount
from public.loan_applications la
join public.marketplace_loans ml
  on ml.loan_application_id = la.id
left join public.investments i
  on i.loan_application_id = la.id
  and lower(coalesce(i.status,'')) not in
      ('refunded','cancelled','canceled','failed')
group by
    ml.id,
    la.id,
    la.loan_number,
    la.loan_amount,
    la.approved_loan_amount,
    la.requested_loan_amount,
    ml.funding_goal,
    ml.loan_amount;

grant select on public.marketplace_funding_breakdown_v1 to authenticated;
notify pgrst, 'reload schema';
