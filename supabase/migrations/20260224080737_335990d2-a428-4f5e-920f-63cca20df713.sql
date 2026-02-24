
DROP VIEW IF EXISTS public.v_ctp_daily CASCADE;
DROP VIEW IF EXISTS public.v_ctp_top_clients CASCADE;
DROP VIEW IF EXISTS public.v_ctp_items CASCADE;

CREATE VIEW public.v_ctp_items WITH (security_invoker=on) AS
SELECT wo.id AS work_order_id,
    wo.order_number AS work_order_number,
    wo.created_at::date AS closed_on,
    wo.client_id,
    c.name AS client_name,
    fe.plate_format_id,
    pf.format_name AS plate_format_name,
    fe.quantity AS plates_qty
   FROM work_orders wo
     JOIN file_entries fe ON fe.work_order_id = wo.id
     LEFT JOIN plate_formats pf ON pf.id = fe.plate_format_id
     LEFT JOIN clients c ON c.id = wo.client_id
  WHERE wo.order_type = 'ctp'::work_order_type 
    AND wo.deleted_at IS NULL
    AND fe.quantity > 0;

CREATE VIEW public.v_ctp_daily WITH (security_invoker=on) AS
SELECT closed_on,
    sum(plates_qty) AS total_plates,
    count(DISTINCT work_order_id) AS orders_cnt,
    jsonb_object_agg(COALESCE(plate_format_name, 'unknown'::text), format_qty) AS by_format
   FROM ( SELECT v_ctp_items.closed_on,
            v_ctp_items.work_order_id,
            v_ctp_items.plate_format_name,
            sum(v_ctp_items.plates_qty) AS plates_qty,
            sum(v_ctp_items.plates_qty) AS format_qty
           FROM v_ctp_items
          GROUP BY v_ctp_items.closed_on, v_ctp_items.work_order_id, v_ctp_items.plate_format_name) sub
  GROUP BY closed_on
  ORDER BY closed_on DESC;

CREATE VIEW public.v_ctp_top_clients WITH (security_invoker=on) AS
SELECT client_id,
    client_name,
    sum(plates_qty) AS total_plates,
    count(DISTINCT work_order_id) AS orders_cnt
   FROM v_ctp_items
  GROUP BY client_id, client_name
  ORDER BY (sum(plates_qty)) DESC;
