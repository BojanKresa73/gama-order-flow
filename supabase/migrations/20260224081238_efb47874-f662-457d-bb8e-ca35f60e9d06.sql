
CREATE OR REPLACE FUNCTION public.get_format_monthly_consumption()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT 
        fe.plate_format_id as format_id,
        date_trunc('month', wo.closed_at)::date::text as month,
        SUM(fe.quantity)::int as total
      FROM file_entries fe
      JOIN work_orders wo ON wo.id = fe.work_order_id
      WHERE wo.order_type = 'ctp'
        AND wo.status = 'closed'
        AND wo.deleted_at IS NULL
        AND wo.closed_at IS NOT NULL
        AND fe.quantity > 0
      GROUP BY fe.plate_format_id, date_trunc('month', wo.closed_at)
      ORDER BY date_trunc('month', wo.closed_at) DESC
    ) r
  ), '[]'::jsonb);
END;
$function$;
