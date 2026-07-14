# SecuredLanding v2.5.0

## Included

- Transparent, mobile-safe Secured Landing logo in public and authenticated headers.
- Admin borrower-video review controls: approve, request changes, and reject.
- Approved borrower-video publishing to the investor marketplace.
- Generated loan-document and closing-center workflow.
- Consolidated idempotent master migration matching the application schema.
- Compatibility for the production `bigint` loan application identifier.
- PostgREST schema reload notification after migration.

## Required deployment step

Run `MASTER_MIGRATION.sql` in the Supabase SQL Editor before testing the updated admin and marketplace workflows.
