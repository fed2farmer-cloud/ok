# SecuredLanding v3.4.0

## Added
- Administrator queue for reviewing signed borrower closing documents.
- Borrower closing-progress tracker on every generated form.
- Definitive Supabase setup for `signed-loan-documents` and `property-photos` buckets.
- Clear installation messages when a required bucket or RLS policy is missing.

## Fixed
- `Bucket not found` during signed-document upload after the migration is installed.
- Property-photo inserts blocked by mixed numeric/UUID loan ID comparisons.
- Admin inability to open, approve, reject, or request corrections to executed documents.

## Important
Run `supabase/migrations/20260716_v3_4_0_storage_closing_review.sql` before testing uploads.
