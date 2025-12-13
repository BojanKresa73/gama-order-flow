-- Drop and recreate the UPDATE policy to include operator_ctp
DROP POLICY IF EXISTS "Users can update their assigned items" ON work_order_checklist_items;

CREATE POLICY "Users can update their assigned items" 
ON work_order_checklist_items 
FOR UPDATE 
USING (
  (assignee_user_id = auth.uid()) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'operator'::app_role)
  OR has_role(auth.uid(), 'operator_ctp'::app_role)
  OR has_role(auth.uid(), 'superuser'::app_role)
);