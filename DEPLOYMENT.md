# Deployment

1. Back up the current repository.
2. Replace the repository contents with this package, excluding any local `.env` files.
3. In Supabase SQL Editor, run:
   - `20260713_random_public_loan_numbers.sql`
   - `supabase/migrations/20260713_v2_3_0_closing_center.sql`
   - `supabase/migrations/20260713_v2_3_1_document_delivery.sql`
4. Commit and push to GitHub.
5. Confirm the Vercel build succeeds.
6. Open an approved loan in Admin and approve it again to create Closing Center and form records.
