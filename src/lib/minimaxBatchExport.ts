import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { fetchNbsEurRate } from "./nbsExchangeRate";
import { generateMinimaxOrderXml, type WorkOrderData } from "./minimaxXmlExport";

/**
 * Batch Minimax XML Export
 * 
 * Exports multiple CTP work orders into a single Minimax XML file.
 * Only closed CTP orders with client pricing data can be exported.
 */

interface BatchExportResult {
  success: boolean;
  exportedCount: number;
  skippedCount: number;
  errors: string[];
}

// Fetch full work order data for Minimax export
async function fetchWorkOrderForMinimax(workOrderId: string, nbsRate: number): Promise<WorkOrderData | null> {
  // Fetch work order with client and file entries
  const { data: workOrder, error: orderError } = await supabase
    .from("work_orders")
    .select(`
      id,
      order_number,
      display_order_number,
      order_type,
      created_at,
      closed_at,
      notes,
      client_id,
      clients (
        name,
        pib,
        adresa,
        grad,
        postanski_broj,
        email,
        telefon
      )
    `)
    .eq("id", workOrderId)
    .single();

  if (orderError || !workOrder) {
    console.error("Error fetching work order:", orderError);
    return null;
  }

  // Only CTP orders
  if (workOrder.order_type !== "ctp") {
    return null;
  }

  // Fetch file entries with plate formats
  const { data: fileEntries, error: filesError } = await supabase
    .from("file_entries")
    .select(`
      id,
      filename,
      quantity,
      plate_format_id,
      status,
      notes,
      plate_formats (format_name)
    `)
    .eq("work_order_id", workOrderId);

  if (filesError) {
    console.error("Error fetching file entries:", filesError);
    return null;
  }

  // Fetch client plate prices
  const { data: platePrices, error: pricesError } = await supabase
    .from("client_plate_prices")
    .select(`
      plate_format_id,
      price_eur,
      plate_formats (format_name)
    `)
    .eq("client_id", workOrder.client_id);

  if (pricesError) {
    console.error("Error fetching plate prices:", pricesError);
  }

  // Transform file entries to include format_name
  const transformedEntries = (fileEntries || []).map((entry: any) => ({
    id: entry.id,
    filename: entry.filename,
    quantity: entry.quantity || 1,
    plate_format_id: entry.plate_format_id,
    format_name: entry.plate_formats?.format_name,
    status: entry.status,
    notes: entry.notes,
  }));

  // Transform plate prices
  const transformedPrices = (platePrices || []).map((price: any) => ({
    plate_format_id: price.plate_format_id,
    format_name: price.plate_formats?.format_name || "",
    price_eur: price.price_eur,
  }));

  return {
    id: workOrder.id,
    display_order_number: workOrder.display_order_number,
    order_number: workOrder.order_number,
    order_type: workOrder.order_type,
    created_at: workOrder.created_at,
    closed_at: workOrder.closed_at,
    notes: workOrder.notes,
    clients: workOrder.clients as any,
    file_entries: transformedEntries,
    client_plate_prices: transformedPrices,
    nbs_rate: nbsRate,
  };
}

// Generate combined XML for multiple orders
function generateBatchMinimaxXml(workOrders: WorkOrderData[]): string {
  const MINIMAX_NAMESPACE = "https://moj.minimax.rs/RS/CommonWeb/documents/schemas/miniMAXUvozKnjigovodstvo";
  
  // Generate individual Narocilo elements
  const narocilaXml = workOrders.map(order => {
    // Generate full XML and extract just the Narocilo content
    const fullXml = generateMinimaxOrderXml(order);
    // Extract content between <Narocilo> and </Narocilo>
    const match = fullXml.match(/<Narocilo>([\s\S]*?)<\/Narocilo>/);
    if (match) {
      return `    <Narocilo>${match[1]}</Narocilo>`;
    }
    return "";
  }).filter(xml => xml.length > 0).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<miniMAXUvozKnjigovodstvo xmlns="${MINIMAX_NAMESPACE}">
  <Narocila>
${narocilaXml}
  </Narocila>
</miniMAXUvozKnjigovodstvo>`;
}

// Main batch export function
export async function exportBatchToMinimax(workOrderIds: string[]): Promise<BatchExportResult> {
  const errors: string[] = [];
  const validOrders: WorkOrderData[] = [];
  
  // Fetch NBS rate once
  let nbsRate = 117.0;
  try {
    const fetchedRate = await fetchNbsEurRate();
    if (fetchedRate) {
      nbsRate = fetchedRate;
    }
  } catch (e: any) {
    console.warn("Could not fetch NBS rate, using fallback:", e);
  }

  // Fetch all orders
  for (const id of workOrderIds) {
    try {
      const order = await fetchWorkOrderForMinimax(id, nbsRate);
      if (order) {
        // Validate order has required data
        if (!order.clients?.pib) {
          errors.push(`${order.display_order_number || order.order_number}: Klijent nema PIB`);
          continue;
        }
        if (order.file_entries.length === 0) {
          errors.push(`${order.display_order_number || order.order_number}: Nema stavki`);
          continue;
        }
        validOrders.push(order);
      }
    } catch (e: any) {
      errors.push(`Greška pri učitavanju naloga ${id}: ${e.message}`);
    }
  }

  if (validOrders.length === 0) {
    return {
      success: false,
      exportedCount: 0,
      skippedCount: workOrderIds.length,
      errors: errors.length > 0 ? errors : ["Nema validnih CTP naloga za izvoz"],
    };
  }

  // Generate combined XML
  const xml = generateBatchMinimaxXml(validOrders);
  
  // Create filename
  const firstOrderNumber = validOrders[0].display_order_number || validOrders[0].order_number || "batch";
  const clientName = validOrders[0].clients?.name?.split(" ")[0] || "Export";
  const fileName = `Minimax_${clientName}_${validOrders.length}naloga_${format(new Date(), "yyyyMMdd_HHmm")}.xml`;
  
  // Download file
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    success: true,
    exportedCount: validOrders.length,
    skippedCount: workOrderIds.length - validOrders.length,
    errors,
  };
}
