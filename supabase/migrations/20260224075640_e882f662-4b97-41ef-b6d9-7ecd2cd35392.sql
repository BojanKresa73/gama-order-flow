
-- RPC for CTP stats cards
CREATE OR REPLACE FUNCTION public.get_ctp_stats(
  p_from date,
  p_to date,
  p_client_ids uuid[] DEFAULT NULL,
  p_plate_format_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_plates', COALESCE(SUM(plates_qty), 0),
    'order_count', COUNT(DISTINCT work_order_id),
    'client_count', COUNT(DISTINCT client_id)
  )
  INTO v_result
  FROM v_ctp_items
  WHERE closed_on >= p_from
    AND closed_on <= p_to
    AND (p_client_ids IS NULL OR client_id = ANY(p_client_ids))
    AND (p_plate_format_ids IS NULL OR plate_format_id = ANY(p_plate_format_ids));

  RETURN v_result;
END;
$$;

-- RPC for CTP daily chart
CREATE OR REPLACE FUNCTION public.get_ctp_daily(
  p_from date,
  p_to date,
  p_client_ids uuid[] DEFAULT NULL,
  p_plate_format_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(d) ORDER BY d.closed_on)
    FROM (
      SELECT closed_on, SUM(plates_qty)::int as total_plates
      FROM v_ctp_items
      WHERE closed_on >= p_from
        AND closed_on <= p_to
        AND (p_client_ids IS NULL OR client_id = ANY(p_client_ids))
        AND (p_plate_format_ids IS NULL OR plate_format_id = ANY(p_plate_format_ids))
      GROUP BY closed_on
      ORDER BY closed_on
    ) d
  ), '[]'::jsonb);
END;
$$;

-- RPC for CTP format chart
CREATE OR REPLACE FUNCTION public.get_ctp_formats(
  p_from date,
  p_to date,
  p_client_ids uuid[] DEFAULT NULL,
  p_plate_format_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(f) ORDER BY f.total DESC)
    FROM (
      SELECT 
        COALESCE(plate_format_name, 'Nepoznato') as format_name,
        SUM(plates_qty)::int as total
      FROM v_ctp_items
      WHERE closed_on >= p_from
        AND closed_on <= p_to
        AND (p_client_ids IS NULL OR client_id = ANY(p_client_ids))
        AND (p_plate_format_ids IS NULL OR plate_format_id = ANY(p_plate_format_ids))
      GROUP BY plate_format_name
    ) f
  ), '[]'::jsonb);
END;
$$;

-- RPC for CTP top clients
CREATE OR REPLACE FUNCTION public.get_ctp_top_clients(
  p_from date,
  p_to date,
  p_client_ids uuid[] DEFAULT NULL,
  p_plate_format_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(c) ORDER BY c.total_plates DESC)
    FROM (
      SELECT 
        client_id,
        COALESCE(client_name, 'Nepoznat') as client_name,
        SUM(plates_qty)::int as total_plates,
        COUNT(DISTINCT work_order_id)::int as orders_count
      FROM v_ctp_items
      WHERE closed_on >= p_from
        AND closed_on <= p_to
        AND (p_client_ids IS NULL OR client_id = ANY(p_client_ids))
        AND (p_plate_format_ids IS NULL OR plate_format_id = ANY(p_plate_format_ids))
      GROUP BY client_id, client_name
    ) c
  ), '[]'::jsonb);
END;
$$;

-- RPC for CTP top formats
CREATE OR REPLACE FUNCTION public.get_ctp_top_formats(
  p_from date,
  p_to date,
  p_client_ids uuid[] DEFAULT NULL,
  p_plate_format_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(f) ORDER BY f.total_plates DESC)
    FROM (
      SELECT 
        plate_format_id as format_id,
        COALESCE(plate_format_name, 'Nepoznato') as format_name,
        SUM(plates_qty)::int as total_plates
      FROM v_ctp_items
      WHERE closed_on >= p_from
        AND closed_on <= p_to
        AND (p_client_ids IS NULL OR client_id = ANY(p_client_ids))
        AND (p_plate_format_ids IS NULL OR plate_format_id = ANY(p_plate_format_ids))
      GROUP BY plate_format_id, plate_format_name
    ) f
  ), '[]'::jsonb);
END;
$$;

-- RPC for CTP export data
CREATE OR REPLACE FUNCTION public.get_ctp_export_data(
  p_from date,
  p_to date,
  p_client_ids uuid[] DEFAULT NULL,
  p_plate_format_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(e))
    FROM (
      SELECT 
        closed_on,
        work_order_number,
        client_name,
        plate_format_name,
        plates_qty
      FROM v_ctp_items
      WHERE closed_on >= p_from
        AND closed_on <= p_to
        AND (p_client_ids IS NULL OR client_id = ANY(p_client_ids))
        AND (p_plate_format_ids IS NULL OR plate_format_id = ANY(p_plate_format_ids))
      ORDER BY closed_on DESC
    ) e
  ), '[]'::jsonb);
END;
$$;
