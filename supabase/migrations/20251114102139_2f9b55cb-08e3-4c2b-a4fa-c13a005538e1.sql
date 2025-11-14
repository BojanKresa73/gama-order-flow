-- 1) Sve CTP stavke zatvorenih naloga
CREATE OR REPLACE VIEW v_ctp_items AS
SELECT
  wo.id               AS work_order_id,
  wo.order_number     AS work_order_number,
  wo.closed_at::date  AS closed_on,
  wo.client_id,
  c.name              AS client_name,
  fe.plate_format_id,
  pf.format_name      AS plate_format_name,
  fe.quantity         AS plates_qty
FROM work_orders wo
JOIN file_entries fe ON fe.work_order_id = wo.id
LEFT JOIN plate_formats pf ON pf.id = fe.plate_format_id
LEFT JOIN clients c ON c.id = wo.client_id
WHERE wo.order_type = 'ctp' 
  AND wo.status = 'closed' 
  AND fe.quantity > 0;

-- 2) Dnevna agregacija po formatima
CREATE OR REPLACE VIEW v_ctp_daily AS
SELECT
  closed_on,
  SUM(plates_qty) AS total_plates,
  COUNT(DISTINCT work_order_id) AS orders_cnt,
  JSONB_OBJECT_AGG(
    COALESCE(plate_format_name, 'unknown'), 
    format_qty
  ) AS by_format
FROM (
  SELECT 
    closed_on,
    work_order_id,
    plate_format_name,
    SUM(plates_qty) AS plates_qty,
    SUM(plates_qty) AS format_qty
  FROM v_ctp_items
  GROUP BY closed_on, work_order_id, plate_format_name
) sub
GROUP BY closed_on
ORDER BY closed_on DESC;

-- 3) Top klijenti po broju ploča
CREATE OR REPLACE VIEW v_ctp_top_clients AS
SELECT 
  client_id, 
  client_name, 
  SUM(plates_qty) AS total_plates, 
  COUNT(DISTINCT work_order_id) AS orders_cnt
FROM v_ctp_items
GROUP BY client_id, client_name
ORDER BY total_plates DESC;