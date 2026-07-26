-- A. The function must appear as one row with a bigint argument.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'ensure_borrower_signature_requests';

-- B. Check the repaired request-table ID types.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'document_signature_requests'
  and column_name in ('generated_document_id', 'loan_application_id')
order by column_name;

-- C. Find an internal bigint ID using a six-digit public loan number.
-- Replace 977005 with the loan being tested.
select id, loan_number, business_name, user_id
from public.loan_applications
where loan_number::text = '977005';

-- D. Direct SQL Editor test only: replace 123 with the internal ID from C.
-- SQL Editor has no borrower auth.uid(), so this direct call may correctly
-- report Authentication required. The website test is authoritative.
-- select public.ensure_borrower_signature_requests(123::bigint);
