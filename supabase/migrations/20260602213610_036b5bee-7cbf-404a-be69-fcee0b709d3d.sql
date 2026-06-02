-- 1) clients: restrict client_user to own client
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients
FOR SELECT
USING (
  current_user_is_active() AND (
    current_user_role() = ANY (ARRAY['superuser'::app_role,'admin_plus'::app_role,'admin'::app_role,'operator'::app_role,'operator_ctp'::app_role])
    OR (current_user_role() = 'client_user'::app_role AND id = current_user_client_id())
  )
);

-- 2) delivery_notes: scope client_user to own client
DROP POLICY IF EXISTS "dn_select" ON public.delivery_notes;
CREATE POLICY "dn_select" ON public.delivery_notes
FOR SELECT
USING (
  current_user_is_active() AND (
    current_user_role() = ANY (ARRAY['superuser'::app_role,'admin_plus'::app_role,'admin'::app_role,'operator'::app_role,'operator_ctp'::app_role])
    OR (
      current_user_role() = 'client_user'::app_role
      AND EXISTS (
        SELECT 1 FROM public.work_orders wo
        WHERE wo.id = delivery_notes.work_order_id
          AND wo.client_id = current_user_client_id()
      )
    )
  )
);

-- 3) email_jobs: insert/update only by internal staff (edge functions use service_role and bypass RLS)
DROP POLICY IF EXISTS "System can insert email jobs" ON public.email_jobs;
DROP POLICY IF EXISTS "System can update email jobs" ON public.email_jobs;
CREATE POLICY "Internal staff can insert email jobs" ON public.email_jobs
FOR INSERT
WITH CHECK (has_any_role(ARRAY['superuser'::app_role,'admin_plus'::app_role,'admin'::app_role,'operator'::app_role,'operator_ctp'::app_role]));
CREATE POLICY "Internal staff can update email jobs" ON public.email_jobs
FOR UPDATE
USING (has_any_role(ARRAY['superuser'::app_role,'admin_plus'::app_role,'admin'::app_role,'operator'::app_role,'operator_ctp'::app_role]));

-- 4) email_log: insert only by internal staff
DROP POLICY IF EXISTS "System can insert email log" ON public.email_log;
CREATE POLICY "Internal staff can insert email log" ON public.email_log
FOR INSERT
WITH CHECK (has_any_role(ARRAY['superuser'::app_role,'admin_plus'::app_role,'admin'::app_role,'operator'::app_role,'operator_ctp'::app_role]));

-- 5) Trigger: prevent client_user from changing anything except priority on work_orders
CREATE OR REPLACE FUNCTION public.fn_restrict_client_user_wo_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user_role() = 'client_user'::app_role THEN
    -- Only allow priority + updated_at changes; reject any other column change
    IF NEW.client_id        IS DISTINCT FROM OLD.client_id
       OR NEW.status        IS DISTINCT FROM OLD.status
       OR NEW.notes         IS DISTINCT FROM OLD.notes
       OR NEW.job_name      IS DISTINCT FROM OLD.job_name
       OR NEW.kind          IS DISTINCT FROM OLD.kind
       OR NEW.order_type    IS DISTINCT FROM OLD.order_type
       OR NEW.deleted_at    IS DISTINCT FROM OLD.deleted_at
       OR NEW.invalidated_at IS DISTINCT FROM OLD.invalidated_at
       OR NEW.closed_at     IS DISTINCT FROM OLD.closed_at
       OR NEW.closed_by     IS DISTINCT FROM OLD.closed_by
       OR NEW.created_by    IS DISTINCT FROM OLD.created_by
       OR NEW.display_order_number IS DISTINCT FROM OLD.display_order_number
       OR NEW.order_number  IS DISTINCT FROM OLD.order_number
    THEN
      RAISE EXCEPTION 'Portalni korisnici mogu menjati samo prioritet naloga';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_client_user_wo_update ON public.work_orders;
CREATE TRIGGER trg_restrict_client_user_wo_update
BEFORE UPDATE ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_restrict_client_user_wo_update();

-- 6) Storage: tighten ctp-reports and delivery-notes buckets
DROP POLICY IF EXISTS "Anyone can view reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload reports" ON storage.objects;
CREATE POLICY "Internal staff can view ctp reports" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'ctp-reports'
  AND has_any_role(ARRAY['superuser'::app_role,'admin_plus'::app_role,'admin'::app_role,'operator'::app_role,'operator_ctp'::app_role])
);
CREATE POLICY "Internal staff can upload ctp reports" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'ctp-reports'
  AND has_any_role(ARRAY['superuser'::app_role,'admin_plus'::app_role,'admin'::app_role,'operator'::app_role,'operator_ctp'::app_role])
);

DROP POLICY IF EXISTS "Authenticated users can view delivery notes" ON storage.objects;
DROP POLICY IF EXISTS "System can insert delivery notes" ON storage.objects;
CREATE POLICY "Internal staff can view delivery notes" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'delivery-notes'
  AND has_any_role(ARRAY['superuser'::app_role,'admin_plus'::app_role,'admin'::app_role,'operator'::app_role,'operator_ctp'::app_role])
);
CREATE POLICY "Internal staff can insert delivery notes" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'delivery-notes'
  AND has_any_role(ARRAY['superuser'::app_role,'admin_plus'::app_role,'admin'::app_role,'operator'::app_role,'operator_ctp'::app_role])
);
