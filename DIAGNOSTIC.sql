-- OPTIONAL DIAGNOSTIC ONLY
-- Run this in Supabase SQL Editor if approval still reports
-- generated_loan_documents_status_check after deploying the TS patch.

select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.generated_loan_documents'::regclass
  and conname = 'generated_loan_documents_status_check';

-- Also see statuses already stored:
select status, count(*)
from public.generated_loan_documents
group by status
order by status;
