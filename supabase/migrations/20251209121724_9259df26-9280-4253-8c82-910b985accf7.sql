-- Add invoicing fields to work_orders table
ALTER TABLE public.work_orders 
ADD COLUMN invoiced_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN invoice_number TEXT DEFAULT NULL;

-- Add index for efficient filtering by invoice status
CREATE INDEX idx_work_orders_invoiced_at ON public.work_orders (invoiced_at) WHERE invoiced_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.work_orders.invoiced_at IS 'Timestamp when the order was marked as invoiced';
COMMENT ON COLUMN public.work_orders.invoice_number IS 'Invoice number/reference for this work order';