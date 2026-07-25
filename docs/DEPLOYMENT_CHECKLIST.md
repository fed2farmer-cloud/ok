# Deployment checklist

- Back up Supabase.
- Run the v2.9 migration.
- Replace Portfolio.tsx.
- Add PortfolioPositionCard.tsx.
- Add portfolioV29Service.ts.
- Confirm Loan #889568 displays instead of internal Loan #13.
- Confirm protection_period displays as Protected.
- Confirm countdown and refund button appear.
- Schedule settle_expired_investments_v29() hourly.
- Confirm status changes to Active after expiration.
- Confirm protected funds remain unavailable for borrower disbursement.
