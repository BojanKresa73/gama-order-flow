-- Drop the existing policy
DROP POLICY IF EXISTS "wo_update_all" ON public.work_orders;

-- Create updated policy that allows admin/admin_plus to update invoiced_at and invoice_number on closed orders
CREATE POLICY "wo_update_all"
ON public.work_orders
FOR UPDATE
USING (
  current_user_is_active() 
  AND (deleted_at IS NULL) 
  AND (
    (current_user_role() = 'superuser'::app_role)
    OR (current_user_role() = 'admin_plus'::app_role)
    OR ((current_user_role() = 'admin'::app_role) AND (status = 'open'::work_order_status OR status = 'closed'::work_order_status))
    OR ((current_user_role() = 'operator'::app_role) AND (status = 'open'::work_order_status))
    OR ((current_user_role() = 'operator_ctp'::app_role) AND (status = 'open'::work_order_status))
  )
)
WITH CHECK (
  current_user_is_active() 
  AND (
    (current_user_role() = 'superuser'::app_role)
    OR (current_user_role() = 'admin_plus'::app_role)
    OR ((current_user_role() = 'admin'::app_role) AND (status = 'open'::work_order_status OR status = 'closed'::work_order_status))
    OR (current_user_role() = 'operator'::app_role)
    OR ((current_user_role() = 'operator_ctp'::app_role) AND (status = 'closed'::work_order_status) AND (closed_by = auth.uid()) AND (closed_at IS NOT NULL))
  )
);