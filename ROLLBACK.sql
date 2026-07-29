-- Removes only the four-argument compatibility wrapper.
-- The original two-argument function is not changed or removed.
drop function if exists public.respond_to_loan_counteroffer(
  boolean,
  text,
  bigint,
  text
);

notify pgrst, 'reload schema';
