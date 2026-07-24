# Secured Landing v2.8 Corrected Wallet Fix

This patch is built for the confirmed production schema.

## Confirmed mapping

- Public loan number: `889568`
- Internal `loan_applications.id`: `13`
- `marketplace_loans.id`: `22`
- `marketplace_loans.loan_application_id`: `13`

## Correct wallet behavior

A $10,000 wallet investment will atomically:

1. Find the marketplace row by public `loan_number`.
2. Resolve the internal `loan_application_id`.
3. Lock and validate `investor_wallets.available_balance`.
4. Subtract available cash.
5. Increase invested balance.
6. Create `investments.loan_id` using the internal loan ID.
7. Add a wallet debit transaction.
8. Update marketplace and loan application funding totals.
9. Start the investor-only seven-day refund period.
10. Roll everything back if any step fails.

## Installation

1. Back up Supabase.
2. Run:
   `supabase/migrations/20260724_v2_8_corrected_wallet_refund.sql`
3. Copy the `src` files into matching folders.
4. Replace the old wallet investment logic using:
   `docs/PAYMENTFORM_WALLET_REPLACEMENT.ts`
5. Add the routes in:
   `docs/APP_ROUTES.tsx`
6. Add `InvestorProtectionBadge` to marketplace cards.
7. Schedule hourly:

```sql
select public.settle_expired_investments_v28();
```

## Critical warning

Do not run the older v2.8 migration. It used column names that did not match
the confirmed production schema.

For card/ACH investments, the payment processor must be refunded before an
admin completes the database wallet refund.
