# SecuredLanding v3.1.5 — Promissory Note Update

This update adds a detailed borrower-facing **Secured Promissory Note** draft to the Closing Center loan forms.

## Included
- Detailed promise-to-pay and repayment clauses.
- Interest, payment application, prepayment, default, collateral, governing-law, assignment, and electronic-signature sections.
- Borrower signature and date lines.
- Print / Save PDF support through the browser.
- Supabase migration that creates missing promissory-note records for existing approved or funded loans.
- Clear legal-review warning for state-specific compliance.

## Files
- `src/components/PromissoryNoteDocument.tsx` — new
- `src/pages/LoanForms.tsx` — updated
- `supabase/migrations/20260716_v3_1_5_promissory_notes.sql` — new
