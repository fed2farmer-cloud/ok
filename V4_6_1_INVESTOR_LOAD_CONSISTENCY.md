# SecuredLanding v4.6.1 — Investor Balance / Load Consistency

This patch removes the remaining investor-account mismatch path where Marketplace could display `investor_wallets.invested_balance` while Wallet and Portfolio calculated certificate ownership independently.

## Frontend

A new shared loader, `src/lib/investorPortfolio.ts`, is now used by:

- `src/InvestorWallet.tsx`
- `src/pages/InvestorDashboard.tsx`
- `src/pages/InvestorMarketplace.tsx`

All three screens now use the same ownership rule (`current_owner_id`, falling back to `investor_id` only when current owner is null), the same committed-status filter, and `investor_positions.current_principal` when available. Missing legacy position rows fall back to the investment amount rather than hiding the certificate.

Marketplace no longer trusts the cached `investor_wallets.invested_balance` for display; it replaces that field with the certificate-level result from the shared loader.

## Database

The migration makes `investor_wallets.invested_balance` a derived cache, updates it whenever `investor_positions.current_principal` changes, preserves the corrected NMI finalizer behavior (no double increment), syncs certificate positions after card purchases, and performs an all-account repair pass without hard-coded user IDs.

Run `VERIFY_V4_6_1_INVESTOR_LOAD_CONSISTENCY.sql` after the migration. Every wallet should report `mismatch_amount = 0`, and the missing-position query should return no active certificate rows.
