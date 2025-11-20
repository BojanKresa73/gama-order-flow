-- Add work_order_number column to delivery_notes
ALTER TABLE public.delivery_notes
ADD COLUMN IF NOT EXISTS work_order_number text;

-- Update existing records to use work order number instead of delivery number
UPDATE public.delivery_notes dn
SET 
  delivery_number = wo.order_number,
  work_order_number = wo.order_number
FROM public.work_orders wo
WHERE dn.work_order_id = wo.id;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_delivery_notes_work_order_number 
ON public.delivery_notes(work_order_number);