# SecuredLanding Portfolio Value Fix — 2026-09-08

## Fixed

1. **Investor Dashboard Total Portfolio Value**
   - Before: used `investor_wallets.invested_balance`, which can lag certificate ownership and caused the dashboard to show `$13,545` while the eight visible positions totaled `$25,445`.
   - After: uses the same certificate-level `investments` sum as **Capital Invested**, plus available and pending wallet cash.
   - Multiple certificates tied to the same underlying loan are each counted.

2. **Investor Wallet Portfolio Total consistency**
   - Uses certificate-level investment total plus available and pending wallet balances.

3. **Latest underlying-loan-number patch included**
   - `src/lib/secondaryMarket.ts`
   - `src/pages/SecondaryLoanDetails.tsx`
   - `src/pages/SecondaryMarket.tsx`

## Expected result for the supplied test account

With Available Cash `$0`, Pending `$0`, and the eight current positions totaling `$25,445`, **Total Portfolio Value** displays `$25,445`.

## Build verification

`npm run build` completed successfully with Vite 5.4.21.

## Not changed in this patch

KYC/AML backend funding enforcement was not modified. That should be handled as a separate compliance/transaction-gating change so test data and live investment flows are not unintentionally blocked.
