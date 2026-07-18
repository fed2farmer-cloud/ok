# SecuredLanding v3.5.0

## Added
- Admin Property Photo Review queue with approve, replacement request, reject, and cover-photo controls.
- Complete admin closing-document status view, including documents still awaiting borrower upload.
- Safe migration that adds all signed-document review columns and property-photo moderation columns.
- Existing signed uploads are backfilled into the admin review queue.

## Required
Run `supabase/migrations/20260718_v3_5_0_photo_review_closing_status.sql` in Supabase SQL Editor, then deploy the updated application.
