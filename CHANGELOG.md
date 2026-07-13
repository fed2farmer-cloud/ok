# Secured Landing v2.3.0 — Closing Center

## Added
- Automatic Closing Center creation when an admin changes a loan to Approved.
- Locked approval snapshot for amount, borrower rate, investor rate, term and estimated payment.
- Borrower closing checklist and progress indicator.
- Prominent borrower introduction video upload inside the Closing Center.
- Borrower notification and loan timeline records.
- Database tables and row-level security for closings, tasks, notifications and timeline events.

## Modified files
- `src/pages/AdminDashboard.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/ClosingCenterCard.tsx`
- `supabase/migrations/20260713_v2_3_0_closing_center.sql`

## Not included yet
- Executable promissory note or deed-of-trust templates.
- Production electronic signatures.
- Automatic email delivery.

The Sign Documents button is intentionally marked Coming Next until the document and e-signature engine is added.
