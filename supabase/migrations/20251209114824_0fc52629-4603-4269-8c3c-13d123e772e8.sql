-- Fix wo_update_all policy to allow closing orders
-- The issue: WITH CHECK prevents setting status to 'closed' for admin/operator roles
-- Solution: Remove status check from WITH CHECK clause since it's already validated in USING

DROP POLICY IF EXISTS "wo_update_all" ON public.work_orders;

CREATE POLICY "wo_update_all"
ON public.work_orders
FOR UPDATE
USING (
  current_user_is_active() 
  AND deleted_at IS NULL 
  AND (
    current_user_role() = 'superuser'
    OR (current_user_role() = 'admin' AND status = 'open')
    OR (current_user_role() = 'operator' AND status = 'open')
    OR (current_user_role() = 'operator_ctp' AND status = 'open')
  )
)
WITH CHECK (
  current_user_is_active()
);