# Split-payment completion integration

The marketplace now routes a split transaction to:

`/payment?method=split&loanId=...&amount=<card remainder>&totalAmount=...&walletAmount=...`

The `amount` query parameter is the amount the card processor should charge.
The full investment and wallet contribution are also saved in `sessionStorage`
under `securedlanding_pending_split_investment`.

## Required payment-page behavior

After NMI confirms a successful card charge:

1. Read the pending split record with:
   `readPendingSplitInvestment()`.
2. Call a server-side endpoint or Supabase Edge Function.
3. That trusted server operation must atomically:
   - verify the card transaction with NMI;
   - verify the investor owns the wallet;
   - verify the wallet still has the recorded wallet amount;
   - deduct the wallet contribution;
   - create one investment for the full total;
   - place the investment in the seven-day protection period;
   - update marketplace funding totals;
   - create transaction, notification, and audit records;
   - reject duplicate completion attempts using the payment transaction ID.
4. Only after the server confirms completion:
   - call `clearPendingSplitInvestment()`;
   - navigate to `/portfolio`.

## Important safety rule

Do not deduct wallet cash in the browser before the card charge succeeds.
Do not trust query-string amounts without server-side verification.
