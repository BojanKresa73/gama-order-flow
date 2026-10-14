CREATE OR REPLACE FUNCTION public.mm_vat_by_month(p_year integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb;
BEGIN
  IF NOT public.has_finance_access() THEN RAISE EXCEPTION 'Nemate pristup'; END IF;
  WITH r AS (
    SELECT * FROM mm_ledger_rows WHERE year = p_year AND account_code ~ '^(27|47)'
  ), m AS (
    SELECT to_char(entry_date,'YYYY-MM') AS month,
      round(sum(CASE WHEN journal_type NOT IN ('DDV','OTV') AND account_code ~ '^47[0-8]' THEN credit_rsd-debit_rsd ELSE 0 END),2) AS output_vat,
      round(sum(CASE WHEN journal_type NOT IN ('DDV','OTV') AND account_code ~ '^27[0-8]' THEN debit_rsd-credit_rsd ELSE 0 END),2) AS input_vat,
      round(sum(CASE WHEN journal_type='DDV' AND account_code='4790' THEN credit_rsd-debit_rsd ELSE 0 END)
          - sum(CASE WHEN journal_type='DDV' AND account_code='2791' THEN debit_rsd-credit_rsd ELSE 0 END),2) AS booked_closing,
      bool_or(journal_type='DDV') AS closing_present,
      max(entry_date) AS last_entry
    FROM r GROUP BY 1
  )
  SELECT jsonb_build_object(
    'year', p_year,
    'source', 'Glavna knjiga Minimax 79412: izlazni PDV konta 470-478, prethodni (ulazni) PDV konta 270-278, bez DDV zatvaranja i početnih stanja. Konačan obračun je PP PDV prijava knjigovođe.',
    'unpaid_4790', (SELECT round(sum(credit_rsd-debit_rsd),2) FROM mm_ledger_clean() WHERE account_code='4790'),
    'months', coalesce(jsonb_agg(jsonb_build_object(
      'month', month, 'output_vat', output_vat, 'input_vat', input_vat,
      'net', output_vat - input_vat, 'booked_closing', booked_closing,
      'closing_present', closing_present, 'last_entry', last_entry,
      'difference', CASE WHEN closing_present THEN round((output_vat - input_vat) - booked_closing,2) END
    ) ORDER BY month), '[]'::jsonb)
  ) INTO res FROM m;
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.mm_vat_by_month(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mm_vat_by_month(integer) TO authenticated;