-- Add CASCADE to foreign key relationships for work_orders
ALTER TABLE public.work_order_items
  DROP CONSTRAINT IF EXISTS work_order_items_work_order_id_fkey,
  ADD CONSTRAINT work_order_items_work_order_id_fkey
  FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
  ON DELETE CASCADE;

ALTER TABLE public.delivery_notes
  DROP CONSTRAINT IF EXISTS delivery_notes_work_order_id_fkey,
  ADD CONSTRAINT delivery_notes_work_order_id_fkey
  FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
  ON DELETE CASCADE;

ALTER TABLE public.email_outbox
  DROP CONSTRAINT IF EXISTS email_outbox_work_order_id_fkey,
  ADD CONSTRAINT email_outbox_work_order_id_fkey
  FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
  ON DELETE CASCADE;

ALTER TABLE public.digital_jobs
  DROP CONSTRAINT IF EXISTS digital_jobs_work_order_id_fkey,
  ADD CONSTRAINT digital_jobs_work_order_id_fkey
  FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
  ON DELETE CASCADE;

ALTER TABLE public.film_jobs
  DROP CONSTRAINT IF EXISTS film_jobs_work_order_id_fkey,
  ADD CONSTRAINT film_jobs_work_order_id_fkey
  FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
  ON DELETE CASCADE;

ALTER TABLE public.file_entries
  DROP CONSTRAINT IF EXISTS file_entries_work_order_id_fkey,
  ADD CONSTRAINT file_entries_work_order_id_fkey
  FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
  ON DELETE CASCADE;

ALTER TABLE public.work_order_events
  DROP CONSTRAINT IF EXISTS work_order_events_work_order_id_fkey,
  ADD CONSTRAINT work_order_events_work_order_id_fkey
  FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
  ON DELETE CASCADE;

ALTER TABLE public.email_jobs
  DROP CONSTRAINT IF EXISTS email_jobs_work_order_id_fkey,
  ADD CONSTRAINT email_jobs_work_order_id_fkey
  FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
  ON DELETE CASCADE;

ALTER TABLE public.email_log
  DROP CONSTRAINT IF EXISTS email_log_work_order_id_fkey,
  ADD CONSTRAINT email_log_work_order_id_fkey
  FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
  ON DELETE CASCADE;

ALTER TABLE public.work_order_checklists
  DROP CONSTRAINT IF EXISTS work_order_checklists_work_order_id_fkey,
  ADD CONSTRAINT work_order_checklists_work_order_id_fkey
  FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
  ON DELETE CASCADE;

ALTER TABLE public.inventory_history
  DROP CONSTRAINT IF EXISTS inventory_history_work_order_id_fkey,
  ADD CONSTRAINT inventory_history_work_order_id_fkey
  FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
  ON DELETE CASCADE;

-- Create helper function to check if user is superuser
CREATE OR REPLACE FUNCTION public.is_superuser(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_uid AND role = 'superuser'
  );
$$;