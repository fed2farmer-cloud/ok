# SecuredLanding v4.5.4

## Purpose
Vercel rejected v4.5.3 after a successful build because the Hobby plan allows no more than 12 Serverless Functions and v4.5.3 contained 14 API files.

## Fix
- Consolidated Plaid link-token creation and public-token exchange into `api/plaid.ts` using an `action` request field.
- Updated the Plaid frontend to call `/api/plaid`.
- Removed the unused `api/wallet-transactions.ts` route. The active Investor Wallet already reads transaction history directly from Supabase.
- Removed the unused Clerk React dependency from `package.json` and `package-lock.json`.
- Removed active Railway helper/config references from the application source and replaced them with the current Vercel/Supabase architecture.
- Kept both Proof API handlers on Vercel.

## Result
The application now contains exactly 12 Vercel API functions.

## Proof variables
Keep Proof disabled until test credentials are available:

- `PROOF_ENVIRONMENT=fairfax`
- `PROOF_ENABLED=false`
- `PROOF_ALLOW_PLACE_ORDER=false`
- `PROOF_REQUIRE_ELIGIBILITY=true`
- `PROOF_TRANSACTION_TYPE=other`

Secret values to add when issued by Proof:

- `PROOF_API_KEY`
- `PROOF_WEBHOOK_SIGNING_KEY`

## Database
No new Supabase migration is required for v4.5.4. The v4.5.3 Proof migration already applied to the connected SecuredLanding project remains the required database schema.
