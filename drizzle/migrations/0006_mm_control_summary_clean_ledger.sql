CREATE OR REPLACE FUNCTION public.mm_control_summary()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_finance_access() THEN RAISE EXCEPTION 'Nemate pristup'; END IF;
  SELECT jsonb_build_object(
    'sync', (SELECT coalesce(jsonb_agg(jsonb_build_object('entity',entity,'remote',total_remote,'status',status,'error',last_error,'updated_at',updated_at,
        'local', CASE WHEN entity='customers' THEN (SELECT count(*) FROM mm_partners) WHEN entity='accounts' THEN (SELECT count(*) FROM mm_accounts)
          WHEN entity='issuedinvoices' THEN (SELECT count(*) FROM mm_documents WHERE direction='issued')
          WHEN entity='receivedinvoices' THEN (SELECT count(*) FROM mm_documents WHERE direction='received')
          WHEN entity LIKE 'journals\_%' THEN (SELECT count(*) FROM mm_journals WHERE year = substr(entity,10)::int)
          WHEN entity='journal_details' THEN (SELECT count(*) FROM mm_journals WHERE detail_loaded) END) ORDER BY entity),'[]') FROM mm_sync_state),
    'docs', (SELECT coalesce(jsonb_agg(x ORDER BY x->>'direction', x->>'year', x->>'kind'),'[]') FROM (
       SELECT jsonb_build_object('direction',direction,'year',year,'kind',kind,'count',count(*),
         'total_rsd',sum(total_rsd),'paid_rsd',sum(paid_rsd),'open_rsd',sum(open_rsd),'unknown_total',count(*) FILTER (WHERE total_rsd IS NULL),
         'needs_review',count(*) FILTER (WHERE review_status<>'ok')) x
       FROM mm_documents GROUP BY direction,year,kind) s),
    'currencies', (SELECT coalesce(jsonb_agg(jsonb_build_object('direction',direction,'currency',currency,'count',c)),'[]') FROM (SELECT direction,currency,count(*) c FROM mm_documents GROUP BY 1,2) s),
    'payment_status', (SELECT coalesce(jsonb_agg(jsonb_build_object('direction',direction,'status',payment_status,'count',c,'open_rsd',o)),'[]') FROM (SELECT direction,payment_status,count(*) c,sum(open_rsd) o FROM mm_documents GROUP BY 1,2) s),
    'open_docs', jsonb_build_object(
       'receivables', (SELECT sum(open_rsd) FROM mm_documents WHERE direction='issued'),
       'payables', (SELECT sum(open_rsd) FROM mm_documents WHERE direction='received' AND kind<>'nacrt')),
    'open_ledger', jsonb_build_object(
       'receivables_204', (SELECT sum(debit_rsd-credit_rsd) FROM mm_ledger_clean() WHERE account_code LIKE '204%'),
       'payables_435', (SELECT sum(credit_rsd-debit_rsd) FROM mm_ledger_clean() WHERE account_code LIKE '435%'),
       'advances_received_430', (SELECT sum(credit_rsd-debit_rsd) FROM mm_ledger_clean() WHERE account_code LIKE '430%'),
       'bank_241', (SELECT sum(debit_rsd-credit_rsd) FROM mm_ledger_clean() WHERE account_code LIKE '241%'),
       'note', 'Bez duplog prenosa otvaranja; sadrži početno stanje prve godine. Banka nije potvrđena izvodom.'),
    'ledger_years', (SELECT coalesce(jsonb_agg(jsonb_build_object('year',year,'rows',c,'debit',d,'credit',k) ORDER BY year),'[]') FROM (SELECT year,count(*) c,sum(debit_rsd) d,sum(credit_rsd) k FROM mm_ledger_rows GROUP BY year) s),
    'accounts_by_class', (SELECT coalesce(jsonb_agg(jsonb_build_object('class',cl,'debit',d,'credit',k,'balance',d-k) ORDER BY cl),'[]') FROM (SELECT left(account_code,1) cl,sum(debit_rsd) d,sum(credit_rsd) k FROM mm_ledger_clean() GROUP BY 1) s),
    'review', (SELECT coalesce(jsonb_agg(jsonb_build_object('direction',direction,'minimax_id',minimax_id,'number',number,'date',doc_date,'partner',partner_name,'currency',currency,'total_rsd',total_rsd,'base_rsd',base_rsd,'kind',kind,'reason',review_reason,'journal_key',journal_key,
        'journals',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',j.minimax_id,'type',j.journal_type,'date',j.journal_date,'description',j.description)),'[]') FROM mm_journals j
           WHERE j.journal_type='PR' AND regexp_replace(regexp_replace(btrim(j.description),'^PR[:;]\s*',''),'^AR(\d{4}-)','\1') = d.journal_key))
        ORDER BY abs(coalesce(total_rsd, base_rsd, 0)) DESC),'[]') FROM mm_documents d WHERE review_status<>'ok')
  ) INTO r;
  RETURN r;
END $function$;