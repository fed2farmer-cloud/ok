SecuredLanding Secondary Market Fix Package

Modified files:
1. src/lib/secondaryMarket.ts
   - Replaces missing purchase_secondary_listing_v2 RPC call with secondary_market_settle.
   - Supplies p_listing_id, authenticated p_buyer_id, and an idempotency key.

2. src/pages/InvestorDashboard.tsx
   - Loads investments by current ownership, including secondary-market purchases.
   - Prevents sold certificates from remaining in the seller's current portfolio when current_owner_id changes.
   - Uses transaction_type when present so wallet transactions do not display as Undefined.

Database reference:
3. SECONDARY_MARKET_DB_FIXES.sql
   - V2 settlement function using secondary_market_listings_v2, investments, secondary_market_trades_v2,
     secondary_market_cash_ledger_v2, and investment_ownership_history.
   - Investment SELECT RLS policy permits original investor or current owner visibility.

Observed validation from live testing:
- Buyer wallet debit occurred.
- Seller received sale proceeds.
- Listing disappeared from open secondary market.
- investments.current_owner_id transferred to buyer.
- Buyer portfolio displayed transferred certificate.
- Seller portfolio no longer counted sold certificate.
- Dashboard totals updated to current ownership.

No full project build was run because the complete repository/dependencies were not available in this chat runtime.
Files were syntax-reviewed and packaged with original source paths.
