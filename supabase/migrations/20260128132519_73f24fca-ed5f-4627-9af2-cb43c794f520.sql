
-- Drop existing client portal SELECT policy and recreate with better logic
DROP POLICY IF EXISTS "Client portal users can view their client work orders" ON public.work_orders;

-- Update the main select policy to include client_user role
DROP POLICY IF EXISTS "wo_select_all_visible" ON public.work_orders;

CREATE POLICY "wo_select_all_visible" ON public.work_orders
FOR SELECT USING (
  current_user_is_active() 
  AND deleted_at IS NULL 
  AND (
    -- Internal users with roles can see all
    current_user_role() IN ('superuser', 'admin_plus', 'admin', 'operator', 'operator_ctp')
    -- Client portal users can see only their client's orders
    OR (current_user_role() = 'client_user' AND client_id = current_user_client_id())
    -- Fallback for order creators
    OR created_by = auth.uid()
  )
);
