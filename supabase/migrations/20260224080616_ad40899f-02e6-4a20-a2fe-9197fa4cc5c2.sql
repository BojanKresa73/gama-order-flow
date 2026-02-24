
CREATE OR REPLACE VIEW public.v_ctp_items AS
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
