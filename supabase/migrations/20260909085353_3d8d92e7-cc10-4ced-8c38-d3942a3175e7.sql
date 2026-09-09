CREATE INDEX IF NOT EXISTS idx_work_orders_client_type ON public.work_orders (client_id, order_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_file_entries_work_order ON public.file_entries (work_order_id);

CREATE OR REPLACE FUNCTION public.get_client_stats(p_client_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ord AS (
    SELECT id, order_number, order_type, status, created_at, clicks_count
    FROM work_orders
    WHERE client_id = p_client_id AND deleted_at IS NULL
  ),
  agg AS (
    SELECT
      count(*)::int AS total_orders,
      count(*) FILTER (WHERE status = 'open')::int AS open_orders,
      count(*) FILTER (WHERE status = 'closed')::int AS closed_orders,
      COALESCE(sum(clicks_count) FILTER (
        WHERE order_type = 'digital'
          AND created_at >= date_trunc('year', now())
      ), 0)::bigint AS total_clicks_ytd
    FROM ord
  ),
  last_o AS (
    SELECT id, order_number, order_type, status, created_at, clicks_count
    FROM ord ORDER BY created_at DESC LIMIT 1
  ),
  fmt AS (
    SELECT COALESCE(pf.format_name, 'Unknown') AS format, sum(fe.quantity)::bigint AS count
    FROM file_entries fe
    JOIN work_orders wo ON wo.id = fe.work_order_id
    LEFT JOIN plate_formats pf ON pf.id = fe.plate_format_id
    WHERE wo.client_id = p_client_id AND wo.order_type = 'ctp' AND wo.deleted_at IS NULL
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 3
  )
  SELECT jsonb_build_object(
    'totalOrders', agg.total_orders,
    'openOrders', agg.open_orders,
    'closedOrders', agg.closed_orders,
    'totalClicksYTD', agg.total_clicks_ytd,
    'lastOrder', (SELECT to_jsonb(last_o) FROM last_o),
    'topFormats', COALESCE((SELECT jsonb_agg(jsonb_build_object('format', fmt.format, 'count', fmt.count)) FROM fmt), '[]'::jsonb)
  )
  FROM agg;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_stats(uuid) TO authenticated;