# Secured Landing Wallet Atomic Fix — 2026-08-07

Confirmed historical correction:
- available_balance = 0
- invested_balance = 77,615

This package does not change that corrected historical value.

For future `Invest From Wallet` operations, the included PostgreSQL RPC performs the investment insert, available-balance deduction, invested-balance increase, wallet transaction, and marketplace funding update inside one database transaction. It also adds an idempotency key to prevent a retried request from charging the wallet twice.

Install:
1. Run `supabase/migrations/20260807_atomic_wallet_investment.sql` in Supabase SQL Editor.
2. Add `src/lib/walletInvestment.ts`.
3. Update the existing InvestorMarketplace `Invest From Wallet` handler to call `investFromWalletAtomic(loanId, amount)` instead of separate database writes.
4. Refresh wallet and marketplace data after a successful call.

Important: because the live Secured Landing schema has changed over multiple versions, run the SQL migration first. If Supabase reports a renamed/missing column in `wallet_transactions`, use that error to map the live column before changing the frontend.
