# SecuredLanding v2.9 Counteroffer Fix

## Corrected
- Counteroffer insert field names now match `public.loan_counteroffers`.
- Revision insert field names now match `public.loan_revision_requests`.
- Borrower UUID is attached to both workflow records and notifications.
- Supabase error objects are surfaced correctly.
- Loan IDs are converted to numbers for bigint foreign keys.

## Build
- Vite production build passed successfully.
