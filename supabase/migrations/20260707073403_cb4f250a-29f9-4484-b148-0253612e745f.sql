
-- Wrap helper calls in scalar subqueries so Postgres evaluates them once (InitPlan)
-- instead of once per row. This is the standard Supabase RLS perf fix.

DROP POLICY IF EXISTS wo_select_all_visible ON public.work_orders;
CREATE POLICY wo_select_all_visible ON public.work_orders
FOR SELECT
USING (
  (SELECT public.current_user_is_active())
  AND deleted_at IS NULL
  AND (
    (SELECT public.current_user_role()) = ANY (ARRAY['superuser'::app_role,'admin_plus'::app_role,'admin'::app_role,'operator'::app_role,'operator_ctp'::app_role])
    OR ((SELECT public.current_user_role()) = 'client_user'::app_role AND client_id = (SELECT public.current_user_client_id()))
    OR created_by = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS wo_update_all ON public.work_orders;
CREATE POLICY wo_update_all ON public.work_orders
FOR UPDATE
USING (
  (SELECT public.current_user_is_active())
  AND deleted_at IS NULL
  AND (
    (SELECT public.current_user_role()) = 'superuser'::app_role
    OR (SELECT public.current_user_role()) = 'admin_plus'::app_role
    OR ((SELECT public.current_user_role()) = 'admin'::app_role AND (status = 'open'::work_order_status OR status = 'closed'::work_order_status))
    OR ((SELECT public.current_user_role()) = 'operator'::app_role AND status = 'open'::work_order_status)
    OR ((SELECT public.current_user_role()) = 'operator_ctp'::app_role AND status = 'open'::work_order_status)
  )
);

DROP POLICY IF EXISTS wo_delete ON public.work_orders;
CREATE POLICY wo_delete ON public.work_orders
FOR DELETE
USING ((SELECT public.current_user_role()) = 'superuser'::app_role);

-- Index to accelerate the most common list query:
-- WHERE deleted_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_work_orders_created_at_desc_active
  ON public.work_orders (created_at DESC)
  WHERE deleted_at IS NULL;

-- Helps the created_by branch of the SELECT policy
CREATE INDEX IF NOT EXISTS idx_work_orders_created_by
  ON public.work_orders (created_by)
  WHERE deleted_at IS NULL;

-- Status + deleted_at filters used by dashboard queries
CREATE INDEX IF NOT EXISTS idx_work_orders_status_active
  ON public.work_orders (status, created_at DESC)
  WHERE deleted_at IS NULL AND invalidated_at IS NULL;
