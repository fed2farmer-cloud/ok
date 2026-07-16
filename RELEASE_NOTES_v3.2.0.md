# SecuredLanding v3.2.0

## Added
- Borrower loan selector for multiple approved or funded loans.
- Required print, signature, date, notarization, and upload instructions.
- Signed-document upload controls on every generated closing form.
- Signed-document status and private storage support.

## Fixed
- Rebuilt property photo row-level security around ownership of the related loan application.
- Rebuilt private property-photo storage policies.

## Installation
Run `supabase/migrations/20260716_v3_2_0_closing_uploads_photo_rls.sql` before testing uploads.
