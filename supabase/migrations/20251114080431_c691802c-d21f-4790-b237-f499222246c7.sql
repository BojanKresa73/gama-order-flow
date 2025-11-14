-- Add order_index column to digital_jobs table for drag & drop reordering
ALTER TABLE public.digital_jobs 
ADD COLUMN order_index INTEGER DEFAULT 0;

-- Add index for better query performance
CREATE INDEX idx_digital_jobs_order ON public.digital_jobs(work_order_id, order_index);