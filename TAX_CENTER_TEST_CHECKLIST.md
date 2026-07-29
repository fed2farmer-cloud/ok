# Tax Center Test Checklist

- Run the migration successfully.
- Confirm the private `tax-documents` storage bucket exists.
- Confirm borrowers and investors see `Tax Documents` in navigation.
- Confirm admins see `Tax Reporting` in navigation.
- Upload a PDF from `/admin/tax` using the recipient's auth UUID.
- Confirm the recipient sees the document in `/tax-center`.
- Confirm another user cannot read the document.
- Confirm Download PDF creates a signed URL and an audit row.
- Confirm pending documents disable downloading when no storage path exists.
- Confirm corrected forms show the Corrected status.
