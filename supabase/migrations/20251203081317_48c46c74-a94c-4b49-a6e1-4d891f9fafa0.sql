-- Drop old policy and create one that allows both admin and superuser
DROP POLICY IF EXISTS "Admins can delete plate formats" ON public.plate_formats;

CREATE POLICY "Admins and superusers can delete plate formats" 
ON public.plate_formats 
FOR DELETE 
USING (has_any_role(ARRAY['admin'::app_role, 'superuser'::app_role]));