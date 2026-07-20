# SecuredLanding v3.5.2 — Investor Property Gallery

## Added
- Approved property photos are attached to the correct investor marketplace loan using `loan_application_id`.
- The approved cover photo is shown first.
- Mobile-friendly thumbnail gallery for additional approved photos.
- Private Storage images use one-hour signed URLs.
- Pending, rejected, and replacement-requested photos remain hidden from investors.

## Database
Run `supabase/migrations/20260720_v3_5_2_investor_property_gallery.sql` in Supabase SQL Editor.
