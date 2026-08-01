-- SecuredLanding marketplace lookup / synchronization patch
-- Run in Supabase SQL Editor.
begin;

create index if not exists marketplace_loans_loan_number_idx
  on public.marketplace_loans (loan_number);

-- Repair missing public loan numbers on existing marketplace rows.
update public.marketplace_loans ml
set loan_number = la.loan_number,
    updated_at = now()
from public.loan_applications la
where ml.loan_application_id = la.id
  and (ml.loan_number is null or ml.loan_number <> la.loan_number);

-- Ensure every approved + published application has its canonical marketplace row.
insert into public.marketplace_loans (
  loan_application_id, loan_number, business_name, borrower_name, apn, county,
  state, acreage, land_value, loan_amount, borrower_interest_rate,
  investor_interest_rate, company_spread_rate, repayment_term_months,
  risk_score, funding_goal, amount_funded, amount_remaining, status,
  borrower_video_path, borrower_video_status, published, updated_at
)
select
  la.id, la.loan_number, la.business_name, la.full_name, la.apn, la.county,
  la.state, la.acreage, coalesce(la.land_value,0), coalesce(la.loan_amount,0),
  coalesce(la.borrower_interest_rate,10), coalesce(la.investor_interest_rate,9),
  coalesce(la.company_spread_rate,1), coalesce(la.repayment_term_months,36),
  coalesce(la.risk_score,'Pending'), coalesce(la.loan_amount,0),
  coalesce(la.amount_funded,0),
  greatest(coalesce(la.loan_amount,0)-coalesce(la.amount_funded,0),0),
  case when coalesce(la.amount_funded,0) >= coalesce(la.loan_amount,0)
       and coalesce(la.loan_amount,0) > 0 then 'Funded' else 'Open' end,
  la.borrower_video_path, coalesce(la.borrower_video_status,'not_submitted'),
  true, now()
from public.loan_applications la
where lower(coalesce(la.status,'')) = 'approved'
  and coalesce(la.published_to_marketplace,false) = true
on conflict (loan_application_id) do update set
  loan_number = excluded.loan_number,
  business_name = excluded.business_name,
  borrower_name = excluded.borrower_name,
  apn = excluded.apn,
  county = excluded.county,
  state = excluded.state,
  acreage = excluded.acreage,
  land_value = excluded.land_value,
  loan_amount = excluded.loan_amount,
  borrower_interest_rate = excluded.borrower_interest_rate,
  investor_interest_rate = excluded.investor_interest_rate,
  company_spread_rate = excluded.company_spread_rate,
  repayment_term_months = excluded.repayment_term_months,
  risk_score = excluded.risk_score,
  funding_goal = excluded.funding_goal,
  borrower_video_path = excluded.borrower_video_path,
  borrower_video_status = excluded.borrower_video_status,
  published = true,
  updated_at = now();

notify pgrst, 'reload schema';
commit;

-- Diagnostic: these should return marketplace rows for the two loans in the screenshots.
select id, loan_application_id, loan_number, funding_goal, amount_funded,
       amount_remaining, status, published
from public.marketplace_loans
where loan_number in (352552, 480946)
order by loan_number;
