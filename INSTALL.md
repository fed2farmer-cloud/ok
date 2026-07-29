# SecuredLanding v3.3 — Investment Certificate & Ownership Registry

## Install

1. Run the full SQL migration in Supabase SQL Editor:
   `supabase/migrations/20260729_v3_3_investment_certificates.sql`
2. Replace these project files:
   - `src/features/investorprotection/portfolioV29Service.ts`
   - `src/components/PortfolioPositionCard.tsx`
3. Commit and redeploy through Vercel.
4. Open an investor Portfolio page and confirm every investment shows a certificate number.

## Certificate format

`SLI-YYYY-PUBLICLOANNUMBER-INVESTMENTID`

Example: `SLI-2026-889568-000123`

The public certificate number, certificate UUID, original owner, and issue date are immutable. Future secondary-market sales should update `current_owner_id` and append a row to `investment_ownership_history`; they should never replace the certificate identity.

## Important

This patch creates the ownership registry foundation only. It does not activate investor-to-investor sales, pricing, suitability checks, payment settlement, tax reporting, or transfer compliance.
