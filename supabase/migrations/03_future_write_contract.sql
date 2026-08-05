-- Optional hardening step.
-- DO NOT run the NOT NULL line until 02_verify_relationships.sql shows zero unresolved rows.

-- Add FK safely if it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'investments_loan_application_id_fkey'
      AND conrelid = 'public.investments'::regclass
  ) THEN
    ALTER TABLE public.investments
      ADD CONSTRAINT investments_loan_application_id_fkey
      FOREIGN KEY (loan_application_id)
      REFERENCES public.loan_applications(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

-- Validate existing populated values.
ALTER TABLE public.investments
  VALIDATE CONSTRAINT investments_loan_application_id_fkey;

-- ONLY AFTER every investment has been reviewed/resolved:
-- ALTER TABLE public.investments ALTER COLUMN loan_application_id SET NOT NULL;

-- Application rule going forward:
-- INSERT INTO investments (..., loan_application_id, ...)
-- must receive loan_applications.id directly.
-- Do not store marketplace_loans.id or loan_number in loan_application_id.
