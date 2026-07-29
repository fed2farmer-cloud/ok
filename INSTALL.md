# SecuredLanding v3.3.1 — Investment Certificate UI

The certificate database migration has already been applied and verified. This patch exposes those records in the investor interface.

## Replace these files

- `src/App.tsx`
- `src/InvestorWallet.tsx`
- `src/pages/InvestorDashboard.tsx`

## Add this new file

- `src/pages/InvestmentCertificateDetails.tsx`

## Deploy

1. Upload the files to the matching repository paths.
2. Commit the changes to the branch connected to Vercel.
3. Confirm the Vercel build completes.
4. Sign in as an investor and open **Investor Wallet**.
5. Tap **View Certificate** beneath an investment.

No additional SQL is required for this UI patch.
