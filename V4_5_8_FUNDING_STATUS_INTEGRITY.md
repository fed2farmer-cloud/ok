# SecuredLanding v4.5.8 — Funding Status Integrity

This release makes funding status dollar-driven across every marketplace loan.

## Rules

- A loan is **Fully Funded** only when committed, non-terminal investment records reach the funding goal.
- A loan below its goal remains **Funding** while its funding window is open.
- A loan below its goal after the deadline becomes **Funding Closed — Underfunded** and stops accepting new primary investments.
- Investor protection-period certificates count toward the funding goal, but they do **not** make borrower funds releasable. The existing protection/disbursement workflow remains separate.
- Refunded, cancelled, failed, reversed, voided, or rejected investments do not count toward funded dollars.

## Database migration

Run:

`supabase/migrations/20260914_v4_5_8_funding_status_integrity.sql`

The migration immediately reviews all existing marketplace loans, recalculates funding totals from the investments ledger, repairs false `Funded` labels, and installs automatic investment triggers so the totals remain synchronized.

## Admin behavior

The old **Mark funded** button is removed. Admin now has **Refresh funding**, which recalculates funding from actual investment records. Manual status changes cannot manufacture funded dollars.

## Loan #460109 expected result

If the ledger contains $2,400 of qualifying commitments against a $40,000 goal, the loan will no longer display as Funded. It will show **Funding** while the window is open or **Funding Closed — Underfunded** after the deadline.
