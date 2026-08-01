-- SecuredLanding v3.6.2 - revised loan + marketplace + wallet/split-payment synchronization
-- Run once in Supabase SQL Editor before deploying the frontend patch.
begin;

-- 1) Accepted counteroffers are authoritative. Repair any application that still carries
--    its original requested amount after the borrower accepted a revised offer.
with latest_accepted as (
  select distinct on (loan_application_id)
    loan_application_id,
    proposed_loan_amount,
    borrower_interest_rate,
    repayment_term_months
  from public.loan_counteroffers
  where status = 'accepted'
  order by loan_application_id, accepted_at desc nulls last, updated_at desc nulls last, id desc
)
update public.loan_applications la
set loan_amount = a.proposed_loan_amount,
    approved_loan_amount = a.proposed_loan_amount,
    borrower_interest_rate = coalesce(a.borrower_interest_rate, la.borrower_interest_rate),
    repayment_term_months = coalesce(a.repayment_term_months, la.repayment_term_months),
    amount_remaining = greatest(a.proposed_loan_amount - coalesce(la.amount_funded,0),0)
from latest_accepted a
where la.id = a.loan_application_id
  and la.loan_amount is distinct from a.proposed_loan_amount;

-- 2) Keep every existing marketplace row synchronized to the accepted/current application.
update public.marketplace_loans ml
set loan_number = la.loan_number,
    business_name = la.business_name,
    borrower_name = la.full_name,
    apn = la.apn,
    county = la.county,
    state = la.state,
    acreage = la.acreage,
    land_value = la.land_value,
    loan_amount = la.loan_amount,
    funding_goal = la.loan_amount,
    borrower_interest_rate = la.borrower_interest_rate,
    investor_interest_rate = la.investor_interest_rate,
    company_spread_rate = la.company_spread_rate,
    repayment_term_months = la.repayment_term_months,
    updated_at = now()
from public.loan_applications la
where ml.loan_application_id = la.id;

-- 3) Recalculate funded/remaining from actual investments, never from stale UI values.
with totals as (
  select loan_id,
         coalesce(sum(amount) filter (where status not in ('refunded','cancelled','failed')),0) as funded
  from public.investments
  group by loan_id
)
update public.marketplace_loans ml
set amount_funded = coalesce(t.funded,0),
    amount_remaining = greatest(coalesce(ml.funding_goal,ml.loan_amount,0)-coalesce(t.funded,0),0),
    status = case
      when coalesce(ml.funding_goal,ml.loan_amount,0) > 0
       and coalesce(t.funded,0) >= coalesce(ml.funding_goal,ml.loan_amount,0)
      then 'Funded' else 'Open' end,
    updated_at = now()
from (select ml2.loan_application_id, coalesce(t2.funded,0) funded
      from public.marketplace_loans ml2
      left join totals t2 on t2.loan_id = ml2.loan_application_id) t
where ml.loan_application_id = t.loan_application_id;

update public.loan_applications la
set amount_funded = ml.amount_funded,
    amount_remaining = ml.amount_remaining
from public.marketplace_loans ml
where ml.loan_application_id = la.id;

-- 4) Finalize card or split investments. The $100 minimum applies to TOTAL investment,
--    not the wallet portion, so a leftover wallet balance such as $35 can be consumed.
create or replace function public.finalize_external_investment_v1(
  p_loan_number bigint,
  p_total_amount numeric,
  p_wallet_amount numeric default 0
)
returns public.investments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.investor_wallets;
  v_marketplace public.marketplace_loans;
  v_investment public.investments;
  v_wallet_use numeric := greatest(coalesce(p_wallet_amount,0),0);
  v_days integer := 7;
  v_enabled boolean := true;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_total_amount is null or p_total_amount < 100 then raise exception 'Minimum investment is $100'; end if;
  if v_wallet_use > p_total_amount then raise exception 'Wallet portion cannot exceed total investment'; end if;

  select * into v_marketplace
  from public.marketplace_loans
  where loan_number = p_loan_number and coalesce(published,true)=true
  for update;
  if not found then raise exception 'Marketplace loan % was not found', p_loan_number; end if;

  if p_total_amount > coalesce(v_marketplace.amount_remaining,v_marketplace.funding_goal,v_marketplace.loan_amount,0)
  then raise exception 'Investment exceeds the remaining funding amount'; end if;

  if v_wallet_use > 0 then
    select * into v_wallet from public.investor_wallets where user_id=v_user_id for update;
    if not found then raise exception 'Investor wallet was not found'; end if;
    if coalesce(v_wallet.available_balance,0) < v_wallet_use then raise exception 'Insufficient available cash'; end if;
    update public.investor_wallets
      set available_balance=available_balance-v_wallet_use,
          invested_balance=invested_balance+p_total_amount,
          updated_at=now()
      where user_id=v_user_id;
  else
    update public.investor_wallets
      set invested_balance=invested_balance+p_total_amount, updated_at=now()
      where user_id=v_user_id;
  end if;

  v_enabled := coalesce(v_marketplace.investor_refund_enabled,true);
  v_days := case when v_enabled then coalesce(v_marketplace.investor_refund_days,7) else 0 end;

  insert into public.investments(
    loan_id, investor_id, amount, investor_interest_rate, borrower_interest_rate,
    company_spread_rate, term_months, status, refund_policy_enabled,
    refund_period_days, refund_deadline, updated_at
  ) values (
    v_marketplace.loan_application_id, v_user_id, p_total_amount,
    v_marketplace.investor_interest_rate, v_marketplace.borrower_interest_rate,
    v_marketplace.company_spread_rate, v_marketplace.repayment_term_months,
    case when v_enabled and v_days>0 then 'protection_period' else 'settled' end,
    v_enabled, v_days,
    case when v_enabled and v_days>0 then now()+make_interval(days=>v_days) else now() end,
    now()
  ) returning * into v_investment;

  if v_wallet_use > 0 then
    insert into public.wallet_transactions(user_id,transaction_type,amount,loan_id,status,description)
    values(v_user_id,'investment',-v_wallet_use,v_marketplace.loan_application_id,'completed',
      'Wallet portion of split investment for Loan #'||p_loan_number::text||'.');
  end if;

  perform public.refresh_loan_funding_totals(v_marketplace.loan_application_id);
  return v_investment;
end;
$$;

revoke all on function public.finalize_external_investment_v1(bigint,numeric,numeric) from public;
grant execute on function public.finalize_external_investment_v1(bigint,numeric,numeric) to authenticated;

notify pgrst, 'reload schema';
commit;

-- Verification: revised amounts and funding totals should now agree.
select ml.loan_number, ml.loan_application_id, ml.loan_amount, ml.funding_goal,
       ml.amount_funded, ml.amount_remaining, ml.status
from public.marketplace_loans ml
where ml.loan_number in (352552,480946)
order by ml.loan_number;
