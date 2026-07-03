DROP POLICY IF EXISTS "Admins can view all quotes" ON public.quick_calc_quotes;

CREATE POLICY "Superuser can view all quotes"
  ON public.quick_calc_quotes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superuser'::app_role));