
-- Fix: allow operator_ctp to update open work orders (e.g. setting machine_id)
-- The USING clause already allows it, but WITH CHECK was too restrictive
DROP POLICY "wo_update_all" ON public.work_orders;

CREATE POLICY "wo_update_all" ON public.work_orders
FOR UPDATE
USING (
  current_user_is_active() AND deleted_at IS NULL AND (
    current_user_role() = 'superuser'::app_role
    OR current_user_role() = 'admin_plus'::app_role
    OR (current_user_role() = 'admin'::app_role AND (status = 'open'::work_order_status OR status = 'closed'::work_order_status))
    OR (current_user_role() = 'operator'::app_role AND status = 'open'::work_order_status)
    OR (current_user_role() = 'operator_ctp'::app_role AND status = 'open'::work_order_status)
  )
)
WITH CHECK (
  current_user_is_active() AND (
    current_user_role() = 'superuser'::app_role
    OR current_user_role() = 'admin_plus'::app_role
    OR (current_user_role() = 'admin'::app_role AND (status = 'open'::work_order_status OR status = 'closed'::work_order_status))
    OR (current_user_role() = 'operator'::app_role AND status = 'open'::work_order_status)
    OR (current_user_role() = 'operator_ctp'::app_role AND status = 'open'::work_order_status)
  )
);
