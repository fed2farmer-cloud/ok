-- SecuredLanding ownership + distribution permanent fix
-- 2026-09-03
--
-- Fix 1: sync_investor_positions_for_loan_v1 follows current certificate ownership
--        and preserves current_principal on existing positions.
-- Fix 2: settle_borrower_payment_v5 falls back safely for primary certificates
--        with no transfer-history row.
--
-- Apply in Supabase SQL Editor or as a normal migration.

create or replace function public.sync_investor_positions_for_loan_v1(
  p_loan_number bigint
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer := 0;
  v_app_id bigint;
begin
  select id
  into v_app_id
  from public.loan_applications
  where loan_number = p_loan_number
  limit 1;

  if v_app_id is null then
    raise exception 'Loan % not found', p_loan_number;
  end if;

  insert into public.investor_positions (
    loan_number,
    investor_user_id,
    original_principal,
    current_principal,
    acquired_at,
    source,
    status,
    investment_id
  )
  select
    p_loan_number,
    coalesce(i.current_owner_id, i.investor_id),
    i.amount,
    i.amount,
    coalesce(i.created_at, now()),
    case
      when i.current_owner_id is not null
       and i.current_owner_id is distinct from i.investor_id
      then 'secondary'
      else 'primary'
    end,
    'active',
    i.id
  from public.investments i
  where i.loan_application_id = v_app_id
    and coalesce(i.current_owner_id, i.investor_id) is not null
    and lower(coalesce(i.status, '')) in (
      'active',
      'settled',
      'funded',
      'completed'
    )
  on conflict (investment_id)
  where investment_id is not null
  do update set
    investor_user_id = excluded.investor_user_id,
    original_principal = excluded.original_principal,
    source = excluded.source,
    status = 'active';

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;


CREATE OR REPLACE FUNCTION public.settle_borrower_payment_v5(p_payment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 p public.borrower_payments%rowtype;
  s public.loan_payment_schedule%rowtype;
   l record; pos record; cert record;
    rem numeric; principal numeric; bi numeric; ii numeric; fee numeric;
     unallocated numeric; total_pos numeric; share numeric;
      ps numeric; ins numeric; fs numeric;
       pd numeric:=0; idist numeric:=0; fd numeric:=0;
        cnt integer:=0; n integer:=0;
        begin
         select * into p from public.borrower_payments
          where id=p_payment_id for update;
           if not found then raise exception 'Payment not found'; end if;

            if lower(coalesce(p.status,''))='settled' and p.settled_at is not null then
              return jsonb_build_object('ok',true,'duplicate',true,'payment_id',p.id);
               end if;

                select coalesce(borrower_interest_rate,10) borrower_rate,
                        coalesce(investor_interest_rate,9) investor_rate
                         into l from public.loan_applications
                          where loan_number=p.loan_number limit 1;

                           if p.schedule_id is not null then
                             select * into s from public.loan_payment_schedule
                               where id=p.schedule_id for update;
                                else
                                  select * into s from public.loan_payment_schedule
                                    where loan_number=p.loan_number
                                       and lower(status) in ('due','missed','late','partial','upcoming')
                                         order by due_date,installment_number limit 1 for update;
                                          end if;
                                           if not found then raise exception 'Schedule installment not found'; end if;

                                            if exists(select 1 from public.borrower_payments x
                                               where x.schedule_id=s.id and x.id<>p.id
                                                  and lower(x.status)='settled') then
                                                    update public.borrower_payments
                                                      set status='reversed',schedule_id=s.id
                                                        where id=p.id;
                                                          return jsonb_build_object('ok',true,'duplicate',true,'reversed',true);
                                                           end if;

                                                            rem:=coalesce(p.amount,0);
                                                             bi:=least(rem,greatest(coalesce(s.expected_interest,0)
                                                                  -coalesce(s.collected_interest,0),0));
                                                                   rem:=rem-bi;
                                                                    principal:=least(rem,greatest(coalesce(s.expected_principal,0)
                                                                         -coalesce(s.collected_principal,0),0));
                                                                          rem:=rem-principal;
                                                                           unallocated:=greatest(rem,0);

                                                                            ii:=case when l.borrower_rate<=0 then bi
                                                                                 else round(bi*least(greatest(l.investor_rate/l.borrower_rate,0),1),2)
                                                                                      end;
                                                                                       fee:=greatest(bi-ii,0);
                                                                                        update public.loan_payment_schedule set
                                                                                          collected_interest=coalesce(collected_interest,0)+bi,
                                                                                            collected_principal=coalesce(collected_principal,0)+principal,
                                                                                              status=case when coalesce(collected_interest,0)+bi+
                                                                                                 coalesce(collected_principal,0)+principal>=coalesce(expected_total,0)-.01
                                                                                                    then 'paid' else 'partial' end,
                                                                                                      paid_at=case when coalesce(collected_interest,0)+bi+
                                                                                                         coalesce(collected_principal,0)+principal>=coalesce(expected_total,0)-.01
                                                                                                            then now() else paid_at end
                                                                                                             where id=s.id;

                                                                                                              insert into public.payment_allocations
                                                                                                                (borrower_payment_id,loan_number,allocation_type,amount)
                                                                                                                 select p.id,p.loan_number,t,a from (values
                                                                                                                   ('principal'::text,principal),
                                                                                                                     ('investor_interest'::text,ii),
                                                                                                                       ('company_revenue'::text,fee)
                                                                                                                        )v(t,a) where a>0;

                                                                                                                         perform public.sync_investor_positions_for_loan_v1(p.loan_number);

                                                                                                                          select coalesce(sum(current_principal),0),count(*)
                                                                                                                           into total_pos,cnt
                                                                                                                            from public.investor_positions
                                                                                                                             where loan_number=p.loan_number and status='active';

                                                                                                                              if total_pos<=0 or cnt=0 then
                                                                                                                                raise exception 'No active positions for Loan %',p.loan_number;
                                                                                                                                 end if;

                                                                                                                                  for pos in
                                                                                                                                    select * from public.investor_positions
                                                                                                                                      where loan_number=p.loan_number and status='active'
                                                                                                                                        order by id
                                                                                                                                         loop
                                                                                                                                           n:=n+1;

                                                                                                                                             select
                                                                                                                                                i.id as investment_id,
                                                                                                                                                   i.certificate_number,
                                                                                                                                                      coalesce(
              (
                select h.to_owner_id
                from public.investment_ownership_history h
                where h.investment_id = i.id
                  and h.certificate_number = i.certificate_number
                  and h.transfer_status = 'completed'
                order by h.transferred_at desc, h.created_at desc
                limit 1
              ),
              i.current_owner_id,
              i.investor_id
            ) as certificate_owner
                                                                                                                                                                                         into cert
                                                                                                                                                                                           from public.investments i
                                                                                                                                                                                             where i.id=pos.investment_id;

                                                                                                                                                                                               if not found then
                                                                                                                                                                                                  raise exception 'Position % has no investment',pos.id;
                                                                                                                                                                                                    end if;

                                                                                                                                                                                                      if cert.certificate_number is null then
                                                                                                                                                                                                         raise exception 'Investment % has no certificate',cert.investment_id;
                                                                                                                                                                                                           end if;

                                                                                                                                                                                                             if cert.certificate_owner is null then
                                                                                                                                                                                                                raise exception 'Certificate % has no completed owner record',
                                                                                                                                                                                                                    cert.certificate_number;
                                                                                                                                                                                                                      end if;

                                                                                                                                                                                                                        share:=pos.current_principal/total_pos;

                                                                                                                                                                                                                          if n=cnt then
                                                                                                                                                                                                                             ps:=principal-pd;
                                                                                                                                                                                                                                ins:=ii-idist;
                                                                                                                                                                                                                                   fs:=fee-fd;
                                                                                                                                                                                                                                     else
                                                                                                                                                                                                                                        ps:=round(principal*share,2);
                                                                                                                                                                                                                                           ins:=round(ii*share,2);
                                                                                                                                                                                                                                              fs:=round(fee*share,2);
                                                                                                                                                                                                                                                end if;

                                                                                                                                                                                                                                                  pd:=pd+ps;
                                                                                                                                                                                                                                                    idist:=idist+ins;
                                                                                                                                                                                                                                                      fd:=fd+fs;
                                                                                                                                                                                                                                                        insert into public.investor_distributions(
                                                                                                                                                                                                                                                             loan_id,investor_id,payment_id,principal_amount,
                                                                                                                                                                                                                                                                interest_amount,company_fee,status,investment_id,certificate_number
                                                                                                                                                                                                                                                                  ) values(
                                                                                                                                                                                                                                                                     p.loan_number,cert.certificate_owner,p.id,ps,
                                                                                                                                                                                                                                                                        ins,fs,'available',cert.investment_id,cert.certificate_number
                                                                                                                                                                                                                                                                          );

                                                                                                                                                                                                                                                                            update public.investor_positions set
                                                                                                                                                                                                                                                                               current_principal=greatest(current_principal-ps,0),
                                                                                                                                                                                                                                                                                  investor_user_id=cert.certificate_owner,
                                                                                                                                                                                                                                                                                     status=case when greatest(current_principal-ps,0)<=.01
                                                                                                                                                                                                                                                                                         then 'paid_off' else status end
                                                                                                                                                                                                                                                                                           where id=pos.id;
                                                                                                                                                                                                                                                                                            end loop;

                                                                                                                                                                                                                                                                                             update public.borrower_payments set
                                                                                                                                                                                                                                                                                               status='settled',
                                                                                                                                                                                                                                                                                                 schedule_id=s.id,
                                                                                                                                                                                                                                                                                                   settled_at=now(),
                                                                                                                                                                                                                                                                                                     raw_reference=coalesce(raw_reference,'{}'::jsonb)||
                                                                                                                                                                                                                                                                                                        jsonb_build_object(
                                                                                                                                                                                                                                                                                                            'settled_by','settle_borrower_payment_v5_certificate_history',
                                                                                                                                                                                                                                                                                                                'principal',principal,
                                                                                                                                                                                                                                                                                                                    'borrower_interest',bi,
                                                                                                                                                                                                                                                                                                                        'investor_interest',ii,
                                                                                                                                                                                                                                                                                                                            'company_revenue',fee,
                                                                                                                                                                                                                                                                                                                                'unallocated',unallocated,
                                                                                                                                                                                                                                                                                                                                    'certificate_count',cnt
                                                                                                                                                                                                                                                                                                                                       )
                                                                                                                                                                                                                                                                                                                                        where id=p.id;

                                                                                                                                                                                                                                                                                                                                         insert into public.loan_servicing_events(
                                                                                                                                                                                                                                                                                                                                           loan_number,event_type,amount,details
                                                                                                                                                                                                                                                                                                                                            ) values(
                                                                                                                                                                                                                                                                                                                                              p.loan_number,'borrower_payment_settled',p.amount,
                                                                                                                                                                                                                                                                                                                                                jsonb_build_object(
                                                                                                                                                                                                                                                                                                                                                   'payment_id',p.id,
                                                                                                                                                                                                                                                                                                                                                      'schedule_id',s.id,
                                                                                                                                                                                                                                                                                                                                                         'principal',principal,
                                                                                                                                                                                                                                                                                                                                                            'borrower_interest',bi,
                                                                                                                                                                                                                                                                                                                                                               'investor_interest',ii,
                                                                                                                                                                                                                                                                                                                                                                  'company_revenue',fee,
                                                                                                                                                                                                                                                                                                                                                                     'distribution_basis','latest_completed_certificate_owner',
                                                                                                                                                                                                                                                                                                                                                                        'certificate_count',cnt
                                                                                                                                                                                                                                                                                                                                                                          )
                                                                                                                                                                                                                                                                                                                                                                           );

                                                                                                                                                                                                                                                                                                                                                                            return jsonb_build_object(
                                                                                                                                                                                                                                                                                                                                                                              'ok',true,
                                                                                                                                                                                                                                                                                                                                                                                'duplicate',false,
                                                                                                                                                                                                                                                                                                                                                                                  'payment_id',p.id,
                                                                                                                                                                                                                                                                                                                                                                                    'principal',principal,
                                                                                                                                                                                                                                                                                                                                                                                      'borrower_interest',bi,
                                                                                                                                                                                                                                                                                                                                                                                        'investor_interest',ii,
                                                                                                                                                                                                                                                                                                                                                                                          'company_revenue',fee,
                                                                                                                                                                                                                                                                                                                                                                                            'unallocated',unallocated,
                                                                                                                                                                                                                                                                                                                                                                                              'distribution_basis','latest_completed_certificate_owner',
                                                                                                                                                                                                                                                                                                                                                                                                'certificate_count',cnt
                                                                                                                                                                                                                                                                                                                                                                                                 );
                                                                                                                                                                                                                                                                                                                                                                                                 end;
                                                                                                                                                                                                                                                                                                                                                                                                 $function$;

notify pgrst, 'reload schema';
