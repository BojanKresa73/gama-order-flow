-- Allow authenticated users to insert plate formats
CREATE POLICY "Authenticated users can create formats" 
ON public.plate_formats 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);