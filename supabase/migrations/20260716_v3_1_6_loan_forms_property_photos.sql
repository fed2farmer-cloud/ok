-- SecuredLanding v3.1.6
-- Repairs borrower access to generated forms and property-photo uploads.

-- Backfill promissory notes for every approved/funded loan.
insert into public.generated_loan_documents (
  loan_application_id, borrower_user_id, document_type, title, status, terms_snapshot, updated_at
)
select la.id, la.user_id, 'promissory_note', 'Secured Promissory Note', 'ready_for_review',
  jsonb_build_object(
    'loan_number', coalesce(la.loan_number, la.id),
    'borrower_name', coalesce(la.full_name, ''),
    'business_name', coalesce(la.business_name, ''),
    'property_address', coalesce(la.property_address, ''),
    'apn', coalesce(la.apn, ''), 'county', coalesce(la.county, ''),
    'state', coalesce(la.state, ''), 'approved_loan_amount', coalesce(la.loan_amount,0),
    'borrower_interest_rate', coalesce(la.borrower_interest_rate,10),
    'investor_interest_rate', coalesce(la.investor_interest_rate,9),
    'repayment_term_months', coalesce(la.repayment_term_months,36),
    'monthly_payment', case when coalesce(la.loan_amount,0)=0 then 0
      when coalesce(la.borrower_interest_rate,0)=0 then coalesce(la.loan_amount,0)/greatest(coalesce(la.repayment_term_months,36),1)
      else (coalesce(la.loan_amount,0)*(coalesce(la.borrower_interest_rate,10)/100.0/12.0)) /
        (1-power(1+(coalesce(la.borrower_interest_rate,10)/100.0/12.0),-greatest(coalesce(la.repayment_term_months,36),1))) end,
    'generated_at', now()), now()
from public.loan_applications la
where lower(coalesce(la.status,'')) in ('approved','funded')
  and la.user_id is not null
on conflict (loan_application_id, document_type) do nothing;

-- Property photo table access: owner of the related loan or an administrator.
alter table public.property_photos enable row level security;
drop policy if exists "Owners insert property photos" on public.property_photos;
drop policy if exists "Owners read their property photos" on public.property_photos;
drop policy if exists "Owners delete own property photos" on public.property_photos;
create policy "Borrowers insert property photos" on public.property_photos
for insert to authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.loan_applications la
    where la.id = property_photos.loan_application_id and la.user_id = auth.uid()
  )
);
create policy "Borrowers read property photos" on public.property_photos
for select to authenticated using (
  user_id = auth.uid() or public.is_secured_landing_admin()
);
create policy "Borrowers delete property photos" on public.property_photos
for delete to authenticated using (
  user_id = auth.uid() or public.is_secured_landing_admin()
);

-- Private storage bucket and object policies.
insert into storage.buckets (id, name, public)
values ('property-photos','property-photos',false)
on conflict (id) do update set public=false;

drop policy if exists "Borrowers upload property photos" on storage.objects;
drop policy if exists "Borrowers read property photo files" on storage.objects;
drop policy if exists "Borrowers delete property photo files" on storage.objects;
create policy "Borrowers upload property photos" on storage.objects
for insert to authenticated with check (
  bucket_id='property-photos' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy "Borrowers read property photo files" on storage.objects
for select to authenticated using (
  bucket_id='property-photos' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_secured_landing_admin())
);
create policy "Borrowers delete property photo files" on storage.objects
for delete to authenticated using (
  bucket_id='property-photos' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_secured_landing_admin())
);
