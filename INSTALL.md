# SecuredLanding v3.3.2 — Counteroffer RPC Compatibility

## Problem fixed

The borrower page calls:

```text
respond_to_loan_counteroffer(
  p_accept,
  p_agreement_version,
  p_counteroffer_id,
  p_user_agent
)
```

The database currently contains only:

```text
respond_to_loan_counteroffer(
  p_counteroffer_id,
  p_accept
)
```

PostgREST therefore reports that the four-parameter function cannot be found.

## Installation

1. Open **Supabase → SQL Editor**.
2. Open `supabase/migrations/20260729_v3_3_2_counteroffer_rpc_compatibility.sql`.
3. Copy the complete SQL into a new query.
4. Select **Run**.
5. Run `VERIFY.sql`.
6. Wait about 5–10 seconds, refresh SecuredLanding, and test **Accept** or **Decline** again.

## Expected verification

The verification query should show two overloads:

```text
p_counteroffer_id bigint, p_accept boolean
p_accept boolean, p_agreement_version text, p_counteroffer_id bigint, p_user_agent text
```

## Safety

The patch does not replace the existing counteroffer logic. It adds a compatible
four-argument wrapper and forwards the action to the existing two-argument
function, preserving its current authorization and workflow behavior.
