-- SecuredLanding v4.6.0 - Admin Reopen Funding Window
-- Adds the same admin-only RPC already installed in production so the repository
-- remains reproducible across preview, staging, and future Supabase projects.

begin;

create or replace function public.reopen_loan_funding_v1(
  p_loan_number bigint,
  p_days integer default 45
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan public.loan_applications%rowtype;
  v_market public.marketplace_loans%rowtype;
  v_goal numeric := 0;
  v_committed numeric := 0;
  v_started timestamptz := now();
  v_deadline timestamptz;
begin
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'Funding window must be between 1 and 365 days';
  end if;

  -- Browser/PostgREST callers must be authenticated admins. Direct database or
  -- service-role execution has no auth.uid() and remains available for maintenance.
  if auth.uid() is not null and not exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  ) then
    raise exception 'Admin access required';
  end if;

  select la.*
  into v_loan
  from public.loan_applications la
  where la.loan_number = p_loan_number
     or la.id = p_loan_number
  order by case when la.loan_number = p_loan_number then 0 else 1 end
  limit 1
  for update;

  if v_loan.id is null then
    raise exception 'Loan reference % not found', p_loan_number;
  end if;

  select ml.*
  into v_market
  from public.marketplace_loans ml
  where ml.loan_application_id = v_loan.id
     or (v_loan.loan_number is not null and ml.loan_number = v_loan.loan_number)
  order by case when ml.loan_application_id = v_loan.id then 0 else 1 end
  limit 1
  for update;

  if v_market.id is null then
    raise exception 'Loan #% has no marketplace record to reopen', coalesce(v_loan.loan_number, v_loan.id);
  end if;

  if lower(coalesce(v_loan.status, '')) in ('denied', 'cancelled', 'canceled') then
    raise exception 'Loan #% cannot be reopened from status %', coalesce(v_loan.loan_number, v_loan.id), v_loan.status;
  end if;

  v_goal := coalesce(
    nullif(v_market.funding_goal, 0),
    nullif(v_market.loan_amount, 0),
    nullif(v_loan.approved_loan_amount, 0),
    nullif(v_loan.loan_amount, 0),
    nullif(v_loan.requested_loan_amount, 0),
    0
  );

  select coalesce(sum(i.amount), 0)
  into v_committed
  from public.investments i
  where (
      i.loan_application_id = v_loan.id
      or i.loan_id = v_loan.id
      or (v_loan.loan_number is not null and i.loan_id = v_loan.loan_number)
    )
    and lower(coalesce(i.status, 'active')) not in (
      'refunded', 'cancelled', 'canceled', 'failed', 'reversed', 'void', 'voided', 'rejected'
    );

  if v_goal <= 0 then
    raise exception 'Loan #% has no valid funding goal', coalesce(v_loan.loan_number, v_loan.id);
  end if;

  if v_committed >= v_goal - 0.009 then
    raise exception 'Loan #% is already fully funded', coalesce(v_loan.loan_number, v_loan.id);
  end if;

  v_deadline := v_started + make_interval(days => p_days);

  update public.loan_applications
  set
    status = 'Approved',
    published_to_marketplace = true,
    funding_started_at = v_started,
    funding_deadline = v_deadline,
    funding_window_days = p_days,
    funding_status = 'open'
  where id = v_loan.id;

  update public.marketplace_loans
  set
    status = 'Open',
    published = true,
    funding_started_at = v_started,
    funding_deadline = v_deadline,
    funding_window_days = p_days,
    funding_status = 'open',
    updated_at = now()
  where id = v_market.id;

  perform public.refresh_loan_funding_totals(coalesce(v_loan.loan_number, v_loan.id));

  return jsonb_build_object(
    'loan_number', coalesce(v_loan.loan_number, v_loan.id),
    'funding_goal', v_goal,
    'amount_funded', v_committed,
    'amount_remaining', greatest(v_goal - v_committed, 0),
    'funding_started_at', v_started,
    'funding_deadline', v_deadline,
    'funding_status', 'open'
  );
end;
$$;

revoke all on function public.reopen_loan_funding_v1(bigint, integer) from public;
grant execute on function public.reopen_loan_funding_v1(bigint, integer) to authenticated;

notify pgrst, 'reload schema';
commit;
