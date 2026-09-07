-- SecuredLanding: restore investor portfolio view and resolve the public loan
-- number through investments.loan_application_id when available.
drop view if exists public.investor_portfolio_v29;
create view public.investor_portfolio_v29 as
select
  i.id as investment_id,
  i.investor_id,
  coalesce(i.current_owner_id, i.investor_id) as current_owner_id,
  coalesce(i.original_investor_id, i.investor_id) as original_investor_id,
  i.certificate_uuid,
  i.certificate_number,
  i.certificate_issued_at,
  coalesce(i.transfer_count, 0) as transfer_count,
  coalesce(i.transfer_locked, false) as transfer_locked,
  i.loan_id as internal_loan_id,
  la.loan_number as public_loan_number,
  coalesce(ml.business_name, la.business_name, 'Investment') as business_name,
  i.amount,
  i.investor_interest_rate,
  i.term_months,
  i.status,
  i.created_at,
  i.refund_policy_enabled,
  i.refund_period_days,
  coalesce(i.protection_expires_at, i.refund_deadline) as protection_expires_at,
  i.refunded_at,
  i.settled_at,
  i.activated_at,
  case
    when i.status = 'protection_period' and coalesce(i.protection_expires_at, i.refund_deadline) > now() then 'Protected'
    when i.status in ('refund_requested','refund_processing') then 'Refund Processing'
    when i.status = 'refunded' then 'Refunded'
    when i.status in ('settled','active') then 'Active'
    when i.status = 'cancelled' then 'Cancelled'
    when i.status = 'failed' then 'Failed'
    else initcap(replace(coalesce(i.status,'pending'),'_',' '))
  end as display_status,
  (i.status = 'protection_period' and coalesce(i.protection_expires_at, i.refund_deadline) > now()) as refund_eligible
from public.investments i
join public.loan_applications la
  on la.id = coalesce(i.loan_application_id, i.loan_id)
left join public.marketplace_loans ml
  on ml.loan_application_id = la.id;

grant select on public.investor_portfolio_v29 to authenticated;
