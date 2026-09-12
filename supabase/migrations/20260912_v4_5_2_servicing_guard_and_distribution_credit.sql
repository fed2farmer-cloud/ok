begin;

-- SecuredLanding v4.5.2
-- 1) Do not allow borrower repayment until funding is fully released.
-- 2) Prevent card charging before that check by exposing a safe preflight RPC.
-- 3) Restore atomic borrower-payment finalization.
-- 4) Credit principal + investor interest to the current certificate owner's wallet.
-- 5) Prevent duplicate processor and wallet-ledger credits.

create unique index if not exists wallet_transactions_idempotency_key_uidx
  on public.wallet_transactions(idempotency_key)
  where idempotency_key is not null;

create unique index if not exists borrower_payments_processor_transaction_id_uidx
  on public.borrower_payments(processor_transaction_id)
  where processor_transaction_id is not null;

create or replace function public.borrower_repayment_preflight_v1(
  p_loan_number bigint,
  p_schedule_id uuid default null,
  p_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_loan public.loan_applications%rowtype;
  v_fd public.loan_funding_disbursements%rowtype;
  v_schedule public.loan_payment_schedule%rowtype;
  v_remaining numeric := 0;
begin
  if v_user is null then
    return jsonb_build_object('allowed', false, 'reason', 'Sign in before making a repayment.');
  end if;

  select * into v_loan
  from public.loan_applications
  where loan_number = p_loan_number
    and user_id = v_user
  limit 1;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'This loan does not belong to the signed-in borrower.');
  end if;

  select * into v_fd
  from public.loan_funding_disbursements
  where loan_number = p_loan_number
  limit 1;

  if not found
     or lower(coalesce(v_fd.status,'')) <> 'released'
     or v_fd.released_at is null then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'Repayments are locked until the loan is fully funded and borrower funds have been released.',
      'loan_number', p_loan_number,
      'disbursement_status', coalesce(v_fd.status, 'not_created')
    );
  end if;

  if coalesce(v_fd.funding_goal,0) <= 0
     or coalesce(v_fd.sold_amount,0) + 0.009 < coalesce(v_fd.funding_goal,0)
     or coalesce(v_fd.protected_amount,0) > 0.009 then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'Repayments are locked because funding has not fully cleared.',
      'loan_number', p_loan_number,
      'funding_goal', coalesce(v_fd.funding_goal,0),
      'sold_amount', coalesce(v_fd.sold_amount,0),
      'protected_amount', coalesce(v_fd.protected_amount,0)
    );
  end if;

  if p_schedule_id is not null then
    select * into v_schedule
    from public.loan_payment_schedule
    where id = p_schedule_id
      and loan_number = p_loan_number
    limit 1;

    if not found then
      return jsonb_build_object('allowed', false, 'reason', 'The selected installment does not belong to this loan.');
    end if;

    if lower(coalesce(v_schedule.status,'')) in ('paid','waived') then
      return jsonb_build_object('allowed', false, 'reason', 'This installment is already closed.');
    end if;

    v_remaining := greatest(
      coalesce(v_schedule.expected_total,0)
      - coalesce(v_schedule.collected_principal,0)
      - coalesce(v_schedule.collected_interest,0),
      0
    );

    if p_amount is not null and (p_amount <= 0 or p_amount > v_remaining + 0.01) then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'Payment amount must be positive and cannot exceed the remaining installment balance.',
        'remaining_installment_balance', round(v_remaining,2)
      );
    end if;
  elsif not exists (
    select 1 from public.loan_payment_schedule
    where loan_number = p_loan_number
      and lower(coalesce(status,'')) not in ('paid','waived')
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'No open repayment installment is available yet.');
  end if;

  return jsonb_build_object(
    'allowed', true,
    'loan_number', p_loan_number,
    'disbursement_status', v_fd.status,
    'released_at', v_fd.released_at,
    'remaining_installment_balance', case when p_schedule_id is null then null else round(v_remaining,2) end
  );
end;
$$;

create or replace function public.credit_available_distributions_v2(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.investor_distributions%rowtype;
  v_credit numeric := 0;
  v_total numeric := 0;
  v_count integer := 0;
  v_tx uuid;
  v_app_id bigint;
begin
  for d in
    select *
    from public.investor_distributions
    where payment_id = p_payment_id
      and lower(coalesce(status,'')) = 'available'
    order by id
    for update
  loop
    if d.investor_id is null then
      raise exception 'Distribution % has no investor owner', d.id;
    end if;

    v_credit := round(
      coalesce(d.principal_amount,0)
      + coalesce(d.interest_amount,0)
      + coalesce(d.late_fee_share,0),
      2
    );

    if v_credit < 0 then
      raise exception 'Distribution % has an invalid negative wallet credit', d.id;
    end if;

    if v_credit > 0 then
      insert into public.investor_wallets(user_id, available_balance, invested_balance, updated_at)
      values(d.investor_id, v_credit, 0, now())
      on conflict(user_id) do update set
        available_balance = coalesce(public.investor_wallets.available_balance,0) + excluded.available_balance,
        updated_at = now();

      select id into v_app_id
      from public.loan_applications
      where loan_number = d.loan_id
      limit 1;

      insert into public.wallet_transactions(
        user_id, transaction_type, amount, loan_id, status, description,
        investment_id, idempotency_key
      ) values (
        d.investor_id,
        'repayment_distribution',
        v_credit,
        v_app_id,
        'completed',
        'Borrower repayment distribution for Loan #' || d.loan_id || ' · ' || coalesce(d.certificate_number,'certificate'),
        d.investment_id,
        'repayment-distribution-' || d.id::text
      )
      on conflict(idempotency_key) where idempotency_key is not null do nothing
      returning id into v_tx;
    else
      v_tx := null;
    end if;

    update public.investor_distributions
    set status = 'paid',
        wallet_transaction_id = coalesce(v_tx, wallet_transaction_id),
        paid_at = coalesce(paid_at, now()),
        released_at = coalesce(released_at, now())
    where id = d.id;

    v_total := v_total + v_credit;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'distribution_count', v_count,
    'wallet_credited', round(v_total,2)
  );
end;
$$;

create or replace function public.finalize_borrower_repayment_v1(
  p_loan_number bigint,
  p_schedule_id uuid,
  p_amount numeric,
  p_processor_transaction_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_loan public.loan_applications%rowtype;
  v_payment public.borrower_payments%rowtype;
  v_preflight jsonb;
  v_settlement jsonb;
  v_credit jsonb;
  v_tx text := nullif(btrim(coalesce(p_processor_transaction_id,'')),'');
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Positive repayment amount required'; end if;
  if v_tx is null then raise exception 'Processor transaction ID required'; end if;

  select * into v_loan
  from public.loan_applications
  where loan_number = p_loan_number
    and user_id = v_user
  limit 1;
  if not found then raise exception 'Borrower loan % not found for signed-in user', p_loan_number; end if;

  v_preflight := public.borrower_repayment_preflight_v1(p_loan_number, p_schedule_id, p_amount);
  if coalesce((v_preflight->>'allowed')::boolean, false) is not true then
    raise exception '%', coalesce(v_preflight->>'reason','Repayment is not currently allowed.');
  end if;

  select * into v_payment
  from public.borrower_payments
  where processor_transaction_id = v_tx
  limit 1;

  if found then
    if v_payment.borrower_user_id is distinct from v_user or v_payment.loan_number <> p_loan_number then
      raise exception 'Processor transaction ID is already attached to another repayment';
    end if;

    if lower(coalesce(v_payment.status,'')) <> 'settled' then
      v_settlement := public.settle_borrower_payment_v5(v_payment.id);
    else
      v_settlement := jsonb_build_object('ok',true,'duplicate',true,'payment_id',v_payment.id);
    end if;
    v_credit := public.credit_available_distributions_v2(v_payment.id);

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'payment_id', v_payment.id,
      'settlement', v_settlement,
      'distribution_credit', v_credit
    );
  end if;

  insert into public.borrower_payments(
    loan_number, borrower_user_id, schedule_id, processor,
    processor_transaction_id, idempotency_key, amount, status, raw_reference
  ) values (
    p_loan_number, v_user, p_schedule_id, 'nmi',
    v_tx, 'nmi-repayment-' || v_tx, p_amount, 'processing',
    jsonb_build_object('source','finalize_borrower_repayment_v1','processor_transaction_id',v_tx)
  ) returning * into v_payment;

  v_settlement := public.settle_borrower_payment_v5(v_payment.id);
  v_credit := public.credit_available_distributions_v2(v_payment.id);

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'payment_id', v_payment.id,
    'settlement', v_settlement,
    'distribution_credit', v_credit
  );
end;
$$;

-- Schedule generation is permitted only after the borrower disbursement is released.
create or replace function public.generate_payment_schedule_v4(
  p_loan_number bigint,
  p_first_due date default ((current_date + interval '1 month'))::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  l record;
  fd public.loan_funding_disbursements%rowtype;
  r numeric;
  pmt numeric;
  bal numeric;
  ip numeric;
  pp numeric;
  i integer;
  due date;
begin
  select
    coalesce(approved_loan_amount, loan_amount) as loan_amount,
    coalesce(borrower_interest_rate, 10) as rate,
    coalesce(repayment_term_months, 12) as months
  into l
  from public.loan_applications
  where loan_number = p_loan_number;

  if not found then raise exception 'Loan % not found', p_loan_number; end if;
  if coalesce(l.loan_amount,0) <= 0 then raise exception 'Loan % has no valid principal amount', p_loan_number; end if;

  select * into fd
  from public.loan_funding_disbursements
  where loan_number = p_loan_number
  limit 1;

  if not found or lower(coalesce(fd.status,'')) <> 'released' or fd.released_at is null then
    raise exception 'Repayment schedule cannot be generated until Loan % funding is released', p_loan_number;
  end if;

  if coalesce(fd.sold_amount,0) + 0.009 < coalesce(fd.funding_goal,0)
     or coalesce(fd.protected_amount,0) > 0.009 then
    raise exception 'Repayment schedule cannot be generated until Loan % funding is fully cleared', p_loan_number;
  end if;

  if exists(select 1 from public.borrower_payments where loan_number=p_loan_number) then
    raise exception 'Loan % already has borrower payment history; schedule regeneration is blocked', p_loan_number;
  end if;

  delete from public.loan_payment_schedule where loan_number = p_loan_number;

  r := l.rate / 100 / 12;
  bal := l.loan_amount;
  pmt := case when r = 0 then bal / l.months else bal * r / (1 - power(1 + r, -l.months)) end;
  due := p_first_due;

  for i in 1..l.months loop
    ip := round(bal * r, 2);
    pp := case when i = l.months then bal else least(round(pmt - ip, 2), bal) end;

    insert into public.loan_payment_schedule(
      loan_number, installment_number, due_date, expected_principal, expected_interest, status
    ) values (
      p_loan_number, i, due, pp, ip, 'upcoming'
    );

    bal := greatest(bal - pp, 0);
    due := (due + interval '1 month')::date;
  end loop;

  return l.months;
end;
$$;

create or replace function public.auto_generate_payment_schedule_when_funded_v4()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.loan_number is not null
     and exists(
       select 1
       from public.loan_funding_disbursements fd
       where fd.loan_number = new.loan_number
         and lower(coalesce(fd.status,'')) = 'released'
         and fd.released_at is not null
         and coalesce(fd.sold_amount,0) + 0.009 >= coalesce(fd.funding_goal,0)
         and coalesce(fd.protected_amount,0) <= 0.009
     )
     and not exists(
       select 1 from public.loan_payment_schedule lps
       where lps.loan_number = new.loan_number
     ) then
    perform public.generate_payment_schedule_v4(new.loan_number);
  end if;
  return new;
end;
$$;

-- Clean only premature schedules that have never received a borrower payment.
-- Existing payment history is preserved for later audit rather than silently deleted.
delete from public.loan_payment_schedule s
where not exists (
  select 1 from public.borrower_payments bp
  where bp.loan_number = s.loan_number
)
and not exists (
  select 1 from public.loan_funding_disbursements fd
  where fd.loan_number = s.loan_number
    and lower(coalesce(fd.status,'')) = 'released'
    and fd.released_at is not null
);

revoke all on function public.borrower_repayment_preflight_v1(bigint,uuid,numeric) from public;
revoke all on function public.credit_available_distributions_v2(uuid) from public;
revoke all on function public.finalize_borrower_repayment_v1(bigint,uuid,numeric,text) from public;
grant execute on function public.borrower_repayment_preflight_v1(bigint,uuid,numeric) to authenticated;
grant execute on function public.finalize_borrower_repayment_v1(bigint,uuid,numeric,text) to authenticated;

notify pgrst, 'reload schema';
commit;
