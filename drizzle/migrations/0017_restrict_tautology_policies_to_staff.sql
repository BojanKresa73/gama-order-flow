DO $$
DECLARE r record; staff text := '(auth.uid() IS NOT NULL AND NOT public.is_client_portal_user() AND public.current_user_is_active())';
BEGIN
FOR r IN SELECT * FROM (VALUES
 ('system_maintenance_log','Authenticated can read maintenance log'),
 ('quote_expiry_notifications','Authenticated can read expiry notifications'),
 ('quick_calc_pasted_counters','Auth read pasted counters'),
 ('vacation_settings','read settings'),
 ('vacation_holidays','read holidays'),
 ('client_contacts','cc_select_authenticated'),
 ('quick_calc_quote_counters','Auth read counters'),
 ('plate_usage_stats','Authenticated users can view stats')) v(t,p) LOOP
  EXECUTE format('ALTER POLICY %I ON public.%I USING %s', r.p, r.t, staff);
END LOOP;
EXECUTE format('ALTER POLICY "Auth write pasted counters" ON public.quick_calc_pasted_counters USING %s WITH CHECK %s', staff, staff);
EXECUTE format('ALTER POLICY "Auth write counters" ON public.quick_calc_quote_counters USING %s WITH CHECK %s', staff, staff);
EXECUTE format('ALTER POLICY "Authenticated users can upload PDFs" ON storage.objects WITH CHECK (bucket_id = %L AND owner_id = (select auth.uid()::text) AND NOT public.is_client_portal_user())', 'email-archive');
EXECUTE format('ALTER POLICY "Authenticated users can read email archive PDFs" ON storage.objects USING (bucket_id = %L AND auth.uid() IS NOT NULL AND NOT public.is_client_portal_user() AND public.current_user_is_active())', 'email-archive');
END $$;