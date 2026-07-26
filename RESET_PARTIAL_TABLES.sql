-- Run ONLY if the main migration reports that document_signature_requests
-- still has UUID ID columns. This removes signature-only tables; it does not
-- delete loans, generated loan documents, users, investments, or payments.

drop table if exists public.document_signatures cascade;
drop table if exists public.signature_audit_events cascade;
drop table if exists public.document_signature_requests cascade;

notify pgrst, 'reload schema';
