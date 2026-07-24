select
  la.id as loan_application_id,
  la.status,
  la.published_to_marketplace
from public.loan_applications la
left join public.marketplace_loans ml
  on ml.loan_application_id = la.id
where coalesce(la.published_to_marketplace, false) = true
  and ml.id is null;

select loan_application_id, count(*) as row_count
from public.marketplace_loans
group by loan_application_id
having count(*) > 1;
