# Version 2.9 integration

1. Run `supabase/migrations/20260725_v2_9_portfolio_protection.sql`.
2. Copy the `src` files into matching folders.
3. Ensure App.tsx contains:

```tsx
import Portfolio from "./pages/Portfolio";
<Route path="/portfolio" element={<Portfolio />} />
<Route path="/investor/portfolio" element={<Portfolio />} />
```

4. Schedule hourly in Supabase Cron:

```sql
select public.settle_expired_investments_v29();
```

5. Borrower disbursement must use `loan_disbursement_availability_v29.available_for_disbursement`.
