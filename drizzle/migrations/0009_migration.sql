DO $$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.mm_reconciliation'::regproc);
  n := replace(d, 'ORDER BY amt DESC LIMIT 60) u', 'ORDER BY amt DESC) u');
  n := replace(n, 'FROM part pt LEFT JOIN pd ON pd.p=pt.p AND pd.direction=(CASE pt.k WHEN ''kupci'' THEN ''issued'' ELSE ''received'' END)',
    'FROM (SELECT k,p FROM part UNION SELECT CASE direction WHEN ''issued'' THEN ''kupci'' ELSE ''dobavljaci'' END, p FROM pd) ky LEFT JOIN part pt ON pt.k=ky.k AND pt.p IS NOT DISTINCT FROM ky.p LEFT JOIN pd ON pd.p IS NOT DISTINCT FROM ky.p AND pd.direction=(CASE ky.k WHEN ''kupci'' THEN ''issued'' ELSE ''received'' END)');
  n := replace(n, 'LEFT JOIN mm_partners mp ON mp.minimax_id=pt.p', 'LEFT JOIN mm_partners mp ON mp.minimax_id=ky.p');
  n := replace(n, 'SELECT pt.k, jsonb_agg(jsonb_build_object(''partner''', 'SELECT ky.k, jsonb_agg(jsonb_build_object(''partner''');
  n := replace(n, 'GROUP BY pt.k),', 'GROUP BY ky.k),');
  IF n = d OR position('LIMIT 60) u' in n) > 0 OR position('ky.k, jsonb_agg' in n) = 0 OR position('GROUP BY ky.k' in n) = 0 THEN RAISE EXCEPTION 'reconciliation replace failed'; END IF;
  EXECUTE n;
  d := pg_get_functiondef('public.mm_profit_check'::regproc);
  n := replace(d, 'FROM mm_ledger_rows WHERE account_code ~ ''^1[0-4]'')', 'FROM mm_ledger_rows WHERE account_code ~ ''^1[0-4]'' AND (debit_rsd<>0 OR credit_rsd<>0))');
  IF n = d THEN RAISE EXCEPTION 'profit replace failed'; END IF;
  EXECUTE n;
END $$;