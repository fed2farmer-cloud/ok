-- SecuredLanding v3.3.2
-- Compatibility overload for the borrower counteroffer response RPC.
--
-- Existing database signature:
--   respond_to_loan_counteroffer(p_counteroffer_id bigint, p_accept boolean)
--
-- Current frontend signature:
--   respond_to_loan_counteroffer(
--     p_accept boolean,
--     p_agreement_version text,
--     p_counteroffer_id bigint,
--     p_user_agent text
--   )
--
-- This keeps the existing two-argument implementation unchanged and adds
-- a four-argument wrapper that PostgREST can resolve from the frontend call.

begin;

create or replace function public.respond_to_loan_counteroffer(
  p_accept boolean,
  p_agreement_version text,
  p_counteroffer_id bigint,
  p_user_agent text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- The existing two-argument function remains the source of truth for
  -- authorization, ownership checks and acceptance/rejection processing.
  perform public.respond_to_loan_counteroffer(
    p_counteroffer_id,
    p_accept
  );

  return jsonb_build_object(
    'success', true,
    'counteroffer_id', p_counteroffer_id,
    'accepted', p_accept,
    'agreement_version', p_agreement_version,
    'user_agent_recorded', p_user_agent is not null
  );
end;
$$;

revoke all on function public.respond_to_loan_counteroffer(
  boolean,
  text,
  bigint,
  text
) from public;

grant execute on function public.respond_to_loan_counteroffer(
  boolean,
  text,
  bigint,
  text
) to authenticated;

notify pgrst, 'reload schema';

commit;
