-- Drop existing SELECT policy that restricts operators
DROP POLICY IF EXISTS "clients_select" ON public.clients;

-- Create new SELECT policy - all authenticated users can view clients
CREATE POLICY "clients_select" ON public.clients
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Drop and recreate UPDATE policy - all authenticated users can update clients
DROP POLICY IF EXISTS "Owners and admins can update clients" ON public.clients;
CREATE POLICY "Authenticated users can update clients" ON public.clients
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Keep DELETE restricted to admin only (already exists)
-- Keep INSERT as is (already allows all authenticated users)