-- Ledger rows without carried-forward openings (OTV in years after the first year). Same rule as ledgerBalance() in minimaxFinance.ts.
CREATE OR REPLACE FUNCTION public.mm_ledger_clean()
RETURNS SETOF public.mm_ledger_rows LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.* FROM mm_ledger_rows r
  WHERE public.has_finance_access()
    AND NOT (r.journal_type = 'OTV' AND r.year > (SELECT min(year) FROM mm_ledger_rows));
$$;
REVOKE EXECUTE ON FUNCTION public.mm_ledger_clean() FROM anon, public;

CREATE OR REPLACE FUNCTION public.mm_reconciliation()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE fy int; r jsonb;
BEGIN
  IF NOT public.has_finance_access() THEN RAISE EXCEPTION 'Nemate pristup'; END IF;
  SELECT min(year) INTO fy FROM mm_ledger_rows;

  WITH acc AS (SELECT DISTINCT ON (code) code, name FROM mm_accounts ORDER BY code, synced_at DESC),
  side AS (SELECT * FROM (VALUES ('kupci','204',1,'issued'),('dobavljaci','435',-1,'received')) v(k,pref,sgn,dir)),
  rec AS (
    SELECT s.k, s.pref, s.dir,
      (SELECT coalesce(sum(s.sgn*(debit_rsd-credit_rsd)),0) FROM mm_ledger_rows WHERE account_code LIKE s.pref||'%') naive,
      (SELECT coalesce(sum(s.sgn*(debit_rsd-credit_rsd)),0) FROM mm_ledger_rows WHERE account_code LIKE s.pref||'%' AND journal_type='OTV' AND year>fy) carried,
      (SELECT coalesce(sum(s.sgn*(debit_rsd-credit_rsd)),0) FROM mm_ledger_rows WHERE account_code LIKE s.pref||'%' AND journal_type='OTV' AND year=fy) opening,
      (SELECT coalesce(sum(open_rsd),0) FROM mm_documents WHERE direction=s.dir AND kind<>'nacrt') docs,
      (SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('id',journal_minimax_id,'type',journal_type,'year',year)),'[]') FROM mm_ledger_rows WHERE account_code LIKE s.pref||'%' AND journal_type='OTV') src
    FROM side s),
  part AS (
    SELECT s.k, l.partner_minimax_id p,
      sum(s.sgn*(l.debit_rsd-l.credit_rsd)) FILTER (WHERE NOT (l.journal_type='OTV' AND l.year>fy)) ledger,
      sum(s.sgn*(l.debit_rsd-l.credit_rsd)) FILTER (WHERE l.journal_type='OTV' AND l.year=fy) opening,
      sum(s.sgn*(l.debit_rsd-l.credit_rsd)) FILTER (WHERE l.journal_type='OTV' AND l.year>fy) carried,
      sum(CASE WHEN s.sgn=1 THEN l.credit_rsd ELSE l.debit_rsd END) FILTER (WHERE l.journal_type IN ('BD','BK','BT','TR','DI')) payments,
      sum(CASE WHEN s.sgn=1 THEN l.debit_rsd ELSE l.credit_rsd END) FILTER (WHERE l.journal_type IN ('IR','PR')) invoiced
    FROM side s JOIN mm_ledger_rows l ON l.account_code LIKE s.pref||'%' GROUP BY 1,2),
  pd AS (SELECT direction, partner_minimax_id p, sum(open_rsd) docs_open, count(*) FILTER (WHERE open_rsd<>0) open_docs, sum(paid_rsd) docs_paid
         FROM mm_documents WHERE kind<>'nacrt' GROUP BY 1,2),
  partners AS (
    SELECT pt.k, jsonb_agg(jsonb_build_object('partner',coalesce(mp.name,'Nepoznat partner'),'pib',mp.tax_number,
      'opening',round(coalesce(pt.opening,0),2),'carried',round(coalesce(pt.carried,0),2),'ledger',round(coalesce(pt.ledger,0),2),
      'docs_open',round(coalesce(pd.docs_open,0),2),'open_docs',coalesce(pd.open_docs,0),'payments',round(coalesce(pt.payments,0),2),'invoiced',round(coalesce(pt.invoiced,0),2),
      'residual',round(coalesce(pt.ledger,0)-coalesce(pd.docs_open,0)-coalesce(pt.opening,0),2))
      ORDER BY abs(coalesce(pt.ledger,0)-coalesce(pd.docs_open,0)) DESC) j
    FROM part pt LEFT JOIN pd ON pd.p=pt.p AND pd.direction=(CASE pt.k WHEN 'kupci' THEN 'issued' ELSE 'received' END)
    LEFT JOIN mm_partners mp ON mp.minimax_id=pt.p
    WHERE abs(coalesce(pt.ledger,0)-coalesce(pd.docs_open,0))>1 OR abs(coalesce(pt.opening,0))>1
    GROUP BY pt.k),
  -- documents open but partner has no ledger row at all
  bank AS (
    SELECT l.account_code code, a.name, (a.name ILIKE '%prelaz%' OR a.name ILIKE '%pralaz%') transit,
      round(coalesce(sum(debit_rsd-credit_rsd) FILTER (WHERE journal_type='OTV' AND year=fy),0),2) opening,
      round(coalesce(sum(debit_rsd) FILTER (WHERE journal_type<>'OTV'),0),2) debit,
      round(coalesce(sum(credit_rsd) FILTER (WHERE journal_type<>'OTV'),0),2) credit,
      round(sum(debit_rsd-credit_rsd) FILTER (WHERE NOT (journal_type='OTV' AND year>fy)),2) closing,
      max(entry_date) last_date, count(*) FILTER (WHERE journal_type<>'OTV') rows,
      (SELECT jsonb_agg(jsonb_build_object('type',t,'count',c,'debit',d,'credit',k)) FROM (SELECT journal_type t,count(*) c,round(sum(debit_rsd),2) d,round(sum(credit_rsd),2) k FROM mm_ledger_rows x WHERE x.account_code=l.account_code AND NOT (x.journal_type='OTV' AND x.year>fy) GROUP BY 1) z) by_type
    FROM mm_ledger_rows l LEFT JOIN acc a ON a.code=l.account_code
    WHERE l.account_code ~ '^24[0-9]' GROUP BY l.account_code, a.name),
  tr AS (SELECT l.*, (CASE WHEN debit_rsd>0 THEN 'D' ELSE 'P' END) sd, round(greatest(debit_rsd,credit_rsd),2) amt
         FROM mm_ledger_clean() l JOIN acc a ON a.code=l.account_code
         WHERE (a.name ILIKE '%prelaz%' OR a.name ILIKE '%pralaz%') AND l.journal_type<>'OTV'),
  trn AS (SELECT *, row_number() OVER (PARTITION BY amt, sd ORDER BY entry_date, minimax_id) rn FROM tr),
  pairs AS (SELECT d.minimax_id did, p.minimax_id pid, d.amt, d.entry_date dd, p.entry_date pdt, d.account_code dacc, p.account_code pacc
            FROM trn d JOIN trn p ON p.amt=d.amt AND p.rn=d.rn AND d.sd='D' AND p.sd='P'),
  unpaired AS (SELECT t.* FROM tr t WHERE NOT EXISTS (SELECT 1 FROM pairs WHERE did=t.minimax_id OR pid=t.minimax_id))
  SELECT jsonb_build_object(
    'rule','Prenos otvaranja (OTV) u godini posle prve godine samo ponavlja stavke iz prethodne godine i ne sabira se; OTV prve godine je stvarno početno stanje pre Minimax-a.',
    'first_year', fy,
    'open_items', (SELECT jsonb_object_agg(k, jsonb_build_object('account',pref,'previous',round(naive,2),'carried_double',round(carried,2),
        'new',round(naive-carried,2),'docs_open',round(docs,2),'opening_first_year',round(opening,2),
        'unexplained',round(naive-carried-docs-opening,2),'sources',src)) FROM rec),
    'partners', (SELECT coalesce(jsonb_object_agg(k, j),'{}') FROM partners),
    'banks', (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY transit, code),'[]') FROM bank b),
    'transit', jsonb_build_object(
      'rows', (SELECT count(*) FROM tr),
      'paired', (SELECT count(*) FROM pairs),
      'paired_amount', (SELECT coalesce(sum(amt),0) FROM pairs),
      'pairs_sample', (SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM pairs ORDER BY amt DESC LIMIT 15) x),
      'unpaired', (SELECT coalesce(jsonb_agg(jsonb_build_object('account',account_code,'date',entry_date,'type',journal_type,'side',sd,'amount',amt,'description',description,'journal',journal_minimax_id) ORDER BY amt DESC),'[]') FROM (SELECT * FROM unpaired ORDER BY amt DESC LIMIT 60) u),
      'unpaired_count', (SELECT count(*) FROM unpaired),
      'unpaired_net', (SELECT round(coalesce(sum(CASE sd WHEN 'D' THEN amt ELSE -amt END),0),2) FROM unpaired)),
    'bank_note','Saldo po knjiženjima nije potvrđen raspoloživ novac dok se ne uporedi sa izvodima banaka na isti datum.'
  ) INTO r;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.mm_reconciliation() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mm_reconciliation() TO authenticated;

CREATE OR REPLACE FUNCTION public.mm_profit_check(p_year int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_finance_access() THEN RAISE EXCEPTION 'Nemate pristup'; END IF;
  WITH l AS (SELECT * FROM mm_ledger_rows WHERE year=p_year AND journal_type NOT IN ('ZT','ZAP','OTV')),
  m AS (SELECT to_char(entry_date,'YYYY-MM') mo, sum(credit_rsd-debit_rsd) FILTER (WHERE left(account_code,1)='6') rev,
               sum(debit_rsd-credit_rsd) FILTER (WHERE left(account_code,1)='5') exp FROM l GROUP BY 1)
  SELECT jsonb_build_object(
    'year', p_year,
    'check_value', CASE p_year WHEN 2026 THEN 16930000 WHEN 2025 THEN 8080000 END,
    'revenue', (SELECT round(sum(credit_rsd-debit_rsd),2) FROM l WHERE left(account_code,1)='6'),
    'expenses', (SELECT round(sum(debit_rsd-credit_rsd),2) FROM l WHERE left(account_code,1)='5'),
    'result', (SELECT round(sum(credit_rsd-debit_rsd),2) FROM l WHERE left(account_code,1) IN ('5','6')),
    'sum_of_months', (SELECT round(sum(coalesce(rev,0)-coalesce(exp,0)),2) FROM m),
    'by_group', (SELECT jsonb_agg(jsonb_build_object('group',g,'amount',a) ORDER BY g) FROM (SELECT left(account_code,2) g, round(sum(credit_rsd-debit_rsd),2) a FROM l WHERE left(account_code,1) IN ('5','6') GROUP BY 1) z),
    'depreciation_booked', (SELECT round(coalesce(sum(debit_rsd-credit_rsd),0),2) FROM l WHERE account_code LIKE '54%'),
    'depreciation_prev_year', (SELECT round(coalesce(sum(debit_rsd),0),2) FROM mm_ledger_rows WHERE year=p_year-1 AND account_code LIKE '54%' AND journal_type NOT IN ('ZT','ZAP')),
    'fx_net', (SELECT round(coalesce(sum(credit_rsd-debit_rsd),0),2) FROM l WHERE left(account_code,3) IN ('563','663','562','662')),
    'inventory_accounts_used', (SELECT count(*) FROM mm_ledger_rows WHERE account_code ~ '^1[0-4]'),
    'advances_paid_150', (SELECT round(coalesce(sum(debit_rsd-credit_rsd),0),2) FROM mm_ledger_clean() WHERE account_code LIKE '150%'),
    'months', (SELECT jsonb_agg(jsonb_build_object('month',mo,'revenue',round(coalesce(rev,0),2),'expenses',round(coalesce(exp,0),2)) ORDER BY mo) FROM m),
    'last_entry', (SELECT max(entry_date) FROM l),
    'closing_entries_present', (SELECT count(*) FROM mm_journals WHERE year=p_year AND journal_type IN ('ZT','ZAP'))
  ) INTO r;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.mm_profit_check(int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mm_profit_check(int) TO authenticated;