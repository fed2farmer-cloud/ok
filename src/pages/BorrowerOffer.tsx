// src/pages/BorrowerOffer.tsx
// Critical RPC fix:

const { data, error } = await supabase.rpc(
  "respond_to_loan_counteroffer",
  {
    p_counteroffer_id: Number(counteroffer.id),
    p_accept: accept,
  }
);

// Remove any p_agreement_version and p_user_agent arguments.
