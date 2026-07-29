# Test checklist

## Admin
- [ ] Send a revised loan offer.
- [ ] Confirm success message appears.
- [ ] Confirm loan status becomes `Counteroffer Pending`.
- [ ] Confirm a row is added to `loan_counteroffers` with status `pending`.
- [ ] Confirm a message is added with the borrower as recipient.

## Borrower Messages
- [ ] Open Messages and select the loan thread.
- [ ] Confirm the revised-offer card displays.
- [ ] Confirm original amount, proposed amount, LTV, rate, term, and payment display.
- [ ] Send a question and confirm the admin receives it.

## Accept
- [ ] Click Accept Revised Offer.
- [ ] Confirm counteroffer status becomes `accepted`.
- [ ] Confirm loan status becomes `Counteroffer Accepted`.
- [ ] Confirm `loan_amount` and `approved_loan_amount` use the revised amount.
- [ ] Confirm an acceptance message appears for the admin.

## Decline
- [ ] Send another test offer on a different loan.
- [ ] Click Decline Offer.
- [ ] Confirm counteroffer status becomes `declined`.
- [ ] Confirm loan status becomes `Counteroffer Declined`.
- [ ] Confirm a decline message appears for the admin.
