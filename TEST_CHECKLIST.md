# SecuredLanding v3.4.1 Test Checklist

- Run the SQL migration without errors.
- Confirm `/tax-center` opens for an authenticated borrower or investor.
- Confirm `/admin/tax` redirects non-admin users.
- Confirm an admin can upload a PDF to the private `tax-documents` bucket.
- Confirm an admin can assign the document to a borrower or investor UUID.
- Confirm an available document appears in the recipient Tax Center.
- Confirm the recipient can download the PDF through a signed link.
- Confirm another user cannot access that PDF.
- Confirm `tax_document_audit` records creation and status changes.
- Run `npm run build` successfully.
