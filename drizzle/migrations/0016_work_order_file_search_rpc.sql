CREATE INDEX IF NOT EXISTS idx_work_orders_notes_trgm ON public.work_orders USING gin (notes gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_work_order_ids(p_needle text, p_include_notes boolean DEFAULT false)
RETURNS SETOF uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pat text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_is_active() OR public.is_client_portal_user() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_needle IS NULL OR length(trim(p_needle)) = 0 THEN RETURN; END IF;
  v_pat := '%' || replace(replace(replace(trim(p_needle), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  RETURN QUERY
  SELECT DISTINCT w.id FROM public.work_orders w
  WHERE w.deleted_at IS NULL AND w.id IN (
    SELECT work_order_id FROM public.file_entries WHERE filename ILIKE v_pat
    UNION SELECT work_order_id FROM public.film_jobs WHERE file_name ILIKE v_pat
    UNION SELECT work_order_id FROM public.digital_jobs WHERE file_name ILIKE v_pat
    UNION SELECT id FROM public.work_orders WHERE p_include_notes AND notes ILIKE v_pat
  );
END $$;

REVOKE ALL ON FUNCTION public.search_work_order_ids(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_work_order_ids(text, boolean) TO authenticated;