
-- Drop and recreate with correct parameter types and arrival filter
DROP FUNCTION IF EXISTS public.get_ctp_cost(timestamptz, timestamptz, uuid[], uuid[]);

CREATE OR REPLACE FUNCTION public.get_ctp_cost(
  p_from text,
  p_to text,
  p_client_ids uuid[] DEFAULT NULL,
  p_format_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(total_cost_eur numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH plates_used AS (
    SELECT 
      fe.plate_format_id,
      SUM(fe.quantity) as plates_qty
    FROM file_entries fe
    JOIN work_orders wo ON wo.id = fe.work_order_id
    WHERE fe.file_type = 'CTP'
      AND wo.order_type = 'ctp'
      AND wo.created_at::date >= p_from::date
      AND wo.created_at::date <= p_to::date
      AND wo.deleted_at IS NULL
      AND (p_client_ids IS NULL OR wo.client_id = ANY(p_client_ids))
      AND (p_format_ids IS NULL OR fe.plate_format_id = ANY(p_format_ids))
    GROUP BY fe.plate_format_id
  ),
  format_costs AS (
    -- Get latest ARRIVED procurement cost per format
    SELECT DISTINCT ON (poi.plate_format_id)
      poi.plate_format_id,
      poi.price_per_m2,
      poi.width_mm,
      poi.height_mm
    FROM procurement_order_items poi
    JOIN procurement_orders po ON po.id = poi.procurement_order_id
    WHERE po.actual_arrival_date IS NOT NULL
    ORDER BY poi.plate_format_id, po.actual_arrival_date DESC
  )
  SELECT COALESCE(SUM(
    pu.plates_qty * fc.width_mm * fc.height_mm * fc.price_per_m2 / 1000000.0
  ), 0)::numeric as total_cost_eur
  FROM plates_used pu
  JOIN format_costs fc ON fc.plate_format_id = pu.plate_format_id;
END;
$$;
