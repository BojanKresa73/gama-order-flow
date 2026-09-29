CREATE OR REPLACE FUNCTION public.get_portal_monthly_stats(p_year integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cid AS (SELECT public.current_user_client_id() AS id),
  wo AS (
    SELECT w.id, w.order_type,
           date_trunc('month', (w.created_at AT TIME ZONE 'Europe/Belgrade'))::date AS m
    FROM public.work_orders w, cid
    WHERE cid.id IS NOT NULL
      AND w.client_id = cid.id
      AND w.deleted_at IS NULL
      AND w.invalidated_at IS NULL
      AND (w.created_at AT TIME ZONE 'Europe/Belgrade') >= make_date(p_year - 1, 1, 1)
      AND (w.created_at AT TIME ZONE 'Europe/Belgrade') < make_date(p_year + 1, 1, 1)
  ),
  plates AS (
    SELECT wo.m, COALESCE(SUM(f.quantity), 0)::bigint AS plates
    FROM wo JOIN public.file_entries f ON f.work_order_id = wo.id
    WHERE wo.order_type = 'ctp'
    GROUP BY wo.m
  ),
  orders AS (
    SELECT m, COUNT(*)::bigint AS orders,
           COUNT(*) FILTER (WHERE order_type = 'ctp')::bigint AS ctp_orders
    FROM wo GROUP BY m
  ),
  months AS (
    SELECT generate_series(make_date(p_year - 1, 1, 1), make_date(p_year, 12, 1), interval '1 month')::date AS m
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'month', months.m,
    'plates', COALESCE(plates.plates, 0),
    'orders', COALESCE(orders.orders, 0),
    'ctp_orders', COALESCE(orders.ctp_orders, 0)
  ) ORDER BY months.m), '[]'::jsonb)
  FROM months
  LEFT JOIN plates ON plates.m = months.m
  LEFT JOIN orders ON orders.m = months.m;
$$;

REVOKE ALL ON FUNCTION public.get_portal_monthly_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_portal_monthly_stats(integer) TO authenticated, service_role;