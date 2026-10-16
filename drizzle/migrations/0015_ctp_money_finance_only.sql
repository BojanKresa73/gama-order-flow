CREATE OR REPLACE FUNCTION public.get_ctp_revenue(p_from text, p_to text, p_client_ids uuid[] DEFAULT NULL::uuid[], p_plate_format_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(total_revenue_eur numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_finance_access() THEN RETURN; END IF;
  RETURN QUERY
  SELECT COALESCE(SUM(
    CASE
      WHEN c.has_mono_pricing = true AND fe.quantity = 1 AND cpp.price_eur_mono IS NOT NULL THEN cpp.price_eur_mono * fe.quantity
      WHEN cpp.price_eur IS NOT NULL THEN cpp.price_eur * fe.quantity
      ELSE 0
    END), 0)::numeric AS total_revenue_eur
  FROM work_orders wo
  JOIN file_entries fe ON fe.work_order_id = wo.id
  JOIN clients c ON c.id = wo.client_id
  LEFT JOIN client_plate_prices cpp ON cpp.client_id = wo.client_id AND cpp.plate_format_id = fe.plate_format_id
  WHERE wo.order_type = 'ctp' AND wo.deleted_at IS NULL
    AND wo.created_at::date >= p_from::date AND wo.created_at::date <= p_to::date
    AND (p_client_ids IS NULL OR wo.client_id = ANY(p_client_ids))
    AND (p_plate_format_ids IS NULL OR fe.plate_format_id = ANY(p_plate_format_ids))
    AND fe.file_type = 'CTP';
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_ctp_cost(p_from text, p_to text, p_client_ids uuid[] DEFAULT NULL::uuid[], p_format_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(total_cost_eur numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_finance_access() THEN RETURN; END IF;
  RETURN QUERY
  WITH plates_used AS (
    SELECT fe.plate_format_id, SUM(fe.quantity) as plates_qty
    FROM file_entries fe JOIN work_orders wo ON wo.id = fe.work_order_id
    WHERE fe.file_type = 'CTP' AND wo.order_type = 'ctp'
      AND wo.created_at::date >= p_from::date AND wo.created_at::date <= p_to::date
      AND wo.deleted_at IS NULL
      AND (p_client_ids IS NULL OR wo.client_id = ANY(p_client_ids))
      AND (p_format_ids IS NULL OR fe.plate_format_id = ANY(p_format_ids))
    GROUP BY fe.plate_format_id
  ), format_costs AS (
    SELECT DISTINCT ON (poi.plate_format_id) poi.plate_format_id, poi.price_per_m2, poi.width_mm, poi.height_mm
    FROM procurement_order_items poi JOIN procurement_orders po ON po.id = poi.procurement_order_id
    WHERE po.actual_arrival_date IS NOT NULL
    ORDER BY poi.plate_format_id, po.actual_arrival_date DESC
  )
  SELECT COALESCE(SUM(pu.plates_qty * fc.width_mm * fc.height_mm * fc.price_per_m2 / 1000000.0), 0)::numeric as total_cost_eur
  FROM plates_used pu JOIN format_costs fc ON fc.plate_format_id = pu.plate_format_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_ctp_consumption_by_format(p_from text, p_to text, p_client_ids uuid[] DEFAULT NULL::uuid[], p_plate_format_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(format_name text, plates_consumed bigint, revenue_eur numeric, area_m2 numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE fin boolean := public.has_finance_access();
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
  SELECT rd.fmt_name, rd.plates_cnt, CASE WHEN fin THEN rd.rev_eur ELSE NULL END,
    (rd.plates_cnt *
      COALESCE(NULLIF(split_part(translate(rd.fmt_name, '×X', 'xx'), 'x', 1), '')::numeric, 0) *
      COALESCE(NULLIF(split_part(translate(rd.fmt_name, '×X', 'xx'), 'x', 2), '')::numeric, 0) / 1000000.0)::numeric
  FROM raw_data rd
  ORDER BY rd.plates_cnt DESC;
END;
$function$;