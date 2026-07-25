# Closing Center integration

For every borrower signature request returned from
`document_signature_requests`, link the borrower to:

```tsx
<Link to={`/sign-document/${request.id}`}>
  Review and Sign
</Link>
```

Recommended query:

```ts
const { data, error } = await supabase
  .from("document_signature_requests")
  .select(`
    id,
    status,
    expires_at,
    generated_document_id,
    generated_loan_documents (
      id,
      document_type,
      file_name,
      signature_status
    )
  `)
  .eq("loan_application_id", loanApplicationId)
  .eq("signer_user_id", user.id)
  .order("requested_at", { ascending: true });
```

Use `SignatureStatusBadge` beside each document.

Only show the signing link while the request is `pending` or `viewed`.
After signing, show the signed date and prevent document replacement without
creating a new document version.
