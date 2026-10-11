GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

-- Strict historical price: only a price valid on the order date counts; otherwise revenue 0 (reported separately)
CREATE OR REPLACE FUNCTION public.get_ctp_consumption_by_format(p_from text, p_to text, p_client_ids uuid[] DEFAULT NULL::uuid[], p_plate_format_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(format_name text, plates_consumed bigint, revenue_eur numeric, area_m2 numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH raw_data AS (
    SELECT pf.format_name AS fmt_name, pf.id AS plate_format_id,
      SUM(fe.quantity)::bigint AS plates_cnt,
      COALESCE(SUM(CASE
        WHEN c.has_mono_pricing = true AND fe.quantity = 1 AND cpp.price_eur_mono IS NOT NULL THEN cpp.price_eur_mono * fe.quantity
        WHEN cpp.price_eur IS NOT NULL THEN cpp.price_eur * fe.quantity
        ELSE 0 END), 0)::numeric AS rev_eur
    FROM work_orders wo
    JOIN file_entries fe ON fe.work_order_id = wo.id
    JOIN plate_formats pf ON pf.id = fe.plate_format_id
    JOIN clients c ON c.id = wo.client_id
    LEFT JOIN LATERAL (
      SELECT p.price_eur, p.price_eur_mono FROM client_plate_prices p
      WHERE p.client_id = wo.client_id AND p.plate_format_id = fe.plate_format_id
        AND p.valid_from <= wo.created_at::date
      ORDER BY p.valid_from DESC LIMIT 1
    ) cpp ON true
    WHERE wo.order_type = 'ctp' AND wo.deleted_at IS NULL AND wo.invalidated_at IS NULL
      AND fe.file_type = 'CTP'
      AND wo.created_at::date >= p_from::date AND wo.created_at::date <= p_to::date
      AND (p_client_ids IS NULL OR wo.client_id = ANY(p_client_ids))
      AND (p_plate_format_ids IS NULL OR fe.plate_format_id = ANY(p_plate_format_ids))
    GROUP BY pf.format_name, pf.id
  )
  SELECT rd.fmt_name, rd.plates_cnt, rd.rev_eur,
    (rd.plates_cnt *
      COALESCE(NULLIF(split_part(translate(rd.fmt_name, '×X', 'xx'), 'x', 1), '')::numeric, 0) *
      COALESCE(NULLIF(split_part(translate(rd.fmt_name, '×X', 'xx'), 'x', 2), '')::numeric, 0) / 1000000.0)::numeric
  FROM raw_data rd
  ORDER BY rd.plates_cnt DESC;
END;
$function$;

-- Plates without a valid historical price (for warnings)
CREATE OR REPLACE FUNCTION public.get_ctp_unpriced_plates(p_from date, p_to date)
 RETURNS TABLE(client_name text, format_name text, plates bigint, orders bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.name, pf.format_name, SUM(fe.quantity)::bigint, COUNT(DISTINCT wo.id)::bigint
  FROM work_orders wo
  JOIN file_entries fe ON fe.work_order_id = wo.id AND fe.file_type = 'CTP'
  JOIN plate_formats pf ON pf.id = fe.plate_format_id
  JOIN clients c ON c.id = wo.client_id
  WHERE public.has_admin_plus_access(auth.uid())
    AND wo.order_type = 'ctp' AND wo.deleted_at IS NULL AND wo.invalidated_at IS NULL
    AND wo.created_at::date BETWEEN p_from AND p_to
    AND NOT EXISTS (SELECT 1 FROM client_plate_prices p WHERE p.client_id = wo.client_id
      AND p.plate_format_id = fe.plate_format_id AND p.valid_from <= wo.created_at::date)
  GROUP BY c.name, pf.format_name ORDER BY 3 DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.get_ctp_unpriced_plates(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_ctp_unpriced_plates(date, date) TO authenticated;