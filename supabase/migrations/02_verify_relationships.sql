-- Read-only verification after running 01_final_investment_link_repair.sql
SELECT
  i.id AS investment_id,
  i.loan_id AS legacy_loan_id,
  i.loan_application_id,
  la.loan_number,
  i.investor_id,
  i.amount,
  i.status,
  CASE
    WHEN i.loan_application_id IS NULL THEN 'UNRESOLVED'
    WHEN la.id IS NULL THEN 'BROKEN APPLICATION LINK'
    ELSE 'CORRECT LINK'
  END AS link_status
FROM public.investments i
LEFT JOIN public.loan_applications la
  ON la.id = i.loan_application_id
ORDER BY i.id DESC;

SELECT
  CASE
    WHEN i.loan_application_id IS NULL THEN 'UNRESOLVED'
    WHEN la.id IS NULL THEN 'BROKEN APPLICATION LINK'
    ELSE 'CORRECT LINK'
  END AS link_status,
  COUNT(*) AS rows
FROM public.investments i
LEFT JOIN public.loan_applications la
  ON la.id = i.loan_application_id
GROUP BY 1
ORDER BY 1;
