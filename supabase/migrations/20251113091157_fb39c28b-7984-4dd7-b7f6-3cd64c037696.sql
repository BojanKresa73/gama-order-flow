-- Drop the overly permissive SELECT policy on delivery_notes
DROP POLICY IF EXISTS "Authenticated users can view delivery notes" ON public.delivery_notes;

-- Create restricted policy for viewing delivery notes
CREATE POLICY "Only admins and operators can view delivery notes"
ON public.delivery_notes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'operator'::app_role)
);