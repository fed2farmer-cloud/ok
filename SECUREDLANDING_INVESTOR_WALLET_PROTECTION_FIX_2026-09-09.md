# SecuredLanding Investor Wallet / Protection Expiry Fix — 2026-09-09

## What this fixes

The main investor portfolio correctly showed **$25,445 across 8 certificates**, but Investor Wallet showed only **$13,545 across 5 positions**. The missing $11,900 was three Loan #889568 certificates still carrying `protection_period` status.

This patch makes Investor Wallet count every still-owned committed certificate instead of filtering to `status = active`, while keeping terminal refunded/cancelled/failed records out of invested capital.

It also adds `settle_my_expired_investments_v1()`. Investor Wallet calls that RPC before loading its totals. Expired seven-day protection records are promoted to `active`, matching funding holds/ledger release, certificate-level investor positions, and loan funding totals.

## Files changed

- `src/InvestorWallet.tsx`
- `supabase/migrations/20260909_investor_wallet_protection_expiry_sync.sql`

## Deployment

1. Run `supabase/migrations/20260909_investor_wallet_protection_expiry_sync.sql` in the Supabase SQL Editor (or deploy it with your normal Supabase migration process).
2. Deploy the updated application.
3. Sign in as the investor and open **Investor Wallet** once. The wallet automatically settles that investor's legitimately expired protection records before loading.

## Expected result for the screenshot account

- Invested: **$25,445.00**
- Portfolio Total (with $0 available and $0 pending): **$25,445.00**
- Positions: **8**
- My Investments: **8 certificates**
- The three old $1,900 / $9,900 / $100 certificates should become active because their seven-day periods expired long ago.
- Estimated monthly yield should then include those activated certificates rather than the prior active-only $101.59 figure.

The UI remains tolerant during deployment: committed protection-period certificates are visible even before the migration RPC is available, but resale stays disabled until the backend has an active servicing position.
