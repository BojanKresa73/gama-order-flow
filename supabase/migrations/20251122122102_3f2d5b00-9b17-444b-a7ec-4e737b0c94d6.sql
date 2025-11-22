-- Update RLS policies for work_orders to handle soft delete and invalidation

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "wo_select" ON public.work_orders;
DROP POLICY IF EXISTS "wo_update" ON public.work_orders;
DROP POLICY IF EXISTS "wo_delete" ON public.work_orders;
DROP POLICY IF EXISTS "wo_insert" ON public.work_orders;

-- SELECT: All active users can see non-deleted orders
CREATE POLICY "wo_select_all_visible"
ON public.work_orders
FOR SELECT
USING (
  current_user_is_active() 
  AND deleted_at IS NULL
);

-- INSERT: Active users with proper roles can create orders
CREATE POLICY "wo_insert"
ON public.work_orders
FOR INSERT
WITH CHECK (
  current_user_is_active() 
  AND (current_user_role() = ANY (ARRAY['superuser'::app_role, 'admin'::app_role, 'operator'::app_role]))
);

-- UPDATE: Allow updates based on role and order status
-- Superuser/admin can update anything (including invalidation)
-- Operators can update open orders only
CREATE POLICY "wo_update_all"
ON public.work_orders
FOR UPDATE
USING (
  current_user_is_active()
  AND deleted_at IS NULL
  AND (
    -- Superuser and admin can update anything
    (current_user_role() = ANY (ARRAY['superuser'::app_role, 'admin'::app_role]))
    OR
    -- Operators can update open orders
    ((current_user_role() = 'operator'::app_role) AND (status = 'open'::work_order_status))
    OR
    -- CTP operators can update and close their own closed orders
    ((current_user_role() = 'operator_ctp'::app_role) AND (status = 'open'::work_order_status))
  )
)
WITH CHECK (
  current_user_is_active()
  AND (
    -- Superuser and admin can make any changes
    (current_user_role() = ANY (ARRAY['superuser'::app_role, 'admin'::app_role]))
    OR
    -- Operators can update
    (current_user_role() = 'operator'::app_role)
    OR
    -- CTP operators can close orders they created
    ((current_user_role() = 'operator_ctp'::app_role) AND (status = 'closed'::work_order_status) AND (closed_by = auth.uid()) AND (closed_at IS NOT NULL))
  )
);

-- DELETE (soft delete): Only superuser can delete
CREATE POLICY "wo_delete"
ON public.work_orders
FOR DELETE
USING (
  current_user_role() = 'superuser'::app_role
);