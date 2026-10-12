CREATE TABLE public.mm_partners (
  org_id text NOT NULL DEFAULT '79412' CHECK (org_id = '79412'),
  minimax_id bigint NOT NULL, code text, name text, tax_number text, usage text,
  raw jsonb, synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, minimax_id));

CREATE TABLE public.mm_accounts (
  org_id text NOT NULL DEFAULT '79412' CHECK (org_id = '79412'),
  minimax_id bigint NOT NULL, code text NOT NULL, name text, allowed_posting text,
  synced_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (org_id, minimax_id));

CREATE TABLE public.mm_documents (
  org_id text NOT NULL DEFAULT '79412' CHECK (org_id = '79412'),
  direction text NOT NULL CHECK (direction IN ('issued','received')),
  minimax_id bigint NOT NULL,
  year int, number text, kind text NOT NULL, status text, payment_status text,
  partner_minimax_id bigint, partner_name text,
  doc_date date, due_date date, currency text,
  total_rsd numeric, paid_rsd numeric, open_rsd numeric,
  base_rsd numeric, vat_rsd numeric, non_deductible_rsd numeric,
  vat_status text, review_status text NOT NULL DEFAULT 'ok', review_reason text,
  journal_key text, raw jsonb, synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, direction, minimax_id));
CREATE INDEX mm_documents_year_idx ON public.mm_documents(direction, year);
CREATE INDEX mm_documents_jkey_idx ON public.mm_documents(journal_key);

CREATE TABLE public.mm_journals (
  org_id text NOT NULL DEFAULT '79412' CHECK (org_id = '79412'),
  minimax_id bigint NOT NULL, journal_type text, journal_date date, year int,
  description text, status text, entries_count int, vat_count int,
  detail_loaded boolean NOT NULL DEFAULT false, row_version text,
  synced_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (org_id, minimax_id));
CREATE INDEX mm_journals_detail_idx ON public.mm_journals(detail_loaded);
CREATE INDEX mm_journals_desc_idx ON public.mm_journals(journal_type, description);

CREATE TABLE public.mm_ledger_rows (
  org_id text NOT NULL DEFAULT '79412' CHECK (org_id = '79412'),
  minimax_id bigint NOT NULL, journal_minimax_id bigint NOT NULL, journal_type text,
  entry_date date, year int, account_minimax_id bigint, account_code text, account_name text,
  partner_minimax_id bigint, currency text, debit_rsd numeric NOT NULL DEFAULT 0, credit_rsd numeric NOT NULL DEFAULT 0,
  description text, synced_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (org_id, minimax_id));
CREATE INDEX mm_ledger_acc_idx ON public.mm_ledger_rows(account_code, year);
CREATE INDEX mm_ledger_journal_idx ON public.mm_ledger_rows(journal_minimax_id);

CREATE TABLE public.mm_vat_rows (
  org_id text NOT NULL DEFAULT '79412' CHECK (org_id = '79412'),
  journal_minimax_id bigint NOT NULL, row_index int NOT NULL,
  base numeric, vat numeric, non_deductible numeric, raw jsonb,
  PRIMARY KEY (org_id, journal_minimax_id, row_index));

CREATE TABLE public.mm_sync_state (
  org_id text NOT NULL DEFAULT '79412' CHECK (org_id = '79412'),
  entity text NOT NULL, next_page int NOT NULL DEFAULT 1, total_remote int, fetched int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', last_error text, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, entity));

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['mm_partners','mm_accounts','mm_documents','mm_journals','mm_ledger_rows','mm_vat_rows','mm_sync_state'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "finance read" ON public.%I FOR SELECT TO authenticated USING (public.has_finance_access())', t);
  END LOOP; END $$;

CREATE OR REPLACE FUNCTION public.mm_control_summary() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_finance_access() THEN RAISE EXCEPTION 'Nemate pristup'; END IF;
  SELECT jsonb_build_object(
    'sync', (SELECT coalesce(jsonb_agg(jsonb_build_object('entity',entity,'remote',total_remote,'status',status,'error',last_error,'updated_at',updated_at,
        'local', CASE entity WHEN 'customers' THEN (SELECT count(*) FROM mm_partners) WHEN 'accounts' THEN (SELECT count(*) FROM mm_accounts)
          WHEN 'issuedinvoices' THEN (SELECT count(*) FROM mm_documents WHERE direction='issued')
          WHEN 'receivedinvoices' THEN (SELECT count(*) FROM mm_documents WHERE direction='received')
          WHEN 'journals' THEN (SELECT count(*) FROM mm_journals) WHEN 'journal_details' THEN (SELECT count(*) FROM mm_journals WHERE detail_loaded) END) ORDER BY entity),'[]') FROM mm_sync_state),
    'docs', (SELECT coalesce(jsonb_agg(x ORDER BY x->>'direction', x->>'year', x->>'kind'),'[]') FROM (
       SELECT jsonb_build_object('direction',direction,'year',year,'kind',kind,'count',count(*),
         'total_rsd',sum(total_rsd),'paid_rsd',sum(paid_rsd),'open_rsd',sum(open_rsd),'unknown_total',count(*) FILTER (WHERE total_rsd IS NULL),
         'needs_review',count(*) FILTER (WHERE review_status<>'ok')) x
       FROM mm_documents GROUP BY direction,year,kind) s),
    'currencies', (SELECT coalesce(jsonb_agg(jsonb_build_object('direction',direction,'currency',currency,'count',c)),'[]') FROM (SELECT direction,currency,count(*) c FROM mm_documents GROUP BY 1,2) s),
    'payment_status', (SELECT coalesce(jsonb_agg(jsonb_build_object('direction',direction,'status',payment_status,'count',c,'open_rsd',o)),'[]') FROM (SELECT direction,payment_status,count(*) c,sum(open_rsd) o FROM mm_documents GROUP BY 1,2) s),
    'open_docs', jsonb_build_object(
       'receivables', (SELECT sum(open_rsd) FROM mm_documents WHERE direction='issued'),
       'payables', (SELECT sum(open_rsd) FROM mm_documents WHERE direction='received')),
    'open_ledger', jsonb_build_object(
       'receivables_204', (SELECT sum(debit_rsd-credit_rsd) FROM mm_ledger_rows WHERE account_code LIKE '204%'),
       'payables_435', (SELECT sum(credit_rsd-debit_rsd) FROM mm_ledger_rows WHERE account_code LIKE '435%'),
       'advances_received_430', (SELECT sum(credit_rsd-debit_rsd) FROM mm_ledger_rows WHERE account_code LIKE '430%'),
       'bank_241', (SELECT sum(debit_rsd-credit_rsd) FROM mm_ledger_rows WHERE account_code LIKE '241%')),
    'ledger_years', (SELECT coalesce(jsonb_agg(jsonb_build_object('year',year,'rows',c,'debit',d,'credit',k) ORDER BY year),'[]') FROM (SELECT year,count(*) c,sum(debit_rsd) d,sum(credit_rsd) k FROM mm_ledger_rows GROUP BY year) s),
    'accounts_by_class', (SELECT coalesce(jsonb_agg(jsonb_build_object('class',cl,'debit',d,'credit',k,'balance',d-k) ORDER BY cl),'[]') FROM (SELECT left(account_code,1) cl,sum(debit_rsd) d,sum(credit_rsd) k FROM mm_ledger_rows GROUP BY 1) s),
    'review', (SELECT coalesce(jsonb_agg(jsonb_build_object('direction',direction,'minimax_id',minimax_id,'number',number,'date',doc_date,'partner',partner_name,'currency',currency,'total_rsd',total_rsd,'base_rsd',base_rsd,'kind',kind,'reason',review_reason,'journal_key',journal_key,
        'journals',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',j.minimax_id,'type',j.journal_type,'date',j.journal_date,'description',j.description)),'[]') FROM mm_journals j WHERE j.description = d.journal_key)) ORDER BY doc_date),'[]') FROM mm_documents d WHERE review_status<>'ok')
  ) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.mm_profit_by_month(p_year int) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_finance_access() THEN RAISE EXCEPTION 'Nemate pristup'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(m ORDER BY m->>'month'),'[]') FROM (
    SELECT jsonb_build_object('month', to_char(date_trunc('month',entry_date),'YYYY-MM'),
      'revenue', sum(credit_rsd-debit_rsd) FILTER (WHERE account_code LIKE '6%'),
      'expenses', sum(debit_rsd-credit_rsd) FILTER (WHERE account_code LIKE '5%'),
      'material', sum(debit_rsd-credit_rsd) FILTER (WHERE account_code LIKE '50%' OR account_code LIKE '51%'),
      'salaries', sum(debit_rsd-credit_rsd) FILTER (WHERE account_code LIKE '52%'),
      'production_services', sum(debit_rsd-credit_rsd) FILTER (WHERE account_code LIKE '53%'),
      'depreciation', sum(debit_rsd-credit_rsd) FILTER (WHERE account_code LIKE '54%'),
      'other', sum(debit_rsd-credit_rsd) FILTER (WHERE account_code LIKE '5%' AND left(account_code,2) NOT IN ('50','51','52','53','54')),
      'result', coalesce(sum(credit_rsd-debit_rsd) FILTER (WHERE account_code LIKE '6%'),0) - coalesce(sum(debit_rsd-credit_rsd) FILTER (WHERE account_code LIKE '5%'),0),
      'missing_depreciation', coalesce(sum(debit_rsd-credit_rsd) FILTER (WHERE account_code LIKE '54%'),0) = 0,
      'unposted_docs', (SELECT count(*) FROM mm_documents d WHERE d.direction='received' AND d.vat_status IS DISTINCT FROM 'ok' AND date_trunc('month',d.doc_date)=date_trunc('month',l.entry_date))
    ) m FROM mm_ledger_rows l WHERE year = p_year AND (account_code LIKE '5%' OR account_code LIKE '6%') GROUP BY date_trunc('month',entry_date)) s);
END $$;
REVOKE ALL ON FUNCTION public.mm_control_summary() FROM public, anon;
REVOKE ALL ON FUNCTION public.mm_profit_by_month(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mm_control_summary() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mm_profit_by_month(int) TO authenticated, service_role;