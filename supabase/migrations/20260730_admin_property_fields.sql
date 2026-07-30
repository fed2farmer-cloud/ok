alter table public.loan_applications
  add column if not exists city text,
  add column if not exists zip_code text;

notify pgrst, 'reload schema';
