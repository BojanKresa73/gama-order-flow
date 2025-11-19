import { supabase } from "@/integrations/supabase/client";

export type UiItem = {
  id: string;
  label: string;
  qty: number;
  unit: string;
  total?: number;
  details?: string;
  note?: string;
  status?: string;
};

export async function getOrderItems(orderId: string): Promise<UiItem[]> {
  // Get work order kind
  const { data: order, error: orderError } = await supabase
    .from('work_orders')
    .select('id, order_type')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.error('Error fetching work order:', orderError);
    return [];
  }

  // Fetch items based on order type
  if (order.order_type === 'film') {
    const { data, error } = await supabase
      .from('film_jobs')
      .select('id, file_name, width_mm, height_mm, qty, computed_total_m, note')
      .eq('work_order_id', orderId)
      .order('created_at');

    if (error) {
      console.error('Error fetching film jobs:', error);
      return [];
    }

    return (data || []).map(item => ({
      id: item.id,
      label: item.file_name,
      qty: item.qty,
      unit: 'm',
      total: item.computed_total_m || 0,
      details: `${item.width_mm}×${item.height_mm} mm, ${item.qty} kom`,
      note: item.note || undefined,
    }));
  }

  if (order.order_type === 'digital') {
    const { data, error } = await supabase
      .from('digital_jobs')
      .select('id, file_name, finished_w_mm, finished_h_mm, qty, pages, computed_total_sheets')
      .eq('work_order_id', orderId)
      .order('order_index');

    if (error) {
      console.error('Error fetching digital jobs:', error);
      return [];
    }

    return (data || []).map(item => ({
      id: item.id,
      label: item.file_name,
      qty: item.qty,
      unit: 'tab',
      total: item.computed_total_sheets || 0,
      details: `${item.finished_w_mm}×${item.finished_h_mm} mm, ${item.qty} kom, ${item.pages} str`,
    }));
  }

  if (order.order_type === 'ctp') {
    const { data, error } = await supabase
      .from('file_entries')
      .select('id, filename, quantity, status, plate_formats(format_name)')
      .eq('work_order_id', orderId)
      .order('created_at');

    if (error) {
      console.error('Error fetching file entries:', error);
      return [];
    }

    return (data || []).map(item => ({
      id: item.id,
      label: item.filename,
      qty: item.quantity || 0,
      unit: 'kom',
      details: `${item.plate_formats?.format_name || 'N/A'}, ${item.quantity || 0} kom`,
      status: item.status,
    }));
  }

  return [];
}
