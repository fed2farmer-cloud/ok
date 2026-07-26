# SecuredLanding v3.2.3 RPC Repair

This patch fixes the missing Supabase RPC:

`public.ensure_borrower_signature_requests(p_loan_application_id bigint)`

## Run order

1. In Supabase, open **SQL Editor** and create a new query.
2. Copy the complete contents of:
   `supabase/migrations/20260726_v3_2_3_signature_rpc_repair.sql`
3. Press **Run** once.
4. At the bottom, confirm the final result contains one row with:
   - function name: `ensure_borrower_signature_requests`
   - arguments: `p_loan_application_id bigint`
5. Wait 15–30 seconds, fully close the SecuredLanding browser tab, reopen it, and test the Borrower Closing Center.

## Only when the migration reports incompatible UUID columns

Run `RESET_PARTIAL_TABLES.sql`, then rerun the main migration. This reset removes only the unfinished electronic-signature tables. It does not remove loans, generated documents, users, investments, wallet transactions, or payments.

## Deployment

This is a Supabase database patch. No GitHub upload and no Vercel deployment are required.
