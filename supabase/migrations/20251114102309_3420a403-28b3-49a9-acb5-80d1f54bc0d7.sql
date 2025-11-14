-- Dodaj RLS policies za v_ctp_items view
ALTER VIEW v_ctp_items SET (security_invoker = true);

-- Dodaj RLS policies za v_ctp_daily view  
ALTER VIEW v_ctp_daily SET (security_invoker = true);

-- Dodaj RLS policies za v_ctp_top_clients view
ALTER VIEW v_ctp_top_clients SET (security_invoker = true);