-- Drop and recreate RLS policies for work_orders to include admin_plus role

-- SELECT policy
DROP POLICY IF EXISTS "wo_select_all_visible" ON public.work_orders;
CREATE POLICY "wo_select_all_visible" ON public.work_orders
FOR SELECT USING (
  current_user_is_active() 
  AND deleted_at IS NULL 
  AND (
    current_user_role() = ANY (ARRAY['superuser'::app_role, 'admin_plus'::app_role, 'admin'::app_role, 'operator'::app_role, 'operator_ctp'::app_role])
    OR created_by = auth.uid()
  )
);

-- INSERT policy
DROP POLICY IF EXISTS "wo_insert" ON public.work_orders;
CREATE POLICY "wo_insert" ON public.work_orders
FOR INSERT WITH CHECK (
  current_user_is_active() 
  AND current_user_role() = ANY (ARRAY['superuser'::app_role, 'admin_plus'::app_role, 'admin'::app_role, 'operator'::app_role])
);

-- UPDATE policy
DROP POLICY IF EXISTS "wo_update_all" ON public.work_orders;
CREATE POLICY "wo_update_all" ON public.work_orders
FOR UPDATE 
USING (
  current_user_is_active() 
  AND deleted_at IS NULL 
  AND (
    current_user_role() = 'superuser'::app_role
    OR (current_user_role() = 'admin_plus'::app_role AND status = 'open'::work_order_status)
    OR (current_user_role() = 'admin'::app_role AND status = 'open'::work_order_status)
    OR (current_user_role() = 'operator'::app_role AND status = 'open'::work_order_status)
    OR (current_user_role() = 'operator_ctp'::app_role AND status = 'open'::work_order_status)
  )
)
WITH CHECK (current_user_is_active());