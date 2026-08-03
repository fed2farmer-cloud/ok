BEGIN;

ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS loan_application_id bigint;

CREATE INDEX IF NOT EXISTS idx_investments_loan_application_id
ON public.investments (loan_application_id);

UPDATE public.investments i
SET loan_application_id = la.id
FROM public.loan_applications la
WHERE i.loan_application_id IS NULL
  AND i.loan_id = la.id
  AND NOT EXISTS (
    SELECT 1 FROM public.marketplace_loans ml
    WHERE ml.id = i.loan_id AND ml.loan_application_id <> la.id
  );

UPDATE public.investments i
SET loan_application_id = ml.loan_application_id
FROM public.marketplace_loans ml
WHERE i.loan_application_id IS NULL
  AND i.loan_id = ml.id
  AND NOT EXISTS (
    SELECT 1 FROM public.loan_applications la
    WHERE la.id = i.loan_id
  );

UPDATE public.investments i
SET loan_application_id = la.id
FROM public.loan_applications la
JOIN public.marketplace_loans ml ON ml.id = la.id
WHERE i.loan_application_id IS NULL
  AND i.loan_id = la.id
  AND ml.loan_application_id = la.id;

DO $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conname = 'investments_loan_application_id_fkey'
 ) THEN
   ALTER TABLE public.investments
   ADD CONSTRAINT investments_loan_application_id_fkey
   FOREIGN KEY (loan_application_id)
   REFERENCES public.loan_applications(id)
   ON DELETE RESTRICT
   NOT VALID;
 END IF;
END $$;

COMMIT;

SELECT
 i.id AS investment_id,
 i.loan_id AS legacy_loan_id,
 i.loan_application_id,
 i.investor_id,
 i.amount,
 i.status,
 la_direct.loan_number AS direct_application_loan_number,
 ml.id AS possible_marketplace_id,
 ml.loan_application_id AS marketplace_application_id,
 la_market.loan_number AS marketplace_loan_number,
 CASE
   WHEN i.loan_application_id IS NOT NULL THEN 'RESOLVED'
   WHEN la_direct.id IS NOT NULL
     AND ml.id IS NOT NULL
     AND la_direct.id <> ml.loan_application_id
     THEN 'AMBIGUOUS - MANUAL REVIEW'
   WHEN i.loan_id IS NULL THEN 'NO LEGACY LOAN ID'
   ELSE 'ORPHAN / LEGACY VALUE'
 END AS migration_status
FROM public.investments i
LEFT JOIN public.loan_applications la_direct ON la_direct.id = i.loan_id
LEFT JOIN public.marketplace_loans ml ON ml.id = i.loan_id
LEFT JOIN public.loan_applications la_market ON la_market.id = ml.loan_application_id
ORDER BY i.id DESC;
