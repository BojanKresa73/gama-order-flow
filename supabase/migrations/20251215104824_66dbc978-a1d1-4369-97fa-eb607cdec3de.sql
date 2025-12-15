-- Drop existing UPDATE policy on file_entries
DROP POLICY IF EXISTS fe_update ON public.file_entries;

-- Create new UPDATE policy that includes operator_ctp role
CREATE POLICY fe_update ON public.file_entries
  FOR UPDATE
  USING (current_user_role() = ANY (ARRAY['superuser'::app_role, 'admin'::app_role, 'operator'::app_role, 'operator_ctp'::app_role]));