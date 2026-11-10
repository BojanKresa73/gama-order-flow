-- Operational fixes. Existing receipts/stocks are never replayed.
BEGIN;
CREATE OR REPLACE FUNCTION public.can_read_operations() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(public.current_user_is_active(),false) AND EXISTS
 (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('superuser','admin_plus','admin','operator','operator_ctp'));
$$;
CREATE OR REPLACE FUNCTION public.can_manage_operations() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(public.current_user_is_active(),false) AND EXISTS
 (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('superuser','admin_plus','admin','operator'));
$$;
REVOKE ALL ON FUNCTION public.can_read_operations(),public.can_manage_operations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_operations(),public.can_manage_operations() TO authenticated,service_role;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('plate_formats','procurement_orders','procurement_order_items') LOOP
 EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,r.tablename);
 END LOOP;
END $$;
CREATE POLICY operations_read ON public.plate_formats FOR SELECT TO authenticated USING(public.can_read_operations());
-- Existing explicitly authorized Publik stock display remains available.
CREATE POLICY publik_stock_read ON public.plate_formats FOR SELECT TO authenticated USING
 (id='833c26e8-cf70-4130-8a5c-56b1eb6022d1' AND EXISTS
 (SELECT 1 FROM public.client_portal_users p WHERE p.user_id=auth.uid() AND p.is_active AND p.client_id IN ('b48adbce-868e-4564-9c56-27e372af5724','a996f28a-bbaa-4dd7-9b7e-2febc691fa86')));
CREATE POLICY operations_manage ON public.plate_formats FOR ALL TO authenticated USING(public.can_manage_operations()) WITH CHECK(public.can_manage_operations());
CREATE POLICY operations_read ON public.procurement_orders FOR SELECT TO authenticated USING(public.can_read_operations());
CREATE POLICY operations_insert ON public.procurement_orders FOR INSERT TO authenticated WITH CHECK(public.can_manage_operations());
CREATE POLICY operations_update ON public.procurement_orders FOR UPDATE TO authenticated USING(public.can_manage_operations()) WITH CHECK(public.can_manage_operations());
CREATE POLICY operations_delete ON public.procurement_orders FOR DELETE TO authenticated USING(public.current_user_is_active() AND public.has_role(auth.uid(),'superuser'::public.app_role));
CREATE POLICY operations_read ON public.procurement_order_items FOR SELECT TO authenticated USING(public.can_read_operations());
CREATE POLICY operations_manage ON public.procurement_order_items FOR ALL TO authenticated USING(public.can_manage_operations()) WITH CHECK(public.can_manage_operations());

CREATE OR REPLACE FUNCTION public.portal_ctp_items(p_order_id uuid) RETURNS TABLE(id uuid,filename text,quantity integer,format_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.can_read_operations() AND NOT EXISTS(SELECT 1 FROM public.work_orders w JOIN public.client_portal_users p ON p.client_id=w.client_id WHERE w.id=p_order_id AND w.deleted_at IS NULL AND p.user_id=auth.uid() AND p.is_active) THEN RAISE EXCEPTION 'Pristup nije dozvoljen'; END IF;
 RETURN QUERY SELECT f.id,f.filename,f.quantity,pf.format_name FROM public.file_entries f LEFT JOIN public.plate_formats pf ON pf.id=f.plate_format_id WHERE f.work_order_id=p_order_id ORDER BY f.created_at;
END $$;
REVOKE ALL ON FUNCTION public.portal_ctp_items(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_ctp_items(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.adjust_plate_stock(p_id uuid,p_expected integer,p_quantity integer,p_kind text,p_reason text,p_target uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s integer; delta integer; result integer; source_dims text[]; target_dims text[];
BEGIN
 IF NOT public.can_manage_operations() THEN RAISE EXCEPTION 'Pristup nije dozvoljen'; END IF;
 IF p_reason IS NULL OR length(trim(p_reason))<3 THEN RAISE EXCEPTION 'Unesite razlog promene'; END IF;
 IF p_quantity IS NULL OR p_quantity<0 OR (p_kind IS NULL OR p_kind NOT IN ('receipt','count','waste','cut')) THEN RAISE EXCEPTION 'Neispravna promena'; END IF;
 IF p_kind='cut' AND (p_target IS NULL OR p_target=p_id) THEN RAISE EXCEPTION 'Izaberite drugi format'; END IF;
 -- Lock in deterministic order, shared with concurrent stock updates.
 PERFORM id FROM public.plate_formats WHERE id=p_id OR id=p_target ORDER BY id FOR UPDATE;
 SELECT current_stock INTO s FROM public.plate_formats WHERE id=p_id;
 IF NOT FOUND OR s IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Stanje je promenjeno. Osvežite i pokušajte ponovo.'; END IF;
 IF p_kind='cut' AND NOT EXISTS(SELECT 1 FROM public.plate_formats WHERE id=p_target) THEN RAISE EXCEPTION 'Ciljni format ne postoji'; END IF;
 IF p_kind='cut' THEN
 SELECT regexp_match(replace(format_name,'×','x'),'^(\d+)x(\d+)$') INTO source_dims FROM public.plate_formats WHERE id=p_id;
 SELECT regexp_match(replace(format_name,'×','x'),'^(\d+)x(\d+)$') INTO target_dims FROM public.plate_formats WHERE id=p_target;
 IF source_dims IS NULL OR target_dims IS NULL OR NOT ((target_dims[1]::int<=source_dims[1]::int AND target_dims[2]::int<=source_dims[2]::int) OR (target_dims[2]::int<=source_dims[1]::int AND target_dims[1]::int<=source_dims[2]::int)) THEN RAISE EXCEPTION 'Ciljni format ne može da se iseče iz izvorne ploče'; END IF;
 END IF;
 delta:=CASE p_kind WHEN 'count' THEN p_quantity-s WHEN 'receipt' THEN p_quantity ELSE -p_quantity END;
 result:=s+delta;
 IF result<0 THEN RAISE EXCEPTION 'Nema dovoljno ploča'; END IF;
 UPDATE public.plate_formats SET current_stock=result,low_stock=result<=low_stock_threshold WHERE id=p_id;
 INSERT INTO public.inventory_history(plate_format_id,change_amount,created_by,reason) VALUES(p_id,delta,auth.uid(),p_kind||': '||trim(p_reason));
 IF p_kind='cut' THEN
 UPDATE public.plate_formats SET current_stock=current_stock+p_quantity,low_stock=(current_stock+p_quantity)<=low_stock_threshold WHERE id=p_target;
 INSERT INTO public.inventory_history(plate_format_id,change_amount,created_by,reason) VALUES(p_target,p_quantity,auth.uid(),'cut_from '||p_id||': '||trim(p_reason));
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.adjust_plate_stock(uuid,integer,integer,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_plate_stock(uuid,integer,integer,text,text,uuid) TO authenticated;

ALTER TABLE public.procurement_orders ADD COLUMN IF NOT EXISTS usd_to_eur numeric CHECK(usd_to_eur>0);
CREATE OR REPLACE FUNCTION public.save_procurement(p_id uuid,p_expected timestamptz,p_order jsonb,p_items jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing public.procurement_orders%rowtype; item jsonb; dims text[]; status_value text;
BEGIN
 IF NOT public.can_manage_operations() THEN RAISE EXCEPTION 'Pristup nije dozvoljen'; END IF;
 IF p_id IS NULL OR nullif(trim(p_order->>'supplier_name'),'') IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'Dobavljač i stavke su obavezni'; END IF;
 SELECT * INTO existing FROM public.procurement_orders WHERE id=p_id FOR UPDATE;
 IF FOUND AND (p_expected IS NULL OR existing.updated_at IS DISTINCT FROM p_expected) THEN RAISE EXCEPTION 'Narudžbina je promenjena. Osvežite podatke.'; END IF;
 IF NOT FOUND AND p_expected IS NOT NULL THEN RAISE EXCEPTION 'Narudžbina više ne postoji'; END IF;
 status_value:=coalesce(nullif(p_order->>'status',''),existing.status,'ordered');
 IF nullif(p_order->>'actual_arrival_date','') IS NOT NULL THEN status_value:='arrived'; END IF;
 IF status_value NOT IN ('ordered','in_transit','customs','arrived','cancelled') THEN RAISE EXCEPTION 'Neispravan status'; END IF;
 IF coalesce((p_order->>'transport_cost')::numeric,0)<0 OR coalesce((p_order->>'other_costs')::numeric,0)<0 THEN RAISE EXCEPTION 'Troškovi ne mogu biti negativni'; END IF;
 INSERT INTO public.procurement_orders(id,supplier_name,order_date,expected_arrival_date,actual_arrival_date,status,transport_cost,other_costs,notes,created_by,usd_to_eur)
 VALUES(p_id,trim(p_order->>'supplier_name'),(p_order->>'order_date')::date,nullif(p_order->>'expected_arrival_date','')::date,nullif(p_order->>'actual_arrival_date','')::date,status_value,coalesce((p_order->>'transport_cost')::numeric,0),coalesce((p_order->>'other_costs')::numeric,0),p_order->>'notes',auth.uid(),nullif(p_order->>'usd_to_eur','')::numeric)
 ON CONFLICT(id) DO UPDATE SET supplier_name=excluded.supplier_name,order_date=excluded.order_date,expected_arrival_date=excluded.expected_arrival_date,actual_arrival_date=excluded.actual_arrival_date,status=excluded.status,transport_cost=excluded.transport_cost,other_costs=excluded.other_costs,notes=excluded.notes,usd_to_eur=excluded.usd_to_eur;
 DELETE FROM public.procurement_order_items WHERE procurement_order_id=p_id;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
 IF item->>'quantity' IS NULL OR item->>'price_per_m2' IS NULL OR (item->>'quantity')::numeric<=0 OR (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) OR (item->>'price_per_m2')::numeric<0 THEN RAISE EXCEPTION 'Neispravna količina ili cena'; END IF;
 SELECT regexp_match(replace(format_name,'×','x'),'^(\d+)x(\d+)$') INTO dims FROM public.plate_formats WHERE id=(item->>'plate_format_id')::uuid;
 IF dims IS NULL THEN RAISE EXCEPTION 'Format mora imati dimenzije u mm'; END IF;
 INSERT INTO public.procurement_order_items(procurement_order_id,plate_format_id,quantity,price_per_m2,width_mm,height_mm)
 VALUES(p_id,(item->>'plate_format_id')::uuid,(item->>'quantity')::integer,(item->>'price_per_m2')::numeric,dims[1]::integer,dims[2]::integer);
 END LOOP;
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.save_procurement(uuid,timestamptz,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_procurement(uuid,timestamptz,jsonb,jsonb) TO authenticated;

-- The Edge close-work-order flow sends and logs delivery notes already.
-- Preserve the obsolete queue as history; do not replay old notifications.
DROP TRIGGER IF EXISTS trg_queue_email_on_close ON public.work_orders;
CREATE OR REPLACE VIEW public.email_job_latest_status WITH (security_invoker=true) AS
SELECT DISTINCT ON(work_order_id) work_order_id,status,sent_at,created_at,error_msg FROM (
 SELECT work_order_id,status,CASE WHEN status='sent' THEN sent_at ELSE NULL END sent_at,sent_at AS created_at,error_message AS error_msg FROM public.email_log WHERE type IN ('client','delivery_note')
 UNION ALL
 SELECT work_order_id,status,sent_at,created_at,error_msg FROM public.email_jobs WHERE status IN ('sent','error')
) s ORDER BY work_order_id,created_at DESC;

CREATE OR REPLACE FUNCTION public.get_planning_consumption() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.can_read_operations() THEN RAISE EXCEPTION 'Pristup nije dozvoljen'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (
 SELECT f.plate_format_id AS format_id,w.client_id,c.name AS client_name,to_char(w.closed_at AT TIME ZONE 'Europe/Belgrade','YYYY-MM') AS month,sum(f.quantity) AS total
 FROM public.file_entries f JOIN public.work_orders w ON w.id=f.work_order_id JOIN public.clients c ON c.id=w.client_id
 WHERE w.order_type='ctp' AND w.status='closed' AND w.deleted_at IS NULL AND w.invalidated_at IS NULL AND f.quantity>0 AND w.closed_at>=date_trunc('month',now())-interval '6 months'
 GROUP BY 1,2,3,4) x),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.get_planning_consumption() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_planning_consumption() TO authenticated;
-- Audit authenticated stock edits. Service closures retain their existing inventory_history actor.
CREATE OR REPLACE FUNCTION public.audit_plate_stock_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND OLD.current_stock IS DISTINCT FROM NEW.current_stock THEN
 INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,changes)
 VALUES(auth.uid(),'stock_change','plate_formats',NEW.id,jsonb_build_object('before',OLD.current_stock,'after',NEW.current_stock));
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS audit_plate_stock_change ON public.plate_formats;
CREATE TRIGGER audit_plate_stock_change AFTER UPDATE ON public.plate_formats FOR EACH ROW EXECUTE FUNCTION public.audit_plate_stock_change();
COMMIT;
