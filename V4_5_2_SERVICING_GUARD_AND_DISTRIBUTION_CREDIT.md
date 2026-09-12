# SecuredLanding v4.5.2 — Servicing Guard + Distribution Wallet Credit

## Why this build exists
Loan #460109 exposed two servicing defects before a live repayment was attempted:

1. A repayment schedule could exist before the loan was fully funded and borrower funds were released.
2. The settlement routine created investor distribution rows but did not move principal + investor interest into the current certificate owner's wallet.
3. The repayment page called `finalize_borrower_repayment_v1`, but that RPC was missing from the live database.

## Changes
- Adds `borrower_repayment_preflight_v1`.
- Restores `finalize_borrower_repayment_v1`.
- Adds `credit_available_distributions_v2`.
- Adds duplicate-protection indexes for processor transaction IDs and wallet ledger idempotency keys.
- Locks schedule generation until the funding disbursement is actually `released` and funding has fully cleared.
- Removes only premature schedules that have no borrower payment history and no released disbursement.
- Repayment UI now checks eligibility before the NMI card charge.
- Borrower Repayment Center shows a clear `Repayment locked` state instead of a live payment link when a loan is not ready.
- Investor repayment distributions credit the CURRENT certificate owner, including after an immediate secondary-market resale.

## Loan #460109 after this migration
Loan #460109 remains partially funded and has no released borrower disbursement, so repayment is intentionally locked. Its premature schedule is removed because it has no borrower payment history.

Do not force #460109 into servicing by changing balances manually. Finish funding, clear the investor-protection hold, approve/release the borrower disbursement, then the schedule can be generated and the repayment test can proceed.
