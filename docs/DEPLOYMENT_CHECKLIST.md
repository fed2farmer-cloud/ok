# Deployment checklist

- [ ] Back up Supabase.
- [ ] Run corrected v2.8 SQL.
- [ ] Replace old wallet investment code.
- [ ] Test with a small amount first.
- [ ] Confirm available_balance decreases.
- [ ] Confirm invested_balance increases.
- [ ] Confirm investments.loan_id contains the internal ID.
- [ ] Confirm marketplace amount_funded increases.
- [ ] Confirm amount_remaining decreases.
- [ ] Confirm Portfolio shows the refund button.
- [ ] Confirm borrowers never see a refund button.
- [ ] Confirm refund returns principal to available_balance.
- [ ] Schedule settlement function hourly.
