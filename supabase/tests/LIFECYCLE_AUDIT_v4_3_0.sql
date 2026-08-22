-- Read-only lifecycle audit after deploying v4.3.0
select * from public.admin_lifecycle_health_v1 order by loan_number;

select loan_number,status,funding_goal,sold_amount,protected_amount,releasable_amount,processor,processor_reference,released_at
from public.loan_funding_disbursements order by updated_at desc;

select loan_number,count(*) schedule_rows,
       count(*) filter(where status='paid') paid_installments,
       coalesce(sum(expected_total),0) expected_total,
       coalesce(sum(collected_principal+collected_interest),0) collected_total
from public.loan_payment_schedule group by loan_number order by loan_number;

select loan_number,status,count(*) rows,coalesce(sum(amount),0) amount
from public.borrower_payments group by loan_number,status order by loan_number,status;

select loan_number,status,count(*) rows,
       coalesce(sum(principal_amount),0) principal,
       coalesce(sum(interest_amount),0) interest
from public.investor_distributions group by loan_number,status order by loan_number,status;
