# Version 2.8 integration checklist

- [ ] Run the Supabase migration.
- [ ] Confirm `investments.loan_application_id` is BIGINT.
- [ ] Confirm new investments receive `refund_deadline`.
- [ ] Add the shield badge to marketplace cards.
- [ ] Add the countdown/refund card to the investor dashboard.
- [ ] Add `/admin/investment-refunds`.
- [ ] Connect NMI/ACH refunds before completing requests.
- [ ] Run `settle_expired_investment_protection()` hourly.
- [ ] Change borrower disbursement to use only `available_for_disbursement`.
- [ ] Test refund at day 1.
- [ ] Test blocked refund after day 7.
- [ ] Test that borrowers have no refund button or RPC permission.
- [ ] Test wallet credit and audit event.
- [ ] Test marketplace totals after refund.
