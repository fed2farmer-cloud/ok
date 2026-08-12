-- SecuredLanding v4.1.2
-- Admin-only servicing detail RPC. Non-destructive.
-- Fixes admin UI detail reads when table RLS hides servicing rows from direct PostgREST selects.

begin;

create or replace function public.admin_servicing_loan_detail_v4(p_loan_number bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  ) then
    raise exception 'Admin access required';
  end if;

  return jsonb_build_object(
    'loan_number', p_loan_number,
    'schedule', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.installment_number)
      from (
        select id, loan_number, installment_number, due_date,
               expected_principal, expected_interest, expected_total,
               collected_principal, collected_interest, status, paid_at, created_at
        from public.loan_payment_schedule
        where loan_number = p_loan_number
      ) s
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at desc)
      from (
        select id, payment_number, loan_number, schedule_id, amount, status,
               processor, processor_transaction_id, idempotency_key, created_at, settled_at
        from public.borrower_payments
        where loan_number = p_loan_number
        order by created_at desc
        limit 100
      ) p
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.admin_servicing_loan_detail_v4(bigint) to authenticated;

commit;
