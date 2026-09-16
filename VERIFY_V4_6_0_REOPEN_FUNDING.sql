-- Read-only verification for SecuredLanding v4.6.0
-- Confirms the RPC exists and shows funding states for marketplace loans.

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'reopen_loan_funding_v1';

select
  la.loan_number,
  la.status as application_status,
  la.funding_status as application_funding_status,
  la.amount_funded,
  la.amount_remaining,
  la.funding_started_at,
  la.funding_deadline,
  ml.status as marketplace_status,
  ml.funding_status as marketplace_funding_status
from public.loan_applications la
left join public.marketplace_loans ml
  on ml.loan_application_id = la.id
where la.loan_number is not null
order by la.loan_number;
