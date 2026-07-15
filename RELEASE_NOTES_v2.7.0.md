# SecuredLanding v2.7.0

## Secure documents
- All borrower uploads default to **Private**.
- Admin underwriting approval is separate from investor publication.
- Investor publication requires a separately stored redacted copy.
- Visibility badges distinguish Private, Investor Safe and Public Summary materials.
- Adds document access audit-log schema.

## Borrower Signing Center
- Generated closing-document records appear in a private Signing Center.
- Supports Ready to Sign, Viewed, Signed, Submitted, Accepted and Needs Correction states.
- Signing records and signed copies remain borrower/admin only.

## 45-day funding window
- Approval starts a 45-day marketplace funding period.
- Marketplace cards show days remaining and urgency-based calls to action.
- Adds funding lifecycle fields for open, paused, fully funded, expired, cancelled, closing and deposited.

## Important production note
The generated document records are workflow placeholders. State-specific loan instruments and disclosures must be prepared or reviewed by qualified legal counsel and connected to a compliant e-signature provider before production use.
