CREATE OR REPLACE FUNCTION public.get_plate_usage_last_12_months()
RETURNS TABLE(month_start date, plates bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', (now() AT TIME ZONE 'Europe/Belgrade')) - interval '11 months',
      date_trunc('month', (now() AT TIME ZONE 'Europe/Belgrade')),
      interval '1 month'
    )::date AS m
  )
  SELECT months.m AS month_start,
         COALESCE(SUM(fe.quantity), 0)::bigint AS plates
  FROM months
  LEFT JOIN work_orders wo
    ON wo.order_type = 'ctp'
   AND wo.deleted_at IS NULL
   AND wo.invalidated_at IS NULL
   AND date_trunc('month', (wo.created_at AT TIME ZONE 'Europe/Belgrade'))::date = months.m
  LEFT JOIN file_entries fe ON fe.work_order_id = wo.id
  GROUP BY months.m
  ORDER BY months.m;
$$;

REVOKE EXECUTE ON FUNCTION public.get_plate_usage_last_12_months() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_plate_usage_last_12_months() TO authenticated;