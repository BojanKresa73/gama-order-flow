CREATE TABLE public.mm_dunning_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_minimax_id bigint NOT NULL,
  partner_name text,
  email text NOT NULL,
  overdue_rsd numeric,
  is_test boolean NOT NULL DEFAULT false,
  sent_by uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  error text
);
GRANT SELECT, INSERT ON public.mm_dunning_log TO authenticated;
GRANT ALL ON public.mm_dunning_log TO service_role;
ALTER TABLE public.mm_dunning_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read dunning" ON public.mm_dunning_log FOR SELECT TO authenticated USING (public.has_finance_access());
CREATE POLICY "finance insert dunning" ON public.mm_dunning_log FOR INSERT TO authenticated WITH CHECK (public.has_finance_access() AND sent_by = auth.uid());

CREATE OR REPLACE FUNCTION public.mm_receivables_aging()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_finance_access() THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH docs AS (
    SELECT d.* FROM mm_documents d
    WHERE d.org_id='79412' AND d.direction='issued' AND d.kind='faktura' AND coalesce(d.open_rsd,0) > 0.5
  ), p AS (
    SELECT d.partner_minimax_id pid, max(d.partner_name) partner_name,
      sum(d.open_rsd) open_rsd,
      coalesce(sum(d.open_rsd) FILTER (WHERE d.due_date < current_date),0) overdue_rsd,
      count(*) docs,
      count(*) FILTER (WHERE d.due_date < current_date) overdue_docs,
      max(current_date - d.due_date) FILTER (WHERE d.due_date < current_date) max_days,
      jsonb_agg(jsonb_build_object('number',d.number,'date',d.doc_date,'due',d.due_date,'total',d.total_rsd,'open',d.open_rsd,
        'days', CASE WHEN d.due_date < current_date THEN current_date - d.due_date ELSE 0 END) ORDER BY d.due_date) invoices
    FROM docs d GROUP BY 1
  ), m AS (
    SELECT to_char(gs,'YYYY-MM') mon FROM generate_series(date_trunc('month',current_date) - interval '11 months', date_trunc('month',current_date), interval '1 month') gs
  ), inv AS (
    SELECT partner_minimax_id pid, to_char(doc_date,'YYYY-MM') mon, sum(total_rsd) v FROM mm_documents
    WHERE org_id='79412' AND direction='issued' AND kind IN ('faktura','storno','knjizno_odobrenje') AND doc_date >= date_trunc('month',current_date) - interval '11 months'
    GROUP BY 1,2
  ), pay AS (
    SELECT partner_minimax_id pid, to_char(entry_date,'YYYY-MM') mon, sum(credit_rsd) v FROM mm_ledger_rows
    WHERE org_id='79412' AND account_code LIKE '204%' AND journal_type IN ('BD','BK') AND entry_date >= date_trunc('month',current_date) - interval '11 months'
    GROUP BY 1,2
  ), cl AS (
    SELECT DISTINCT ON (regexp_replace(coalesce(pib,''),'\D','','g')) regexp_replace(coalesce(pib,''),'\D','','g') pibn, name, kontakt_osoba, email, notification_email
    FROM clients WHERE pib IS NOT NULL AND pib <> '' ORDER BY regexp_replace(coalesce(pib,''),'\D','','g'), created_at
  )
  SELECT jsonb_build_object('today', current_date, 'partners', coalesce(jsonb_agg(x ORDER BY (x->>'overdue_rsd')::numeric DESC),'[]'::jsonb)) INTO r
  FROM (
    SELECT jsonb_build_object(
      'partner_minimax_id', p.pid, 'partner', p.partner_name, 'pib', mp.raw->>'TaxNumber',
      'client_name', cl.name, 'contact', cl.kontakt_osoba, 'email', coalesce(nullif(cl.email,''), nullif(cl.notification_email,'')),
      'open_rsd', round(p.open_rsd,2), 'overdue_rsd', round(p.overdue_rsd,2), 'docs', p.docs, 'overdue_docs', p.overdue_docs,
      'max_days', p.max_days, 'invoices', p.invoices,
      'last_sent', (SELECT max(sent_at) FROM mm_dunning_log g WHERE g.partner_minimax_id=p.pid AND NOT g.is_test),
      'months', (SELECT jsonb_agg(jsonb_build_object('month',m.mon,
          'invoiced', coalesce((SELECT round(v,2) FROM inv WHERE inv.pid=p.pid AND inv.mon=m.mon),0),
          'paid', coalesce((SELECT round(v,2) FROM pay WHERE pay.pid=p.pid AND pay.mon=m.mon),0)) ORDER BY m.mon) FROM m)
    ) x
    FROM p LEFT JOIN mm_partners mp ON mp.minimax_id = p.pid
    LEFT JOIN cl ON cl.pibn = regexp_replace(coalesce(mp.raw->>'TaxNumber',''),'\D','','g')
  ) s;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.mm_receivables_aging() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mm_receivables_aging() TO authenticated, service_role;