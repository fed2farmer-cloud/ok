# SecuredLanding v3.1

## Added
- Borrower document signature requests
- Typed and drawn electronic signatures
- Electronic-signature consent
- Document review confirmation
- Signature status tracking
- Signature audit events
- Document version and hash fields
- Borrower signing route
- Admin signature-request component
- Closing task completion hook

## Workflow
1. Admin marks a generated document ready for signature.
2. A borrower signature request is created.
3. Borrower reviews the document.
4. Borrower accepts electronic-signature consent.
5. Borrower types or draws a signature.
6. The signature and audit event are recorded.
7. The generated document becomes signed and locked.
8. The Closing Center can advance to the next stage.

## Production follow-up
- Trusted server/Edge Function finalization
- Exact PDF byte hashing
- Final signed PDF certificate
- Real IP address capture
- Notary and county-recording workflow where required
