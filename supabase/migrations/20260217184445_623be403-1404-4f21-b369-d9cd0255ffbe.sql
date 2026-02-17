
CREATE OR REPLACE FUNCTION public.get_orders_by_type()
RETURNS TABLE (order_type text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT order_type, COUNT(*) as count
  FROM public.work_orders
  WHERE deleted_at IS NULL
  GROUP BY order_type;
$$;
