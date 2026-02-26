
CREATE OR REPLACE FUNCTION public.get_ctp_area_m2(
  p_from text,
  p_to text,
  p_client_ids uuid[] DEFAULT NULL,
  p_format_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(total_area_m2 numeric)
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
  format_dims AS (
    -- Get dimensions from procurement_order_items (latest order per format)
    SELECT DISTINCT ON (poi.plate_format_id)
      poi.plate_format_id,
      poi.width_mm,
      poi.height_mm
    FROM procurement_order_items poi
    JOIN procurement_orders po ON po.id = poi.procurement_order_id
    ORDER BY poi.plate_format_id, po.order_date DESC
  )
  SELECT COALESCE(SUM(
    pu.plates_qty * fd.width_mm * fd.height_mm / 1000000.0
  ), 0)::numeric as total_area_m2
  FROM plates_used pu
  JOIN format_dims fd ON fd.plate_format_id = pu.plate_format_id;
END;
$$;
