-- Allow authenticated users to insert clients
DROP POLICY IF EXISTS "Admins can manage clients" ON public.clients;

-- Separate policies for different operations
CREATE POLICY "Authenticated users can create clients" ON public.clients 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update clients" ON public.clients 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete clients" ON public.clients 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));