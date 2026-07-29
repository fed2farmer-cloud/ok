begin;

-- Borrowers can read counteroffers addressed to them.
drop policy if exists "Borrowers view own counteroffers" on public.loan_counteroffers;
create policy "Borrowers view own counteroffers"
  on public.loan_counteroffers
  for select
  to authenticated
  using (borrower_user_id = auth.uid());

-- Secure, atomic borrower response used by the Messages page.
create or replace function public.respond_to_loan_counteroffer(
  p_counteroffer_id bigint,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.loan_counteroffers%rowtype;
  v_now timestamptz := now();
  v_response_text text;
begin
  select *
    into v_offer
  from public.loan_counteroffers
  where id = p_counteroffer_id
  for update;

  if not found then
    raise exception 'Counteroffer was not found.';
  end if;

  if v_offer.borrower_user_id is distinct from auth.uid() then
    raise exception 'You are not authorized to respond to this counteroffer.';
  end if;

  if v_offer.status <> 'pending' then
    raise exception 'This counteroffer has already been answered.';
  end if;

  update public.loan_counteroffers
  set
    status = case when p_accept then 'accepted' else 'declined' end,
    accepted_at = case when p_accept then v_now else null end,
    declined_at = case when p_accept then null else v_now end,
    updated_at = v_now
  where id = v_offer.id;

  if p_accept then
    update public.loan_applications
    set
      approved_loan_amount = v_offer.proposed_loan_amount,
      loan_amount = v_offer.proposed_loan_amount,
      amount_remaining = greatest(
        v_offer.proposed_loan_amount - coalesce(amount_funded, 0),
        0
      ),
      counteroffer_status = 'accepted',
      counteroffer_responded_at = v_now,
      status = 'Counteroffer Accepted',
      published_to_marketplace = false
    where id = v_offer.loan_application_id
      and user_id = auth.uid();

    v_response_text :=
      'Borrower accepted the revised loan offer of ' ||
      to_char(v_offer.proposed_loan_amount, 'FM$999,999,999,990.00') || '.';
  else
    update public.loan_applications
    set
      counteroffer_status = 'declined',
      counteroffer_responded_at = v_now,
      status = 'Counteroffer Declined',
      published_to_marketplace = false
    where id = v_offer.loan_application_id
      and user_id = auth.uid();

    v_response_text :=
      'Borrower declined the revised loan offer of ' ||
      to_char(v_offer.proposed_loan_amount, 'FM$999,999,999,990.00') || '.';
  end if;

  if not found then
    raise exception 'The matching borrower loan application was not found.';
  end if;

  if v_offer.created_by is not null then
    insert into public.messages (
      sender_id,
      recipient_id,
      sender_role,
      loan_application_id,
      body,
      read
    ) values (
      auth.uid(),
      v_offer.created_by,
      'borrower',
      v_offer.loan_application_id,
      v_response_text,
      false
    );
  end if;

  insert into public.borrower_notifications (
    user_id,
    loan_application_id,
    title,
    message,
    notification_type,
    metadata
  ) values (
    auth.uid(),
    v_offer.loan_application_id,
    case when p_accept then 'Revised offer accepted' else 'Revised offer declined' end,
    v_response_text,
    case when p_accept then 'counteroffer_accepted' else 'counteroffer_declined' end,
    jsonb_build_object(
      'counteroffer_id', v_offer.id,
      'proposed_amount', v_offer.proposed_loan_amount
    )
  );
end;
$$;

revoke all on function public.respond_to_loan_counteroffer(bigint, boolean) from public;
grant execute on function public.respond_to_loan_counteroffer(bigint, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
