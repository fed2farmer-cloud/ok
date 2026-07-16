-- SecuredLanding v3.1.5 — Promissory note delivery
-- Adds a generated secured promissory note to approved loans that do not already have one.
-- Review all production loan forms with qualified lending counsel before use.

insert into public.generated_loan_documents (
  loan_application_id,
  borrower_user_id,
  document_type,
  title,
  status,
  terms_snapshot,
  updated_at
)
select
  la.id,
  la.user_id,
  'promissory_note',
  'Secured Promissory Note',
  'ready_for_review',
  jsonb_build_object(
    'loan_number', coalesce(la.loan_number, la.id),
    'borrower_name', coalesce(la.full_name, ''),
    'business_name', coalesce(la.business_name, ''),
    'property_address', coalesce(la.property_address, ''),
    'apn', coalesce(la.apn, ''),
    'county', coalesce(la.county, ''),
    'state', coalesce(la.state, ''),
    'approved_loan_amount', coalesce(la.loan_amount, 0),
    'borrower_interest_rate', coalesce(la.borrower_interest_rate, 10),
    'investor_interest_rate', coalesce(la.investor_interest_rate, 9),
    'repayment_term_months', coalesce(la.repayment_term_months, 36),
    'monthly_payment', case
      when coalesce(la.loan_amount, 0) = 0 then 0
      when coalesce(la.borrower_interest_rate, 0) = 0 then
        coalesce(la.loan_amount, 0) / greatest(coalesce(la.repayment_term_months, 36), 1)
      else
        (coalesce(la.loan_amount, 0) * (coalesce(la.borrower_interest_rate, 10) / 100.0 / 12.0)) /
        (1 - power(1 + (coalesce(la.borrower_interest_rate, 10) / 100.0 / 12.0), -greatest(coalesce(la.repayment_term_months, 36), 1)))
    end,
    'generated_at', now()
  ),
  now()
from public.loan_applications la
where lower(coalesce(la.status, '')) in ('approved', 'funded')
  and not exists (
    select 1
    from public.generated_loan_documents gd
    where gd.loan_application_id = la.id
      and gd.document_type = 'promissory_note'
  );
