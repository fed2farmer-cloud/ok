# SecuredLanding v4.5.1 — Secondary Market Seller Access Restore

## Diagnosis
The seller UI was hidden for valid certificates because Investor Wallet required a readable `investor_positions` row before rendering the Sell button. Production had RLS enabled on `investor_positions` and the v2 secondary-market tables but the required SELECT policies were missing. The production schema also no longer contained `cancel_secondary_listing_v2`, even though the frontend client still calls it.

The mobile menu was also using the account's borrower metadata, so a borrower who also owns certificates did not receive investor navigation.

## Fixes
- `src/InvestorWallet.tsx`
  - Sell Certificate is no longer hidden solely because a client-side investor-position read fails.
  - The server-side `create_secondary_listing_v2` RPC remains the authoritative eligibility check.
  - Position reads are owner-filtered and errors are logged instead of silently removing seller controls.
- `src/components/AppLayout.tsx`
  - Borrowers who own at least one certificate receive Investments and Secondary Market menu entries without losing borrower navigation.
- `supabase/migrations/20260911_v4_5_1_restore_secondary_market_seller_access.sql`
  - Restores owner SELECT policy for `investor_positions`.
  - Restores open/owner SELECT policies for secondary-market v2 tables.
  - Restores `cancel_secondary_listing_v2`.

## Expected test account behavior
`1709ralphave@gmail.com` should see Sell Certificate on each valid active certificate. The unlinked `$200` / Loan #0 certificate remains blocked until its underlying loan is repaired.
