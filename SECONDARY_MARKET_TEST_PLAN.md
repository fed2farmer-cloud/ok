# SecuredLanding v4.4.0 secondary-market test

Target proof transaction:

- Loan: #361380
- Investment ID: 10
- Certificate: SLI-2026-361380-000010
- Original investment: $1,000
- Seller asking price: $900
- Buyer: a different authenticated investor account

Expected sequence:

1. Seller opens their $1,000 certificate position and enters $900 as the asking price.
2. `create_secondary_listing_v2(10, 900)` records an open listing. It does not change certificate ownership.
3. A different investor account with at least $900 available wallet cash purchases the listing.
4. Buyer wallet available cash decreases by $900.
5. Seller wallet available cash increases by $900.
6. The certificate's outstanding principal, not the $900 purchase price, transfers to the buyer's invested balance.
7. `investments.current_owner_id` changes to the buyer and `transfer_count` increments.
8. `investor_positions.investor_user_id` changes to the buyer while outstanding principal remains unchanged.
9. `investment_ownership_history` receives a completed `secondary_sale` row with the $900 sale price in metadata.
10. The listing becomes `sold` and a trade/audit row is created.
11. The next borrower repayment should resolve the certificate's latest completed ownership-history row and send the certificate's principal/interest distribution to the new investor.

Important: Test with a second investor account. The seller is blocked from buying their own listing.
