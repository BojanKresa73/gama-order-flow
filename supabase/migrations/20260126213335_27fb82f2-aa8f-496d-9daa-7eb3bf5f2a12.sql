-- Fix RLS on client_portal_users: avoid recursive role checks by using security definer has_role()

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_portal_users'
      AND policyname = 'Admins can manage client portal users'
  ) THEN
    EXECUTE 'DROP POLICY "Admins can manage client portal users" ON public.client_portal_users';
  END IF;
END $$;

CREATE POLICY "Admins can manage client portal users"
ON public.client_portal_users
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'superuser'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_plus'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'superuser'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_plus'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
