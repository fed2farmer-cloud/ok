# SecuredLanding v4.5.5 — Proof Address / Eligibility Fix

This patch corrects the first live Proof Fairfax test blockers found on Loan 460109.

## What changed

- Removed `city` and `zip_code` from the `loan_applications` query because those columns do not exist in the current production schema.
- Proof now parses a complete `property_address` stored as `street/location, City, ST ZIP`.
- State names such as `California` are normalized to two-letter abbreviations when needed.
- Proof property verification now uses the current Real Estate API endpoint:
  - `GET /mortgage/v2/transactions/verify_address`
- The v2 eligibility request sends the currently documented required query fields:
  - `street_address[line1]`
  - `street_address[city]`
  - `street_address[state]`
  - `street_address[postal]`
  - `street_address[country]=US`
- Eligibility responses are handled as an array of recording jurisdictions (with backwards-compatible object handling).
- Draft creation reuses the supported recording jurisdiction and available title-agency/underwriter IDs when Proof returns them.
- The Vercel serverless-function count remains exactly 12.

## Loan 460109 live data

The production Supabase record was updated, with user approval, to:

- Property address: `VAC/VIC 250 STE/AVE N12, Black Butte, CA 93591`
- County: `Los Angeles`
- State: `California`
- APN: `3338021011`

No schema migration is required for v4.5.5.

## Test sequence after deployment

1. Keep `PROOF_ENVIRONMENT=fairfax`.
2. Add a valid Fairfax `PROOF_API_KEY`.
3. Keep `PROOF_ALLOW_PLACE_ORDER=false`.
4. Log in as the borrower that owns Loan 460109.
5. Open Closing Center.
6. Select **Check RON eligibility**.
7. Review the returned recording jurisdiction / supported status.
8. Only after the Fairfax account is ready, set `PROOF_ENABLED=true` and select **Create Proof draft**.

The document-upload step is still intentionally blocked until final PDF files exist in `generated_loan_documents.storage_path`.
