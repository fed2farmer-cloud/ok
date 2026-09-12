# SecuredLanding v4.5.3 — Proof Remote Online Notarization

This release adds a provider-ready Proof Real Estate API integration to the Borrower Closing Center while keeping notarization and county recording as separate closing requirements.

## Install

1. Run `supabase/migrations/20260912_v4_5_3_proof_closing_integration.sql` in Supabase.
2. Add server-only environment variables in Vercel:
   - `PROOF_API_KEY` — Fairfax key should begin with `prf_test_`; production full-access keys use `prf_`.
   - `PROOF_ENVIRONMENT=fairfax` for testing. Change to `production` only for live closings.
   - `PROOF_ENABLED=false` initially. Change to `true` after Fairfax is ready.
   - `PROOF_ALLOW_PLACE_ORDER=false` initially. Only enable after the closing package and provider workflow have been reviewed.
   - Optional: `PROOF_TRANSACTION_TYPE=other`
   - Optional: `PROOF_TITLE_AGENCY_ID=...`
   - Optional: `PROOF_TITLE_UNDERWRITER_ID=...`
   - Optional: `PROOF_CONFIG_ID=...`
   - Optional: `PROOF_WEBHOOK_SIGNING_KEY=...` if a dedicated Webhooks V2 signing key is configured. Otherwise the API key that created the webhook is used by Proof as the HMAC key.
3. Configure a Proof Webhooks V2 subscription pointing to:
   `https://YOUR-SECUREDLANDING-DOMAIN/api/proof-webhook`
   Subscribe at minimum to `transaction.completed`, `transaction.released`, `transaction.completed_with_rejections`, `transaction.canceled`, and `transaction.declined`.
4. Use Loan 460109 for the first Fairfax flow.

## Safety gates built into this release

- No Proof transaction is created unless `PROOF_ENABLED=true`.
- Property eligibility is checked before draft creation by default.
- `place_order` is separately locked behind `PROOF_ALLOW_PLACE_ORDER=true`.
- Prototype HTML-only closing forms are never sent to Proof. The upload action only sends generated closing records that have an actual stored PDF `storage_path`.
- A completed Proof notarization only completes the `online_notary` task. It does not complete `county_recording`.
- Webhooks use HMAC-SHA256 verification against `X-Notarize-Signature`.

## Current document handoff requirement

The present SecuredLanding generated forms are mostly rendered in the browser from `terms_snapshot`; many do not yet have a final attorney-approved PDF stored in `loan-documents`. The Proof API route therefore refuses to send the prototype-only forms. Production deployment should use final state-specific PDFs reviewed by counsel, then store those PDF paths on `generated_loan_documents.storage_path` before selecting **Send approved PDFs**.

## Proof endpoints used

- Fairfax: `https://api.fairfax.proof.com`
- Production: `https://api.proof.com`
- Eligibility: `GET /mortgage/v1/transactions/verify_address`
- Create real-estate draft: `POST /mortgage/v2/transactions`
- Add documents: `POST /mortgage/v2/transactions/{id}/documents`
- Retrieve/refresh: `GET /mortgage/v2/transactions/{id}`
- Place order: `POST /mortgage/v2/transactions/{id}/place_order`
