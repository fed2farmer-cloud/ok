SecuredLanding Underlying Loan Number Patch

Modified files:
- src/pages/SecondaryMarket.tsx
- src/pages/SecondaryLoanDetails.tsx
- src/lib/secondaryMarket.ts

Fixes:
- Secondary Market derives the public loan number from the permanent certificate number when legacy listing.loan_number contains an internal database ID.
- "View Original Loan" now routes with the public loan number (example: 480946 instead of 14).
- Performance RPC uses the resolved public loan number.
- SecondaryLoanDetails first looks up by public loan_number, then falls back to loan_applications.id for old links.
- Page heading changes to the resolved public loan number after loading.

Validation:
- npm run build: PASS
- No SQL/database changes required for this compatibility patch.
