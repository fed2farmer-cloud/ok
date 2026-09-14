# SecuredLanding v4.5.9 — Closing Sync + Manual/Test Notarization

This build keeps the Proof integration in place without requiring the paid Proof API plan during development.

## What changed

1. Closing document tasks now synchronize automatically. When every required generated closing document is signed, both **Review generated loan documents** and **Sign closing documents** are marked complete.
2. Closing Center calls the sync RPC before loading task status, which repairs legacy loans such as test Loan #460109 after the migration is applied.
3. When Proof API credentials are absent, the borrower Closing Center shows a clean **Manual / Test Mode** instead of presenting the missing API key as a blocking error.
4. Admin loan cards include a **Manual / Test Notarization** panel. Admin can mark a manual appointment scheduled, complete it, reset/cancel it, add notes, and upload the returned notarized PDF.
5. Completed notarized PDFs are stored privately in the new `notarized-loan-documents` bucket. Only SecuredLanding admins can access the bucket.
6. Completing manual notarization completes only the `online_notary` closing task. It never marks `county_recording` complete.
7. The Proof API workflow remains unchanged and can be activated later by adding Proof credentials and enabling the existing environment flags.

## Install order

1. Apply `supabase/migrations/20260914_v4_5_9_closing_sync_manual_notary.sql`.
2. Deploy the frontend/API code.
3. Open Loan #460109 Closing Center and confirm the two document/signature tasks show complete.
4. In Admin Dashboard, open Loan #460109 and test Manual / Test Notarization.
5. Confirm the county-recording task remains pending after notarization is marked complete.
