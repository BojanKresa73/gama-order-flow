UPDATE public.digital_jobs
SET pieces_count = substring(coalesce(name, file_name, '') from '([0-9]+)[[:space:]]*kom')::integer,
    updated_at = now()
WHERE pieces_count IS NULL
  AND substring(coalesce(name, file_name, '') from '([0-9]+)[[:space:]]*kom') IS NOT NULL;

UPDATE public.digital_jobs
SET computed_nup = 1,
    computed_sheets_per_copy = GREATEST(1, COALESCE(obim, 1)),
    computed_total_sheets = GREATEST(1, COALESCE(obim, 1)) * GREATEST(1, COALESCE(qty, 1)),
    computed_color_clicks = ROUND(
      GREATEST(1, COALESCE(obim, 1)) * GREATEST(1, COALESCE(qty, 1)) *
      CASE
        WHEN print_sides = '4/4' THEN 2
        WHEN print_sides IN ('4/0', '4/1') THEN 1
        ELSE 0
      END *
      CASE WHEN machine_sheet_format = '760x330' THEN 1.5 ELSE 1 END
    )::integer,
    computed_mono_clicks = ROUND(
      GREATEST(1, COALESCE(obim, 1)) * GREATEST(1, COALESCE(qty, 1)) *
      CASE
        WHEN print_sides = '1/1' THEN 2
        WHEN print_sides IN ('1/0', '4/1') THEN 1
        ELSE 0
      END *
      CASE WHEN machine_sheet_format = '760x330' THEN 1.5 ELSE 1 END
    )::integer,
    updated_at = now()
WHERE computed_total_sheets IS NULL
   OR computed_total_sheets <= 0
   OR computed_color_clicks IS NULL
   OR computed_mono_clicks IS NULL;