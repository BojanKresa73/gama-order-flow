-- Add constraint to ensure client_id exists before closing a work order
-- This provides database-level validation in addition to application-level checks
ALTER TABLE public.work_orders
  ADD CONSTRAINT chk_wo_client_required_on_close 
  CHECK (status <> 'closed' OR client_id IS NOT NULL);

COMMENT ON CONSTRAINT chk_wo_client_required_on_close ON public.work_orders 
  IS 'Ensures that a work order cannot be closed without having a client assigned';