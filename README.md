# SecuredLanding v4.4.0 — Secondary Market Price Adjustment

This is an overlay/update bundle, not a full repository snapshot. It adds seller-controlled secondary-market asking prices and certificate ownership transfer. It is designed around the SecuredLanding schema already verified in the project: `investments`, `investor_positions`, `investment_ownership_history`, `investor_wallets`, and Loan Security Certificate ownership.

## Requested $1,000 → $900 test

Investment ID 10 / certificate `SLI-2026-361380-000010` can be listed by its current authenticated owner for `$900` using the included sell form. The asking price is intentionally independent from original principal and current outstanding principal.

## Files

- `supabase/migrations/20260825_v4_4_0_secondary_market_price_adjustment.sql` — listing/trade tables, RLS, seller-price RPC, purchase RPC, certificate-owner transfer, wallet movement.
- `src/lib/secondaryMarket.ts` — frontend Supabase helpers.
- `src/components/SecondaryMarketSellForm.tsx` — adjustable asking-price form with a `$900` quick-set when original principal is `$1,000`.
- `src/pages/SecondaryMarket.tsx` — buyer marketplace page.
- `tests/SECONDARY_MARKET_TEST_PLAN.md` — exact end-to-end test for certificate `...000010`.

## Integration

1. Apply the SQL migration in Supabase.
2. Copy the `src` files into the matching paths in the existing SecuredLanding repo.
3. Add `/secondary-market` to the existing React Router configuration pointing to `SecondaryMarket`.
4. Render `SecondaryMarketSellForm` from the existing investment-detail/My Investments UI, passing the investment's ID, certificate number, original principal, and current principal.
5. Test with two separate investor accounts.

## Build/test status

The TypeScript/TSX files were syntax-parsed in this bundle, but a full `npm build` cannot be truthfully run without the current SecuredLanding repository/package manifest. Do not treat this overlay as a full-repo build artifact.

## Compliance note

A secondary market for investment interests can trigger securities, broker-dealer/ATS, transfer, suitability/eligibility, KYC/AML, state-law, and disclosure requirements. Keep this feature disabled for public production trading until counsel approves the actual launch structure.
