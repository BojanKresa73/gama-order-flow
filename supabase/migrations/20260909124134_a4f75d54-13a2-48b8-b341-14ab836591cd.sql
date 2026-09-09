CREATE TABLE IF NOT EXISTS public.ctp_monthly_report_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  period date NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  recipients text[] NOT NULL DEFAULT '{}',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, period)
);

GRANT SELECT ON public.ctp_monthly_report_log TO authenticated;
GRANT ALL ON public.ctp_monthly_report_log TO service_role;

ALTER TABLE public.ctp_monthly_report_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superuser can view ctp monthly report log"
ON public.ctp_monthly_report_log FOR SELECT TO authenticated
USING (public.is_superuser(auth.uid()));

CREATE TRIGGER update_ctp_monthly_report_log_updated_at
BEFORE UPDATE ON public.ctp_monthly_report_log
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_client_ctp_monthly(p_client_id uuid, p_year integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH entries AS (
    SELECT
      date_trunc('month', (w.created_at AT TIME ZONE 'Europe/Belgrade'))::date AS m,
      COALESCE(pf.format_name, 'Nepoznat format') AS format_name,
      COALESCE(f.quantity, 0) AS qty
    FROM public.work_orders w
    JOIN public.file_entries f ON f.work_order_id = w.id
    LEFT JOIN public.plate_formats pf ON pf.id = f.plate_format_id
    WHERE w.client_id = p_client_id
      AND w.order_type = 'ctp'
      AND w.deleted_at IS NULL
      AND w.invalidated_at IS NULL
      AND (w.created_at AT TIME ZONE 'Europe/Belgrade') >= make_date(p_year, 1, 1)
      AND (w.created_at AT TIME ZONE 'Europe/Belgrade') < make_date(p_year + 1, 1, 1)
  ),
  by_month AS (
    SELECT m, SUM(qty)::bigint AS plates FROM entries GROUP BY m
  ),
  by_month_format AS (
    SELECT m, format_name, SUM(qty)::bigint AS plates FROM entries GROUP BY m, format_name
  )
  SELECT jsonb_build_object(
    'year', p_year,
    'total_plates', COALESCE((SELECT SUM(plates) FROM by_month), 0),
    'months', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', m, 'plates', plates) ORDER BY m) FROM by_month
    ), '[]'::jsonb),
    'formats', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', m, 'format_name', format_name, 'plates', plates) ORDER BY m, format_name)
      FROM by_month_format
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_client_ctp_monthly(uuid, integer) TO authenticated, service_role;