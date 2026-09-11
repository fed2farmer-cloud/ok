# SecuredLanding v4.5.0 — Secondary Market Sell-All Test

## Supabase diagnosis
Account tested: 1709ralphave@gmail.com

The account currently has five valid, active, unlocked certificates tied to real public loan numbers and active investor positions. These can be listed through `create_secondary_listing_v2`.

One additional $200 certificate is invalid for resale because it is stored as Loan #0 (`SLI-2026-0-000009`) with no `loan_application_id`. The UI deliberately blocks this certificate from resale until its underlying loan is repaired.

The profile row currently says `investor`. This build does not use that single role field to decide whether a certificate can be sold; resale is based on current certificate ownership plus an active investor position.

## Changes
- Added visible **Sell / Resell Certificate** action for eligible owned certificates.
- Added **List All Eligible at Principal** test button to list all currently eligible owned certificates at current outstanding principal.
- Existing open listings now show **Manage Listing** instead of another sell button.
- Loan #0/unlinked certificates are visibly marked and cannot be listed.
- Bulk listing skips invalid, already-listed, non-owned, inactive, or zero-principal certificates.
- Secondary-market RPC errors are surfaced per investment in the bulk test result.

## Test account expected result
For 1709ralphave@gmail.com, the bulk button should attempt five valid certificates and skip the broken $200 Loan #0 certificate.

## Supabase backend
No new database migration is required for this UI patch. The live project already has `create_secondary_listing_v2`, `cancel_secondary_listing_v2`, and `secondary_market_settle` installed.
