-- SecuredLanding v4.5.9 verification (read-only)
-- Run AFTER 20260914_v4_5_9_closing_sync_manual_notary.sql.

-- 1) Loan #460109 should show both document/signature tasks complete because
--    all six required generated documents are already signed.
select
  la.loan_number,
  ct.task_key,
  ct.title,
  ct.status,
  ct.completed_at
from public.loan_applications la
join public.closing_tasks ct on ct.loan_application_id = la.id
where la.loan_number = 460109
  and ct.task_key in ('loan_documents','signatures','online_notary','county_recording','investor_funding','disbursement')
order by ct.sort_order;

-- 2) Confirm required document signature totals.
select
  la.loan_number,
  count(*) filter (where coalesce(g.signature_required, true)) as required_documents,
  count(*) filter (
    where coalesce(g.signature_required, true)
      and (g.signed_at is not null or lower(coalesce(g.signature_status,'')) = 'signed')
  ) as signed_documents
from public.loan_applications la
join public.generated_loan_documents g on g.loan_application_id = la.id
where la.loan_number = 460109
group by la.loan_number;

-- 3) Manual notarization state (row appears after admin starts the manual flow).
select
  la.loan_number,
  p.manual_mode,
  p.manual_status,
  p.manual_scheduled_at,
  p.manual_completed_at,
  p.manual_document_name,
  p.manual_document_path
from public.loan_applications la
left join public.proof_notary_transactions p on p.loan_application_id = la.id
where la.loan_number = 460109;

-- 4) Critical separation check: completing online_notary must NOT automatically
--    complete county_recording.
select
  la.loan_number,
  max(ct.status) filter (where ct.task_key = 'online_notary') as online_notary_status,
  max(ct.status) filter (where ct.task_key = 'county_recording') as county_recording_status
from public.loan_applications la
join public.closing_tasks ct on ct.loan_application_id = la.id
where la.loan_number = 460109
group by la.loan_number;
