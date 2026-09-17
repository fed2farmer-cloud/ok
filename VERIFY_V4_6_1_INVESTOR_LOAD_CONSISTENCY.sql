-- Read-only verification for SecuredLanding v4.6.1.
-- Expected: mismatch_amount = 0 for every investor with a wallet.
with canonical as (
  select
    u.user_id,
    coalesce(sum(
      case
        when lower(coalesce(i.status,'')) in (
          'active','settled','funded','completed',
          'protection_period','refund_requested','refund_processing'
        ) then coalesce(pos.current_principal, i.amount, 0)
        else 0
      end
    ),0) as canonical_invested
  from (
    select user_id from public.investor_wallets
    union
    select coalesce(current_owner_id, investor_id) as user_id from public.investments
  ) u
  left join public.investments i
    on coalesce(i.current_owner_id, i.investor_id) = u.user_id
  left join public.investor_positions pos
    on pos.investment_id = i.id
   and pos.investor_user_id = u.user_id
   and lower(coalesce(pos.status,'active')) = 'active'
  where u.user_id is not null
  group by u.user_id
)
select
  w.user_id,
  w.invested_balance as cached_invested,
  c.canonical_invested,
  round(coalesce(w.invested_balance,0) - c.canonical_invested, 2) as mismatch_amount
from public.investor_wallets w
join canonical c on c.user_id = w.user_id
order by abs(coalesce(w.invested_balance,0) - c.canonical_invested) desc, w.user_id;

-- Missing servicing positions for active/settled/funded/completed certificates.
select
  i.id as investment_id,
  la.loan_number,
  coalesce(i.current_owner_id, i.investor_id) as owner_user_id,
  i.amount,
  i.status
from public.investments i
join public.loan_applications la on la.id = i.loan_application_id
left join public.investor_positions pos on pos.investment_id = i.id
where lower(coalesce(i.status,'')) in ('active','settled','funded','completed')
  and pos.investment_id is null
order by i.id;
