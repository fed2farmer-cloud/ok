-- Run after the v4.4.9 migration. Read-only.
-- Replace the certificate value only if testing a different certificate.

select
  i.id as investment_id,
  i.certificate_number,
  la.loan_number as public_loan_number,
  i.investor_id as original_buyer,
  coalesce(i.current_owner_id, i.investor_id) as current_owner,
  i.transfer_count,
  p.investor_user_id as position_owner,
  p.original_principal,
  p.current_principal,
  p.status as position_status
from public.investments i
left join public.loan_applications la
  on la.id = coalesce(i.loan_application_id, i.loan_id)
left join public.investor_positions p
  on p.investment_id = i.id and p.status = 'active'
where i.certificate_number = 'SLI-2026-361380-000010';

select
  t.id as trade_id,
  t.certificate_number,
  t.loan_number,
  t.seller_user_id,
  t.buyer_user_id,
  t.principal_transferred,
  t.sale_price,
  t.completed_at,
  count(l.id) as cash_entries,
  coalesce(sum(case when l.entry_type='buyer_debit' then l.amount else 0 end),0) as buyer_debit,
  coalesce(sum(case when l.entry_type='seller_credit' then l.amount else 0 end),0) as seller_credit
from public.secondary_market_trades_v2 t
left join public.secondary_market_cash_ledger_v2 l on l.trade_id=t.id
where t.certificate_number='SLI-2026-361380-000010'
group by t.id
order by t.completed_at desc;

select
  w.user_id,
  w.available_balance,
  w.invested_balance as cached_invested,
  coalesce(sum(p.current_principal) filter (
    where p.status='active' and coalesce(i.current_owner_id,i.investor_id)=w.user_id
  ),0) as calculated_invested,
  count(*) filter (
    where p.status='active' and coalesce(i.current_owner_id,i.investor_id)=w.user_id
  ) as current_positions
from public.investor_wallets w
left join public.investor_positions p on p.investor_user_id=w.user_id
left join public.investments i on i.id=p.investment_id
where w.user_id in (
  select seller_user_id from public.secondary_market_trades_v2 where certificate_number='SLI-2026-361380-000010'
  union
  select buyer_user_id from public.secondary_market_trades_v2 where certificate_number='SLI-2026-361380-000010'
)
group by w.user_id,w.available_balance,w.invested_balance;

select user_id,transaction_type,amount,status,description,created_at
from public.wallet_transactions
where investment_id=(select id from public.investments where certificate_number='SLI-2026-361380-000010')
order by created_at desc;
