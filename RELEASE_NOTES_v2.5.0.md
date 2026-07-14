# SecuredLanding v2.5.0

## Included in this package

- Replaced the clipped header mark with the approved horizontal Secured Landing branding.
- Added a dedicated app icon for loading states and future favicon use.
- Added administrator borrower-video review controls and signed video playback.
- Added approved borrower-video fields to marketplace publishing.
- Added investor marketplace playback for admin-approved borrower videos only.
- Added a compatibility migration for generated loan documents, admin review metadata, and marketplace video fields.
- Preserved the existing bigint `loan_applications.id` convention.

## Required Supabase step

Run `supabase/migrations/20260714_v2_5_admin_video_documents_branding.sql` in the Supabase SQL Editor before testing the new marketplace and generated-document workflow.
