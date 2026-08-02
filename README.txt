SecuredLanding v2.8.1 — Investor 7-Day Refund Patch

CONTENTS
1. supabase/migrations/20260801_investor_refund_atomic.sql
2. src/pages/InvestorPortfolio.tsx
3. INSTALL.txt

WHAT THIS PATCH DOES
- Keeps the refund policy investor-only.
- Uses the confirmed investments.refund_policy_enabled / refund_period_days / refund_deadline fields.
- Backfills missing deadlines from created_at, not from today's date.
- Automatically sets deadlines for future investments.
- Shows the refund button only while the investment is eligible.
- Processes refund through one PostgreSQL RPC transaction.
- Prevents refunds by non-owners, expired refunds, settled/refunded/processing investments, and double refunds.
- Returns principal to available investor wallet cash.
- Reverses funding totals on marketplace/loan records when matching loan numbers are available.
- Locks refunded certificates/investments against transfer.
- Writes a refund audit record and investor notification.

IMPORTANT
The SQL migration must be run before deploying InvestorPortfolio.tsx.
The migration is defensive around wallet balance column naming, but it expects public.investor_wallets to exist.
This patch does NOT give borrowers a cancellation/refund right.
