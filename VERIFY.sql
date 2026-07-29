select
  i.id,
  i.certificate_number,
  i.certificate_uuid,
  i.original_investor_id,
  i.current_owner_id,
  i.transfer_count,
  i.transfer_locked
from public.investments i
order by i.created_at desc
limit 20;

select
  h.certificate_number,
  h.transfer_type,
  h.to_owner_id,
  h.principal_transferred,
  h.transfer_status,
  h.transferred_at
from public.investment_ownership_history h
order by h.transferred_at desc
limit 20;
