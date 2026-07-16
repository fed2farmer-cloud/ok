-- SecuredLanding v3.1.7
-- Fixes borrower property-photo inserts, adds Loan Forms navigation,
-- and removes California-only wording from non-California loan forms.

-- The storage upload already succeeds; the failing step is the property_photos
-- database insert. Replace every insert policy with one unambiguous owner rule.
alter table public.property_photos enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public'
      and tablename = 'property_photos'
      and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on public.property_photos', p.policyname);
  end loop;
end $$;

create policy "Authenticated borrowers add their property photos"
on public.property_photos
for insert
to authenticated
with check (auth.uid() = user_id);

-- Keep borrower read/delete access clear and independent of custom helper functions.
drop policy if exists "Borrowers read property photos" on public.property_photos;
drop policy if exists "Borrowers delete property photos" on public.property_photos;
create policy "Borrowers read property photos"
on public.property_photos for select to authenticated
using (auth.uid() = user_id or public.is_secured_landing_admin());
create policy "Borrowers delete property photos"
on public.property_photos for delete to authenticated
using (auth.uid() = user_id or public.is_secured_landing_admin());

-- Ensure the bucket remains private and the owner folder convention is accepted.
insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', false)
on conflict (id) do update set public = false;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd = 'INSERT'
      and policyname ilike '%property photo%'
  loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "Borrowers upload property photo objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'property-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Correct existing generated titles so Missouri and other states do not display
-- California-specific closing language.
update public.generated_loan_documents
set title = concat(
  coalesce(nullif(terms_snapshot->>'state', ''), 'State'),
  ' Security Instrument — Attorney Review Required'
)
where document_type = 'deed_of_trust';
