SECURED LANDING - FINAL INVESTMENT LINK REPAIR

Run files in this order:

1. 01_final_investment_link_repair.sql
   Repairs only relationships that can be identified without guessing.
   It leaves ambiguous/orphan legacy records untouched for manual review.

2. 02_verify_relationships.sql
   Read-only verification. The goal is every legitimate investment showing CORRECT LINK.

3. 03_future_write_contract.sql
   Adds/validates a foreign key to prevent invalid application IDs going forward.
   The NOT NULL command is intentionally commented out until all legacy rows are resolved.

IMPORTANT
- This package does not delete investments.
- It does not automatically force ambiguous records to a loan.
- Keep loan_application_id as the canonical relationship in application code going forward.
- Before running database repair SQL on production, keeping a Supabase backup is recommended.
