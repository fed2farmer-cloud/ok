begin;

alter table public.investments
  add column if not exists protection_expires_at timestamptz,
  add column if not exists activated_at timestamptz;

update public.investments
set protection_expires_at = coalesce(protection_expires_at, refund_deadline)
where protection_expires_at is null and refund_deadline is not null;

create or replace view public.investor_portfolio_v29 as
select
  i.id as investment_id,
  i.investor_id,
  i.loan_id as internal_loan_id,
  la.loan_number as public_loan_number,
  coalesce(ml.business_name, la.business_name, 'Investment') as business_name,
  i.amount,
  i.investor_interest_rate,
  i.term_months,
  i.status,
  i.created_at,
  i.refund_policy_enabled,
  i.refund_period_days,
  coalesce(i.protection_expires_at, i.refund_deadline) as protection_expires_at,
  i.refunded_at,
  i.settled_at,
  i.activated_at,
  case
    when i.status = 'protection_period' and coalesce(i.protection_expires_at, i.refund_deadline) > now() then 'Protected'
    when i.status in ('refund_requested','refund_processing') then 'Refund Processing'
    when i.status = 'refunded' then 'Refunded'
    when i.status in ('settled','active') then 'Active'
    when i.status = 'cancelled' then 'Cancelled'
    when i.status = 'failed' then 'Failed'
    else initcap(replace(coalesce(i.status,'pending'),'_',' '))
  end as display_status,
  (i.status = 'protection_period' and coalesce(i.protection_expires_at, i.refund_deadline) > now()) as refund_eligible
from public.investments i
join public.loan_applications la on la.id = i.loan_id
left join public.marketplace_loans ml on ml.loan_application_id = i.loan_id;

grant select on public.investor_portfolio_v29 to authenticated;

create or replace function public.settle_expired_investments_v29()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select id, loan_id, investor_id
    from public.investments
    where status = 'protection_period'
      and coalesce(protection_expires_at, refund_deadline) <= now()
    for update skip locked
  loop
    update public.investments
    set status='active', settled_at=coalesce(settled_at,now()), activated_at=now(), updated_at=now()
    where id=r.id;

    insert into public.investment_audit_events(investment_id,actor_user_id,event_key,description,after_state)
    values(r.id,null,'protection_expired','The investor refund period expired and the investment became active.',jsonb_build_object('status','active','activated_at',now()));

    insert into public.investor_notifications(user_id,investment_id,title,message,notification_type)
    values(r.investor_id,r.id,'Investment is now active','The 7-day protection period has expired. Your investment is now active.','investment_activated');

    perform public.refresh_loan_funding_totals(r.loan_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace view public.loan_disbursement_availability_v29 as
select
  ml.loan_application_id as loan_id,
  ml.loan_number,
  coalesce(sum(i.amount) filter (where i.status in ('active','settled')),0) as available_for_disbursement,
  coalesce(sum(i.amount) filter (where i.status in ('protection_period','refund_requested','refund_processing')),0) as protected_funds,
  coalesce(sum(i.amount) filter (where i.status not in ('refunded','cancelled','failed')),0) as total_committed
from public.marketplace_loans ml
left join public.investments i on i.loan_id = ml.loan_application_id
group by ml.loan_application_id, ml.loan_number;

grant select on public.loan_disbursement_availability_v29 to authenticated;
notify pgrst, 'reload schema';
commit;
