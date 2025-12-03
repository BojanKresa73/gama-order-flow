-- Add DELETE policy for plate_formats
CREATE POLICY "Admins can delete plate formats" 
ON public.plate_formats 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));