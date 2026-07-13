# Deployment

1. Run `supabase/migrations/20260713_v2_3_0_closing_center.sql` in the Supabase SQL Editor.
2. Upload the three TypeScript files into the matching repository folders, replacing existing files where applicable.
3. Commit to `main` and allow Vercel to deploy.
4. Open an admin loan, save the approved rates, then click Approved.
5. Sign in as that borrower and open the dashboard. The Closing Center should appear on the approved loan.

Important: run the SQL migration before testing approval. Without the new tables, approval will show a database error.
