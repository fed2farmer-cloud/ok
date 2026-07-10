# SecuredLanding Version 2 — Foundation Build

This package starts the Version 2 rebuild from the actual repository.

## Included now

- Corrected and build-tested Admin Dashboard.
- Admin document review controls with signed document links.
- Premium Admin header using the SecuredLanding logo.
- Login page no longer auto-redirects on page load.
- Admin route standardized at `/admin`.
- Transparent wallet policy: **100% of every new deposit is credited to Available Cash**.
- Removed reserve allocation and reserve wording from `api/deposit-funds.ts`.
- Added the first database migration for optional borrower introduction videos and borrower marketing summaries.

## Important wallet note

The API change affects new deposits. It does not automatically reimburse amounts withheld by earlier test deposits. Review any historical test reserve amounts before production and credit them manually if appropriate.

## Apply the migration

Run this file in the Supabase SQL Editor:

`supabase/migrations/20260710_v2_transparent_wallet_and_borrower_video.sql`

## Next V2 sprint

1. Shared premium header/footer on every application page.
2. Borrower video upload form with 2–5 minute guidance and preview.
3. Admin video approval workflow.
4. Premium investment detail page with borrower video, property gallery, verification badges, and investment calculator.
5. Transparent wallet redesign with Total Portfolio Value and running transaction balances.
