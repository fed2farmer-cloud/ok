-- INTENTIONAL TEST DATA RESET. REVIEW BEFORE RUNNING. This does NOT delete auth users/admin users/configuration.
begin;
create table if not exists public.v4_reset_archive as select now() archived_at, jsonb_build_object('loan_applications',(select count(*) from public.loan_applications),'investments',(select count(*) from public.investments),'marketplace_loans',(select count(*) from public.marketplace_loans)) counts;
truncate table public.secondary_market_trades,public.secondary_market_listings,public.investor_distributions,public.payment_allocations,public.borrower_payments,public.loan_payment_schedule,public.investor_positions,public.financial_exceptions,public.loan_notices,public.loan_servicing_events restart identity cascade;
-- Existing legacy loan data: child tables first. Uncomment only after archive/export if desired.
-- truncate table public.investments, public.marketplace_loans, public.loan_counteroffers, public.closing_tasks, public.generated_loan_documents, public.loan_closings, public.loan_timeline_events, public.borrower_notifications, public.loan_documents, public.loan_applications restart identity cascade;
-- update public.investor_wallets set available_balance=0, invested_balance=0, interest_earned=0, principal_returned=0, lifetime_earned=0;
commit;