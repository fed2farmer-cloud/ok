# SecuredLanding v3.0 — Split Payment Upgrade

## Added
- Wallet + debit/credit-card split payment selection.
- Automatic split selection when an investment exceeds wallet cash.
- Live wallet/card/total breakdown.
- “Use Max Wallet Balance” shortcut.
- Session-based pending split checkout context.
- Integration guide for trusted NMI completion.

## Preserved
- Wallet-only investment through `invest_from_wallet_v28`.
- Full debit/credit-card checkout.
- Bitcoin checkout.
- Seven-day investor protection display.
- Explicit `export default InvestorMarketplace;`.

## Security
Wallet funds are not deducted by the marketplace before external payment succeeds.
The payment backend must verify and finalize split investments atomically.
