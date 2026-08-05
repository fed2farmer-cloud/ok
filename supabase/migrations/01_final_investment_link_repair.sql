-- Secured Landing: investment -> loan application relationship repair
-- Run in Supabase SQL Editor as postgres.
-- Purpose: populate investments.loan_application_id only when the relationship is unambiguous.

BEGIN;

-- 1) Ensure canonical relationship column exists.
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS loan_application_id bigint;

-- 2) Direct legacy application-id matches.
-- Only use loan_id as an application id when there is NOT also a marketplace row
-- with the same numeric id pointing somewhere else.
UPDATE public.investments i
SET loan_application_id = la.id
FROM public.loan_applications la
WHERE i.loan_application_id IS NULL
  AND i.loan_id = la.id
  AND NOT EXISTS (
    SELECT 1
    FROM public.marketplace_loans ml
    WHERE ml.id = i.loan_id
      AND ml.loan_application_id IS DISTINCT FROM la.id
  );

-- 3) Marketplace-id matches.
UPDATE public.investments i
SET loan_application_id = ml.loan_application_id
FROM public.marketplace_loans ml
WHERE i.loan_application_id IS NULL
  AND i.loan_id = ml.id
  AND ml.loan_application_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.loan_applications la
    WHERE la.id = ml.loan_application_id
  );

-- 4) Legacy loan-number matches, but only where exactly one application matches.
WITH unique_numbers AS (
  SELECT loan_number, MIN(id) AS application_id
  FROM public.loan_applications
  WHERE loan_number IS NOT NULL
  GROUP BY loan_number
  HAVING COUNT(*) = 1
)
UPDATE public.investments i
SET loan_application_id = u.application_id
FROM unique_numbers u
WHERE i.loan_application_id IS NULL
  AND i.loan_id::text = u.loan_number::text;

COMMIT;

-- Verification summary.
SELECT
  COUNT(*) AS total_investments,
  COUNT(loan_application_id) AS resolved,
  COUNT(*) FILTER (WHERE loan_application_id IS NULL) AS unresolved
FROM public.investments;

-- Remaining rows requiring review. This intentionally does NOT guess.
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
    WHEN i.loan_id IS NULL OR i.loan_id = 0 THEN 'ORPHAN / LEGACY VALUE'
    WHEN la_direct.id IS NOT NULL AND ml.id IS NOT NULL
         AND la_direct.id IS DISTINCT FROM ml.loan_application_id
      THEN 'AMBIGUOUS - MANUAL REVIEW'
    WHEN la_direct.id IS NOT NULL THEN 'DIRECT APPLICATION MATCH AVAILABLE'
    WHEN ml.loan_application_id IS NOT NULL THEN 'MARKETPLACE MATCH AVAILABLE'
    ELSE 'ORPHAN / LEGACY VALUE'
  END AS migration_status
FROM public.investments i
LEFT JOIN public.loan_applications la_direct ON la_direct.id = i.loan_id
LEFT JOIN public.marketplace_loans ml ON ml.id = i.loan_id
LEFT JOIN public.loan_applications la_market ON la_market.id = ml.loan_application_id
WHERE i.loan_application_id IS NULL
ORDER BY i.id DESC;
