# Production security checklist

This package provides the database structure, borrower signing UI, signature
capture, audit events, and integration hooks. Before handling legally binding
production documents:

1. Move signature completion behind a trusted Supabase Edge Function or server
   endpoint so the server records the real request IP address.
2. Do not trust a browser-generated document hash as the sole integrity proof.
   Hash the exact stored PDF bytes on the server.
3. Store signed document artifacts in a private bucket and use short-lived
   signed URLs.
4. Generate a finalized PDF containing the visible signature, signer name,
   signed time, document version, and certificate/audit page.
5. Keep immutable copies of every signed version.
6. Require MFA or recent re-authentication for sensitive signatures.
7. Add admin authorization to `request_borrower_signature`; the migration
   intentionally revokes direct authenticated access to that function.
8. Obtain legal review for E-SIGN, UETA, state lending, deed-of-trust,
   notarization, recording, and retention requirements.
9. A deed of trust may require notarization and county recording; a basic
   electronic signature alone may not satisfy those steps.
10. Add rate limiting, replay protection, and alerting for repeated failures.
