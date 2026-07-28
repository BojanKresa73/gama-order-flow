CREATE OR REPLACE FUNCTION public.vacation_count_days(p_start date, p_end date)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(count(*)::int, 0)
  FROM generate_series(p_start, p_end, interval '1 day') AS g(d)
  WHERE extract(isodow from g.d) < 6
    AND NOT EXISTS (
      SELECT 1 FROM public.vacation_holidays h
      WHERE h.is_active AND h.holiday_date = g.d::date
    );
$$;