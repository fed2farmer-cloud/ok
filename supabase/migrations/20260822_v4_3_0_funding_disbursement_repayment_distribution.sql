-- SecuredLanding v4.3.0 - funding disbursement + repayment + investor distribution lifecycle
-- NON-DESTRUCTIVE. This migration records and controls the money-movement lifecycle.
-- External borrower payouts are NOT initiated by SQL; an admin records the processor/bank payout reference after release.

begin;
create extension if not exists pgcrypto;

create table if not exists public.loan_funding_disbursements (
  id uuid primary key default gen_random_uuid(),
  loan_number bigint not null unique,
  borrower_user_id uuid,
  funding_goal numeric(14,2) not null default 0,
  sold_amount numeric(14,2) not null default 0,
  protected_amount numeric(14,2) not null default 0,
  releasable_amount numeric(14,2) not null default 0,
  status text not null default 'funding_incomplete',
  processor text,
  processor_reference text,
  approved_by uuid,
  approved_at timestamptz,
  released_by uuid,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loan_funding_disbursements_status_check check (
    status in ('funding_incomplete','protection_hold','ready_for_release','approved','released','cancelled','exception')
  )
);

alter table if exists public.investor_positions add column if not exists investment_id bigint;
create unique index if not exists investor_positions_investment_uidx
  on public.investor_positions(investment_id) where investment_id is not null;

alter table if exists public.investor_distributions add column if not exists wallet_transaction_id uuid;
alter table if exists public.investor_distributions add column if not exists paid_at timestamptz;

create or replace function public.sync_investor_positions_for_loan_v1(p_loan_number bigint)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer := 0;
  v_app_id bigint;
begin
  select id into v_app_id from public.loan_applications where loan_number=p_loan_number limit 1;
  if v_app_id is null then raise exception 'Loan % not found', p_loan_number; end if;

  insert into public.investor_positions(
    loan_number, investor_user_id, original_principal, current_principal,
    acquired_at, source, status, investment_id
  )
  select
    p_loan_number,
    i.investor_id,
    i.amount,
    i.amount,
    coalesce(i.created_at, now()),
    'primary',
    'active',
    i.id
  from public.investments i
  where i.loan_application_id=v_app_id
    and i.investor_id is not null
    and lower(coalesce(i.status,'')) in ('active','settled','funded','completed')
  on conflict (investment_id) where investment_id is not null
  do update set
    investor_user_id=excluded.investor_user_id,
    original_principal=excluded.original_principal,
    status='active';

  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.refresh_funding_disbursement_v1(p_loan_number bigint)
returns public.loan_funding_disbursements
language plpgsql
security definer
set search_path=public
as $$
declare
  v_loan public.loan_applications%rowtype;
  v_goal numeric := 0;
  v_sold numeric := 0;
  v_protected numeric := 0;
  v_available numeric := 0;
  v_status text;
  v_row public.loan_funding_disbursements;
begin
  select * into v_loan from public.loan_applications where loan_number=p_loan_number limit 1;
  if not found then raise exception 'Loan % not found', p_loan_number; end if;

  select funding_goal, sold_amount, protected_amount,
         greatest(funding_goal-sold_amount-protected_amount,0)
  into v_goal, v_sold, v_protected, v_available
  from public.marketplace_funding_breakdown_v1
  where loan_number=p_loan_number
  limit 1;

  if v_goal is null then
    v_goal := coalesce(v_loan.loan_amount,0);
    select
      coalesce(sum(i.amount) filter(where lower(coalesce(i.status,'')) in ('active','settled','funded','completed')),0),
      coalesce(sum(i.amount) filter(where lower(coalesce(i.status,''))='protection_period'),0)
    into v_sold, v_protected
    from public.investments i
    where i.loan_application_id=v_loan.id;
    v_available := greatest(v_goal-v_sold-v_protected,0);
  end if;

  v_status := case
    when v_available > 0.009 then 'funding_incomplete'
    when v_protected > 0.009 then 'protection_hold'
    else 'ready_for_release'
  end;

  insert into public.loan_funding_disbursements(
    loan_number, borrower_user_id, funding_goal, sold_amount, protected_amount,
    releasable_amount, status, updated_at
  ) values (
    p_loan_number, v_loan.user_id, v_goal, v_sold, v_protected,
    case when v_status='ready_for_release' then least(v_sold,v_goal) else 0 end,
    v_status, now()
  )
  on conflict(loan_number) do update set
    borrower_user_id=excluded.borrower_user_id,
    funding_goal=excluded.funding_goal,
    sold_amount=excluded.sold_amount,
    protected_amount=excluded.protected_amount,
    releasable_amount=case
      when public.loan_funding_disbursements.status in ('approved','released') then public.loan_funding_disbursements.releasable_amount
      else excluded.releasable_amount
    end,
    status=case
      when public.loan_funding_disbursements.status in ('approved','released') then public.loan_funding_disbursements.status
      else excluded.status
    end,
    updated_at=now()
  returning * into v_row;

  return v_row;
end $$;

create or replace function public.is_current_user_admin_v1()
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists(select 1 from public.admin_users a where a.user_id=auth.uid());
$$;

create or replace function public.approve_funding_disbursement_v1(p_loan_number bigint)
returns public.loan_funding_disbursements
language plpgsql security definer set search_path=public as $$
declare v_row public.loan_funding_disbursements;
begin
  if not public.is_current_user_admin_v1() then raise exception 'Admin access required'; end if;
  v_row := public.refresh_funding_disbursement_v1(p_loan_number);
  if v_row.status <> 'ready_for_release' then
    raise exception 'Loan % is not ready for release. Current status: %',p_loan_number,v_row.status;
  end if;
  update public.loan_funding_disbursements set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now()
  where loan_number=p_loan_number returning * into v_row;
  insert into public.loan_servicing_events(loan_number,event_type,amount,details,created_by)
  values(p_loan_number,'funding_disbursement_approved',v_row.releasable_amount,jsonb_build_object('disbursement_id',v_row.id),auth.uid());
  return v_row;
end $$;

create or replace function public.release_funding_disbursement_v1(
  p_loan_number bigint,
  p_processor text,
  p_processor_reference text
)
returns public.loan_funding_disbursements
language plpgsql security definer set search_path=public as $$
declare v_row public.loan_funding_disbursements;
begin
  if not public.is_current_user_admin_v1() then raise exception 'Admin access required'; end if;
  if nullif(btrim(coalesce(p_processor,'')),'') is null then raise exception 'Processor is required'; end if;
  if nullif(btrim(coalesce(p_processor_reference,'')),'') is null then raise exception 'Processor payout reference is required'; end if;

  select * into v_row from public.loan_funding_disbursements where loan_number=p_loan_number for update;
  if not found then raise exception 'Disbursement record not found'; end if;
  if v_row.status='released' then return v_row; end if;
  if v_row.status<>'approved' then raise exception 'Disbursement must be approved before release'; end if;

  perform public.sync_investor_positions_for_loan_v1(p_loan_number);

  update public.loan_funding_disbursements
  set status='released', processor=p_processor, processor_reference=p_processor_reference,
      released_by=auth.uid(), released_at=now(), updated_at=now()
  where loan_number=p_loan_number returning * into v_row;

  update public.loan_applications
  set status='Funded'
  where loan_number=p_loan_number;

  if not exists(select 1 from public.loan_payment_schedule where loan_number=p_loan_number) then
    perform public.generate_payment_schedule_v4(p_loan_number,(current_date+interval '1 month')::date);
  end if;

  insert into public.loan_servicing_events(loan_number,event_type,amount,details,created_by)
  values(p_loan_number,'funding_disbursement_released',v_row.releasable_amount,
    jsonb_build_object('disbursement_id',v_row.id,'processor',p_processor,'processor_reference',p_processor_reference),auth.uid());
  return v_row;
end $$;

-- Correct settlement: borrower interest is split between investor yield and company spread.
create or replace function public.settle_borrower_payment_v5(p_payment_id uuid)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  p public.borrower_payments%rowtype;
  s public.loan_payment_schedule%rowtype;
  l record;
  remaining numeric; principal numeric; borrower_interest numeric; investor_interest numeric; company_revenue numeric; unallocated numeric;
  pos record; total_pos numeric; share numeric;
begin
  select * into p from public.borrower_payments where id=p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if lower(coalesce(p.status,''))='settled' and p.settled_at is not null then
    return jsonb_build_object('ok',true,'duplicate',true,'payment_id',p.id);
  end if;

  select coalesce(borrower_interest_rate,10) borrower_rate, coalesce(investor_interest_rate,9) investor_rate
  into l from public.loan_applications where loan_number=p.loan_number limit 1;

  if p.schedule_id is not null then
    select * into s from public.loan_payment_schedule where id=p.schedule_id for update;
  else
    select * into s from public.loan_payment_schedule
    where loan_number=p.loan_number and lower(status) in ('due','missed','late','partial','upcoming')
    order by case lower(status) when 'due' then 1 when 'missed' then 2 when 'late' then 3 when 'partial' then 4 else 5 end,
             due_date,installment_number limit 1 for update;
  end if;
  if not found then raise exception 'Schedule installment not found'; end if;

  if exists(select 1 from public.borrower_payments x where x.schedule_id=s.id and x.id<>p.id and lower(x.status)='settled') then
    update public.borrower_payments set status='reversed',schedule_id=s.id,
      raw_reference=coalesce(raw_reference,'{}'::jsonb)||jsonb_build_object('duplicate_settlement_blocked',true,'blocked_at',now())
    where id=p.id;
    return jsonb_build_object('ok',true,'duplicate',true,'reversed',true,'payment_id',p.id,'schedule_id',s.id);
  end if;

  remaining:=coalesce(p.amount,0);
  borrower_interest:=least(remaining,greatest(coalesce(s.expected_interest,0)-coalesce(s.collected_interest,0),0));
  remaining:=remaining-borrower_interest;
  principal:=least(remaining,greatest(coalesce(s.expected_principal,0)-coalesce(s.collected_principal,0),0));
  remaining:=remaining-principal;
  unallocated:=greatest(remaining,0);

  investor_interest:=case when coalesce(l.borrower_rate,0)<=0 then borrower_interest
    else round(borrower_interest*least(greatest(coalesce(l.investor_rate,0)/l.borrower_rate,0),1),2) end;
  company_revenue:=greatest(borrower_interest-investor_interest,0);

  update public.loan_payment_schedule set
    collected_interest=coalesce(collected_interest,0)+borrower_interest,
    collected_principal=coalesce(collected_principal,0)+principal,
    status=case when coalesce(collected_interest,0)+borrower_interest+coalesce(collected_principal,0)+principal>=coalesce(expected_total,0)-0.01 then 'paid' else 'partial' end,
    paid_at=case when coalesce(collected_interest,0)+borrower_interest+coalesce(collected_principal,0)+principal>=coalesce(expected_total,0)-0.01 then now() else paid_at end
  where id=s.id;

  insert into public.payment_allocations(borrower_payment_id,loan_number,allocation_type,amount)
  select p.id,p.loan_number,t,a from (values
    ('principal'::text,principal),('investor_interest'::text,investor_interest),('company_revenue'::text,company_revenue)
  ) v(t,a) where a>0;

  perform public.sync_investor_positions_for_loan_v1(p.loan_number);
  select coalesce(sum(current_principal),0) into total_pos from public.investor_positions where loan_number=p.loan_number and status='active';

  if total_pos>0 then
    for pos in select * from public.investor_positions where loan_number=p.loan_number and status='active' order by id loop
      share:=pos.current_principal/total_pos;
      insert into public.investor_distributions(
        borrower_payment_id,loan_number,investor_user_id,principal_amount,interest_amount,status,available_at
      ) values(p.id,p.loan_number,pos.investor_user_id,round(principal*share,2),round(investor_interest*share,2),'available',now());
      update public.investor_positions
      set current_principal=greatest(current_principal-round(principal*share,2),0),
          status=case when greatest(current_principal-round(principal*share,2),0)<=0.01 then 'paid_off' else status end
      where id=pos.id;
    end loop;
  end if;

  update public.borrower_payments set status='settled',schedule_id=s.id,settled_at=now(),
    raw_reference=coalesce(raw_reference,'{}'::jsonb)||jsonb_build_object(
      'settled_by','settle_borrower_payment_v5','settled_at',now(),'principal',principal,
      'borrower_interest',borrower_interest,'investor_interest',investor_interest,'company_revenue',company_revenue,'unallocated',unallocated)
  where id=p.id;

  insert into public.loan_servicing_events(loan_number,event_type,amount,details)
  values(p.loan_number,'borrower_payment_settled',p.amount,jsonb_build_object(
    'payment_id',p.id,'schedule_id',s.id,'principal',principal,'borrower_interest',borrower_interest,
    'investor_interest',investor_interest,'company_revenue',company_revenue,'unallocated',unallocated));

  return jsonb_build_object('ok',true,'duplicate',false,'payment_id',p.id,'schedule_id',s.id,
    'principal',principal,'borrower_interest',borrower_interest,'investor_interest',investor_interest,
    'company_revenue',company_revenue,'unallocated',unallocated);
end $$;

create or replace function public.credit_available_distributions_v1(p_payment_id uuid)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare d public.investor_distributions%rowtype; v_tx uuid; v_total numeric:=0; v_count int:=0; v_app_id bigint;
begin
  for d in select * from public.investor_distributions where borrower_payment_id=p_payment_id and status='available' for update loop
    insert into public.investor_wallets(user_id,available_balance,invested_balance,updated_at)
    values(d.investor_user_id,d.principal_amount+d.interest_amount,0,now())
    on conflict(user_id) do update set available_balance=coalesce(public.investor_wallets.available_balance,0)+excluded.available_balance,updated_at=now();

    select id into v_app_id from public.loan_applications where loan_number=d.loan_number limit 1;
    insert into public.wallet_transactions(user_id,transaction_type,amount,loan_id,status,description,idempotency_key)
    values(d.investor_user_id,'Distribution',d.principal_amount+d.interest_amount,v_app_id,'completed',
      'Borrower repayment distribution for Loan #'||d.loan_number||'.','repayment-distribution-'||d.id)
    on conflict(user_id,idempotency_key) where idempotency_key is not null do nothing
    returning id into v_tx;

    update public.investor_distributions set status='paid',wallet_transaction_id=coalesce(v_tx,wallet_transaction_id),paid_at=now()
    where id=d.id;
    v_total:=v_total+d.principal_amount+d.interest_amount; v_count:=v_count+1;
  end loop;
  return jsonb_build_object('ok',true,'distribution_count',v_count,'wallet_credited',v_total);
end $$;

create or replace function public.finalize_borrower_repayment_v1(
  p_loan_number bigint,
  p_schedule_id uuid,
  p_amount numeric,
  p_processor_transaction_id text
)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_loan public.loan_applications%rowtype; v_payment public.borrower_payments%rowtype; v_result jsonb; v_credit jsonb; v_tx text:=nullif(btrim(p_processor_transaction_id),'');
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Positive repayment amount required'; end if;
  if v_tx is null then raise exception 'Processor transaction ID required'; end if;

  select * into v_loan from public.loan_applications where loan_number=p_loan_number and user_id=v_user limit 1;
  if not found then raise exception 'Borrower loan % not found for signed-in user',p_loan_number; end if;
  if p_schedule_id is not null and not exists(select 1 from public.loan_payment_schedule where id=p_schedule_id and loan_number=p_loan_number) then
    raise exception 'Schedule installment does not belong to Loan %',p_loan_number;
  end if;

  select * into v_payment from public.borrower_payments
  where processor_transaction_id=v_tx and borrower_user_id=v_user limit 1;
  if found then
    return jsonb_build_object('ok',true,'duplicate',true,'payment_id',v_payment.id,'status',v_payment.status);
  end if;

  insert into public.borrower_payments(
    loan_number,borrower_user_id,schedule_id,processor,processor_transaction_id,idempotency_key,amount,status,raw_reference
  ) values(
    p_loan_number,v_user,p_schedule_id,'nmi',v_tx,'nmi-repayment-'||v_tx,p_amount,'authorized',
    jsonb_build_object('source','finalize_borrower_repayment_v1','processor_transaction_id',v_tx)
  ) returning * into v_payment;

  v_result:=public.settle_borrower_payment_v5(v_payment.id);
  v_credit:=public.credit_available_distributions_v1(v_payment.id);
  return jsonb_build_object('ok',true,'payment_id',v_payment.id,'settlement',v_result,'distribution_credit',v_credit);
end $$;

create or replace function public.refresh_disbursement_after_investment_v1()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_num bigint; v_app bigint;
begin
  v_app:=coalesce(new.loan_application_id,old.loan_application_id,new.loan_id,old.loan_id);
  select loan_number into v_num from public.loan_applications where id=v_app limit 1;
  if v_num is not null then perform public.refresh_funding_disbursement_v1(v_num); end if;
  return coalesce(new,old);
end $$;

drop trigger if exists trg_refresh_disbursement_after_investment_v1 on public.investments;
create trigger trg_refresh_disbursement_after_investment_v1
after insert or update or delete on public.investments
for each row execute function public.refresh_disbursement_after_investment_v1();


create or replace view public.admin_lifecycle_health_v1 as
select
  la.loan_number,
  la.status as loan_status,
  coalesce(la.loan_amount,0)::numeric(14,2) as loan_amount,
  coalesce(mf.sold_amount,0)::numeric(14,2) as sold_amount,
  coalesce(mf.protected_amount,0)::numeric(14,2) as protected_amount,
  greatest(coalesce(mf.funding_goal,la.loan_amount,0)-coalesce(mf.sold_amount,0)-coalesce(mf.protected_amount,0),0)::numeric(14,2) as available_amount,
  fd.status as disbursement_status,
  fd.released_at,
  (select count(*) from public.loan_payment_schedule s where s.loan_number=la.loan_number) as schedule_rows,
  (select count(*) from public.borrower_payments bp where bp.loan_number=la.loan_number and lower(bp.status)='settled') as settled_payments,
  (select coalesce(sum(bp.amount),0) from public.borrower_payments bp where bp.loan_number=la.loan_number and lower(bp.status)='settled')::numeric(14,2) as borrower_paid,
  (select coalesce(sum(d.principal_amount+d.interest_amount),0) from public.investor_distributions d where d.loan_number=la.loan_number and d.status='paid')::numeric(14,2) as investor_wallet_distributed
from public.loan_applications la
left join public.marketplace_funding_breakdown_v1 mf on mf.loan_number=la.loan_number
left join public.loan_funding_disbursements fd on fd.loan_number=la.loan_number
where la.loan_number is not null;

-- Seed/refresh lifecycle control rows for loans already on the marketplace.
do $$
declare r record;
begin
  for r in select distinct loan_number from public.marketplace_loans where loan_number is not null loop
    begin
      perform public.refresh_funding_disbursement_v1(r.loan_number);
    exception when others then
      raise notice 'Could not refresh disbursement state for Loan %: %',r.loan_number,sqlerrm;
    end;
  end loop;
end $$;

revoke all on function public.approve_funding_disbursement_v1(bigint) from public;
revoke all on function public.release_funding_disbursement_v1(bigint,text,text) from public;
revoke all on function public.finalize_borrower_repayment_v1(bigint,uuid,numeric,text) from public;
grant execute on function public.approve_funding_disbursement_v1(bigint) to authenticated;
grant execute on function public.release_funding_disbursement_v1(bigint,text,text) to authenticated;
grant execute on function public.finalize_borrower_repayment_v1(bigint,uuid,numeric,text) to authenticated;

notify pgrst,'reload schema';
commit;
