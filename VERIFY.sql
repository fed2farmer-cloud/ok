-- Expected result: two rows, one with two arguments and one with four.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'respond_to_loan_counteroffer'
order by arguments;

-- Confirm PostgREST received the schema reload notification by waiting a few
-- seconds, refreshing the app, and accepting/rejecting the counteroffer again.
