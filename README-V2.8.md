# Secured Landing Version 2.8

## Investor-only 7-day protection

This upgrade adds a seven-day cancellation/refund period exclusively to investor investments.

It does **not** create a borrower refund, rescission, or loan-cancellation feature.

## Included

- Supabase migration for protected investments
- Refund deadlines calculated from the successful investment timestamp
- Protected funds excluded from borrower-disbursable funds
- Investor refund RPC
- Admin refund-completion RPC
- Wallet transaction/audit records
- Investor notifications
- Marketplace protection badge
- Investor countdown/refund card
- Admin refund page
- Hourly settlement function for expired protection windows

## Install

1. Copy `supabase/migrations/20260724_secured_landing_v2_8_investor_protection.sql`
   into the current repository.
2. Run the migration in Supabase SQL Editor.
3. Copy the files under `src/` into the matching project folders.
4. Add `InvestorProtectionBadge` to each marketplace loan card.
5. Add `InvestorProtectionCard` to the investor dashboard investment list.
6. Add a protected admin route for `AdminInvestmentRefunds`.
7. Schedule this SQL hourly with Supabase Cron:

```sql
select public.settle_expired_investment_protection();
```

8. Make borrower disbursement logic read
   `public.loan_disbursement_availability.available_for_disbursement`.
   Never disburse `protected_funds`.

## Required payment integration

The database records the refund and wallet credit. For card/ACH payments, connect
your NMI/payment-processor refund endpoint before calling
`complete_investment_refund`. Only mark the request completed after the processor
confirms success.

## Recommended routes

```tsx
<Route path="/admin/investment-refunds" element={<AdminInvestmentRefunds />} />
```

## Marketplace example

```tsx
<InvestorProtectionBadge
  enabled={loan.investor_refund_enabled}
  days={loan.investor_refund_days}
/>
```

## Important deployment note

This is an upgrade package rather than a complete replacement application because
the latest project source ZIP was not available in the file library. Apply it to
the current GitHub `main` branch, test in a Supabase staging project, then deploy.
