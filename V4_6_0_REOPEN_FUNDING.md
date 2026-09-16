# SecuredLanding v4.6.0 — Admin Reopen Funding

This patch separates two different admin actions that were previously easy to confuse:

- **Refresh funding** recalculates funded dollars and funding status from the investment ledger. It does not extend an expired deadline.
- **Reopen Funding — 45 Days** starts a new 45-day funding window for an expired, underfunded loan while preserving existing qualifying investments.

## Admin behavior

The new button appears only when a loan still has money remaining and its funding status/deadline is expired. The admin receives a confirmation prompt before reopening.

The frontend calls `reopen_loan_funding_v1(p_loan_number, p_days)` with 45 days. The RPC:

1. Requires an authenticated admin for browser/PostgREST calls.
2. Rejects denied/cancelled loans.
3. Rejects loans that are already fully funded.
4. Preserves existing qualifying investments.
5. Resets `funding_started_at` and `funding_deadline`.
6. Reopens both `loan_applications` and `marketplace_loans`.
7. Calls `refresh_loan_funding_totals` so cached totals and the investor-funding checklist remain synchronized.

## Production note

The RPC is already installed in the current SecuredLanding Supabase production project and was used successfully to reopen Loan #460109. The included migration keeps the repository reproducible for future environments.

## Install

Replace the modified file using its exact path:

`src/components/AdminLoanReviewActions.tsx`

Run the migration only in an environment where `reopen_loan_funding_v1` has not already been installed, or run it safely as a `create or replace` migration.

Then deploy the frontend and test one expired underfunded loan. Confirm that the button disappears after a successful reopen and the loan label changes to **Funding**.
