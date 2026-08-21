CREATE OR REPLACE FUNCTION public.get_orders_by_type()
 RETURNS TABLE(order_type text, count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT order_type, COUNT(*) as count
  FROM public.work_orders
  WHERE deleted_at IS NULL AND invalidated_at IS NULL
  GROUP BY order_type;
$function$;

CREATE OR REPLACE FUNCTION public.get_monthly_plate_usage(p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'total', COALESCE(SUM(fe.quantity), 0),
      'closed', COALESCE(SUM(CASE WHEN wo.status = 'closed' THEN fe.quantity ELSE 0 END), 0),
      'open', COALESCE(SUM(CASE WHEN wo.status != 'closed' THEN fe.quantity ELSE 0 END), 0)
    ),
    'formats', COALESCE((
      SELECT jsonb_agg(row_to_json(fmt) ORDER BY fmt.value DESC)
      FROM (
        SELECT 
          COALESCE(pf.format_name, 'Nepoznat') as name,
          SUM(fe2.quantity)::int as value
        FROM file_entries fe2
        INNER JOIN work_orders wo2 ON wo2.id = fe2.work_order_id
        LEFT JOIN plate_formats pf ON pf.id = fe2.plate_format_id
        WHERE wo2.order_type = 'ctp'
          AND wo2.deleted_at IS NULL
          AND wo2.invalidated_at IS NULL
          AND wo2.created_at >= p_start
          AND wo2.created_at <= p_end
        GROUP BY pf.format_name
      ) fmt
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM file_entries fe
  INNER JOIN work_orders wo ON wo.id = fe.work_order_id
  WHERE wo.order_type = 'ctp'
    AND wo.deleted_at IS NULL
    AND wo.invalidated_at IS NULL
    AND wo.created_at >= p_start
    AND wo.created_at <= p_end;

  RETURN v_result;
END;
$function$;