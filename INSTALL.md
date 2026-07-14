# SecuredLanding v2.5.0 Installation

1. Upload this project to the GitHub repository root.
2. In Supabase, open **SQL Editor → New query**.
3. Copy and run the complete contents of `MASTER_MIGRATION.sql`.
4. Confirm the result says **Success. No rows returned**.
5. Redeploy the latest `main` branch in Vercel.
6. Sign in as admin and press **Refresh Data**.

The master migration adds the missing `marketplace_loans.borrower_video_path` and `generated_loan_documents.terms_snapshot` columns, video review fields, closing-center tables, indexes, policies, and a PostgREST schema reload notification.
