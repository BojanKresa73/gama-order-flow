-- Add UPDATE policy for plate_formats
CREATE POLICY "Admins and superusers can update plate formats" 
ON public.plate_formats 
FOR UPDATE 
USING (has_any_role(ARRAY['admin'::app_role, 'superuser'::app_role]));