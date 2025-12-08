-- Fix profiles table RLS (PUBLIC_USER_DATA issue)
-- Drop existing overly permissive policies on profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create strict SELECT policy: own profile OR admin/superuser
CREATE POLICY "Users can view own profile or admins all"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR has_role(auth.uid(), 'superuser'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix clients table RLS (EXPOSED_SENSITIVE_DATA issue)
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;

-- Create strict SELECT policy: owner OR admin/superuser
CREATE POLICY "Users can view own clients or admins all"
ON public.clients
FOR SELECT
USING (
  owner_user_id = auth.uid() 
  OR has_role(auth.uid(), 'superuser'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update INSERT policy to auto-set owner_user_id if not provided
DROP POLICY IF EXISTS "Authenticated users can create clients" ON public.clients;

CREATE POLICY "Authenticated users can create clients"
ON public.clients
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (owner_user_id IS NULL OR owner_user_id = auth.uid())
);

-- Also update the UPDATE policy to allow owners to update their own clients
DROP POLICY IF EXISTS "Admins can update clients" ON public.clients;

CREATE POLICY "Owners and admins can update clients"
ON public.clients
FOR UPDATE
USING (
  owner_user_id = auth.uid() 
  OR has_role(auth.uid(), 'superuser'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);