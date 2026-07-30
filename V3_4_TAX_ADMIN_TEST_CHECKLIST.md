# SecuredLanding v3.4 Tax Administration Test Checklist

- [ ] Run `20260730_v3_4_tax_admin.sql` successfully.
- [ ] Confirm `/admin/tax` redirects non-admin users.
- [ ] Upload a PDF smaller than 20 MB.
- [ ] Assign the PDF to a valid borrower UUID.
- [ ] Confirm the borrower sees it in `/tax-center`.
- [ ] Confirm Preview opens a short-lived signed URL.
- [ ] Change status from Pending to Available.
- [ ] Change status to Corrected and confirm corrected timestamp.
- [ ] Change status to Voided and confirm it remains in admin history.
- [ ] Confirm an audit row is created in `tax_document_audit`.
- [ ] Test year, status, and text filters.
- [ ] Run `npm run build` before deployment.
