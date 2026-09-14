# SecuredLanding v4.5.7 — Closing Center Menu + Loan Chooser

## What changed
- Adds **Closing Center** to the borrower navigation menu on mobile and desktop.
- Makes `/closing-center` a real landing page when no `loanId` is supplied.
- The landing page loads the signed-in borrower's approved/funded/active/completed/closed loans.
- Each eligible loan gets an **Open Closing Center →** button that routes to `/closing-center?loanId=<application_id>`.
- Existing loan-specific Closing Center workflow, Proof panel, signing documents, checklist, recording, and funding status remain unchanged.

## Mobile deployment
Only these source files are required for this patch:
- `src/components/AppLayout.tsx`
- `src/pages/ClosingCenter.tsx`

Do not manually upload generated `dist/assets/*.js` files. Vercel rebuilds `dist` from source after the commit.

## Database / API impact
- No Supabase migration required.
- No new serverless functions.
- API TypeScript function count remains 12.
