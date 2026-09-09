-- SecuredLanding - FINAL live-compatible investor protection synchronization
-- 2026-09-09
--
-- Safe to rerun on the live schema observed on 2026-09-09.
-- This intentionally does NOT reference funding_holds or the v3.5 financial
-- ledger tables because those objects are not present in the live Supabase DB.

begin;

alter table public.investments
  add column if not exists protection_expires_at timestamptz,
  add column if not exists activated_at timestamptz;

-- Repair legacy protection rows that are missing deadline values.
update public.investments
set
  refund_deadline = coalesce(
    refund_deadline,
    created_at + (
      greatest(coalesce(refund_period_days, 7), 0) * interval '1 day'
    )
  ),
  protection_expires_at = coalesce(
    protection_expires_at,
    refund_deadline,
    created_at + (
      greatest(coalesce(refund_period_days, 7), 0) * interval '1 day'
    )
  ),
  updated_at = now()
where lower(coalesce(status, '')) = 'protection_period'
  and (refund_deadline is null or protection_expires_at is null);

-- One-time repair: activate any protection periods that are already expired.
update public.investments
set
  status = 'active',
  activated_at = coalesce(activated_at, now()),
  settled_at = coalesce(settled_at, now()),
  updated_at = now()
where lower(coalesce(status, '')) = 'protection_period'
  and coalesce(
    protection_expires_at,
    refund_deadline,
    created_at + (
      greatest(coalesce(refund_period_days, 7), 0) * interval '1 day'
    )
  ) <= now();

-- Signed-in investors can settle only their own legitimately expired records.
create or replace function public.settle_my_expired_investments_v1()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  update public.investments
  set
    status = 'active',
    activated_at = coalesce(activated_at, now()),
    settled_at = coalesce(settled_at, now()),
    updated_at = now()
  where lower(coalesce(status, '')) = 'protection_period'
    and coalesce(current_owner_id, investor_id) = v_user
    and coalesce(
      protection_expires_at,
      refund_deadline,
      created_at + (
        greatest(coalesce(refund_period_days, 7), 0) * interval '1 day'
      )
    ) <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.settle_my_expired_investments_v1() from public;
grant execute on function public.settle_my_expired_investments_v1() to authenticated;

notify pgrst, 'reload schema';
commit;
