# SecuredLanding Portfolio Status + Yield Final Fix — 2026-09-09

## Fixed

1. **Portfolio monthly yield now uses each certificate's actual rate.**
   The prior dashboard multiplied all invested principal by one simple average rate. The corrected calculation sums `amount × investor_interest_rate` for every active/funded certificate, then divides by 12.

2. **Weighted average return.**
   `Avg. Return` is now principal-weighted rather than a simple average across certificates.

3. **Protection status synchronization before portfolio load.**
   The investor dashboard calls `settle_my_expired_investments_v1()` before fetching investments so an expired seven-day protection period does not remain visible as `protection_period` just because the wallet page was not opened first.

4. **Realtime investment refresh.**
   Investment changes for the original or current owner trigger a dashboard reload so allocation/status data updates without requiring a stale browser tab to be manually rebuilt.

5. **Live-compatible Supabase migration.**
   `RUN_THIS_IN_SUPABASE_2026-09-09.sql` no longer references `funding_holds` or the v3.5 ledger objects that were confirmed absent from the live database.

## Verified test account math

- Total invested: **$25,445**
- 9% positions: **$13,545**
- 10% positions: **$11,900**
- Estimated monthly yield: `(13,545 × .09 + 11,900 × .10) ÷ 12 = $200.754...` → **$200.75**
- Weighted average return: approximately **9.47%**
- Position count: **8**

The database records for certificates `...000027`, `...000028`, and `...000029` were confirmed active after the protection-period repair.
