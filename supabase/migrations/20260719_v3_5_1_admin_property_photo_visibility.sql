-- SecuredLanding v3.5.1
-- Makes pending property-photo records reliably visible to authorized admins.

alter table public.property_photos
  add column if not exists review_status text not null default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists admin_notes text,
  add column if not exists is_cover boolean not null default false;

update public.property_photos
set review_status = 'pending'
where review_status is null or btrim(review_status) = '';

create index if not exists property_photos_review_status_idx
  on public.property_photos (review_status);

-- Explicit admin table policies. These remain useful for direct updates from
-- the dashboard and for future reporting screens.
drop policy if exists "Admins can view property photos" on public.property_photos;
create policy "Admins can view property photos"
on public.property_photos
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
  )
);

drop policy if exists "Admins can review property photos" on public.property_photos;
create policy "Admins can review property photos"
on public.property_photos
for update
to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
  )
);

-- Reliable admin queue reader. SECURITY DEFINER bypasses conflicting legacy
-- borrower-only policies, while the internal admin check prevents non-admin use.
create or replace function public.admin_list_property_photos()
returns table (
  id uuid,
  loan_application_id text,
  user_id uuid,
  storage_path text,
  caption text,
  is_cover boolean,
  review_status text,
  admin_notes text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  ) then
    raise exception 'Admin access required';
  end if;

  return query
  select
    p.id,
    p.loan_application_id::text,
    p.user_id,
    p.storage_path,
    p.caption,
    coalesce(p.is_cover, false),
    coalesce(nullif(btrim(p.review_status), ''), 'pending'),
    p.admin_notes,
    p.created_at
  from public.property_photos p
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_property_photos() from public;
grant execute on function public.admin_list_property_photos() to authenticated;

-- Admins must also be able to read private photo objects to create signed URLs.
drop policy if exists "Admins can view property photo files" on storage.objects;
create policy "Admins can view property photo files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'property-photos'
  and exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
  )
);
