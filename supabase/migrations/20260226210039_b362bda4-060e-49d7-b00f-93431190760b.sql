
CREATE OR REPLACE FUNCTION public.get_ctp_revenue(
  p_from text,
  p_to text,
  p_client_ids uuid[] DEFAULT NULL,
  p_plate_format_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(total_revenue_eur numeric) 
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(SUM(
    CASE
      WHEN c.has_mono_pricing = true AND fe.quantity = 1 AND cpp.price_eur_mono IS NOT NULL
        THEN cpp.price_eur_mono * fe.quantity
      WHEN cpp.price_eur IS NOT NULL
        THEN cpp.price_eur * fe.quantity
      ELSE 0
    END
  ), 0)::numeric AS total_revenue_eur
  FROM work_orders wo
  JOIN file_entries fe ON fe.work_order_id = wo.id
  JOIN clients c ON c.id = wo.client_id
  LEFT JOIN client_plate_prices cpp 
    ON cpp.client_id = wo.client_id 
    AND cpp.plate_format_id = fe.plate_format_id
  WHERE wo.order_type = 'ctp'
    AND wo.deleted_at IS NULL
    AND wo.created_at::date >= p_from::date
    AND wo.created_at::date <= p_to::date
    AND (p_client_ids IS NULL OR wo.client_id = ANY(p_client_ids))
    AND (p_plate_format_ids IS NULL OR fe.plate_format_id = ANY(p_plate_format_ids))
    AND fe.file_type = 'CTP';
END;
$$;
