SecuredLanding Ownership + Distribution Fix
Date: 2026-09-03

NEW FILE
supabase/migrations/20260903_ownership_distribution_fix.sql

WHAT IT FIXES
1. sync_investor_positions_for_loan_v1
   - Uses current_owner_id first, investor_id only as fallback.
   - Marks transferred positions as secondary.
   - Does NOT reset current_principal during conflict updates.

2. settle_borrower_payment_v5
   - Uses latest completed ownership-history owner when present.
   - Falls back to current_owner_id for primary/legacy certificates.
   - Falls back to investor_id only if current_owner_id is absent.
   - Leaves the rest of the exported live V5 payment function unchanged.

VERIFIED BEFORE PACKAGING
- System ownership audit: 0 linked-position owner mismatches.
- Loan 361380 sync test processed 5 records.
- Transferred certificate SLI-2026-361380-000010 remained with its buyer.
- Its reduced current principal (995.90) was preserved.
- Six active primary certificates were identified with no completed transfer-history row;
  the V5 fallback in this migration prevents those certificates from failing distribution.

NOTE
This ZIP is the permanent migration package for the database fixes. It does not
replace the already-installed React files from the earlier secondary-market ZIP.
