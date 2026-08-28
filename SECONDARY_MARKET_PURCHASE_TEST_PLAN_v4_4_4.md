# SecuredLanding v4.4.4 secondary-market checkout test

Use two authenticated investor accounts. The seller and buyer must be different users.

## Layout and mobile checks

1. Open `/secondary-market` on a narrow phone viewport.
2. Confirm the SecuredLanding header and footer render.
3. Confirm each listing uses compact two-column metric rows instead of one tall block per field.
4. Open `View Original Loan` and confirm the loan page also has the standard header and footer.
5. Confirm original-loan and payment-performance details remain readable without horizontal scrolling.

## Wallet-only purchase

1. Give the buyer wallet cash equal to or greater than the seller asking price.
2. Select `Wallet` and press `Buy from Wallet`.
3. Confirm the listing becomes sold, the seller receives the asking price, the buyer wallet is debited, and certificate ownership transfers.
4. Confirm the buyer is redirected to the transferred certificate.

## Wallet + NMI card purchase

1. Give the buyer some wallet cash, but less than the asking price.
2. Select `Wallet + Card`.
3. Confirm the checkout shows the wallet contribution, exact NMI shortfall and total.
4. Complete the NMI sandbox card payment.
5. Confirm the card amount credits the buyer wallet and the certificate purchase then completes.
6. Confirm the seller receives the full asking price and the buyer receives the outstanding certificate principal.

## Full NMI card purchase

1. Use a buyer with a zero wallet balance.
2. Select `Card` and complete the NMI sandbox payment for the full asking price.
3. Confirm the wallet is credited, immediately used for the purchase and the certificate transfers.

## Failure and safety checks

1. Confirm the seller cannot select or submit any purchase method for their own listing.
2. Open checkout, sell the listing with another buyer, then attempt card payment. Confirm availability is checked before NMI and no card charge is attempted.
3. Force the ownership-transfer RPC to fail after a successful NMI sandbox approval. Confirm the UI says not to retry the card, leaves the approved funds in the buyer wallet and switches to Wallet when the balance is sufficient.
4. Confirm a card shortfall under $10 clearly discloses the $10 NMI minimum and leaves the excess in wallet cash.
