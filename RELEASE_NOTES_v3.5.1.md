# SecuredLanding v3.5.1

## Fixed

- Admin Property Media Queue no longer appears empty when pending photo rows exist.
- Added a guarded admin RPC that reads property-photo records despite conflicting legacy borrower RLS policies.
- Added admin read access to private `property-photos` storage objects so thumbnails can receive signed URLs.
- Added a clear migration-required message if the new RPC has not been installed.

## Required Supabase migration

Run the contents of:

`supabase/migrations/20260719_v3_5_1_admin_property_photo_visibility.sql`
