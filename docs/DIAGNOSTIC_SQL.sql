-- Confirm the known mapping.
select
  la.id as internal_loan_id,
  la.loan_number,
  ml.id as marketplace_id,
  ml.loan_application_id,
  ml.amount_funded,
  ml.amount_remaining
from public.loan_applications la
join public.marketplace_loans ml
  on ml.loan_application_id = la.id
where la.loan_number = 889568;

-- Confirm wallet debit and invested balance.
select
  user_id,
  available_balance,
  invested_balance,
  updated_at
from public.investor_wallets
order by updated_at desc;

-- Confirm investment uses internal loan id.
select
  id,
  loan_id,
  investor_id,
  amount,
  status,
  refund_deadline,
  created_at
from public.investments
order by created_at desc
limit 20;

-- Confirm funding totals.
select
  loan_number,
  loan_application_id,
  amount_funded,
  amount_remaining,
  protected_funds,
  settled_funds
from public.marketplace_loans
where loan_number = 889568;
