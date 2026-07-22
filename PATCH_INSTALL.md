# SecuredLanding v3.6.1 real patch

This archive contains actual source code, not placeholders.

## Replace these files

- `src/pages/InvestorMarketplace.tsx`
- `src/components/InvestorPropertyGallery.tsx`
- `src/components/BrandLogo.tsx`
- `src/components/AppLayout.tsx`

## Run this SQL once

Open Supabase → SQL Editor and run:

- `supabase/migrations/20260722_v3_6_1_investor_media_access.sql`

## What was fixed

- Video metadata is loaded from `loan_applications` instead of assuming it was copied into `marketplace_loans`.
- Property-photo query no longer requests the legacy/nonexistent `is_cover_photo` column.
- Storage paths are normalized when they contain bucket names or full URLs.
- Failed media requests stop loading and display a useful unavailable message.
- The header now uses the existing transparent SecuredLanding logo image rather than inverting the SVG into a white shield.

## Test

1. Deploy the four replacement files.
2. Run the SQL migration.
3. Redeploy Vercel.
4. Sign in as an investor and open Marketplace.
5. Confirm approved photos and approved video appear on the matching loan.
