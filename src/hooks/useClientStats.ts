import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useClientStats = (clientId: string) => {
  return useQuery({
    queryKey: ["client-stats", clientId],
    queryFn: async () => {
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1).toISOString();

      // Fetch work orders for this client
      const { data: orders, error: ordersError } = await supabase
        .from("work_orders")
        .select("id, order_number, order_type, status, created_at, clicks_count")
        .eq("client_id", clientId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      const totalOrders = orders?.length || 0;
      const openOrders = orders?.filter((o) => o.status === "open").length || 0;
      const closedOrders = orders?.filter((o) => o.status === "closed").length || 0;
      const lastOrder = orders?.[0];

      // Fetch file entries for CTP statistics
      const { data: fileEntries, error: fileError } = await supabase
        .from("file_entries")
        .select(`
          quantity,
          plate_format:plate_formats (
            format_name
          ),
          work_order:work_orders!inner (
            client_id,
            order_type
          )
        `)
        .eq("work_order.client_id", clientId)
        .eq("work_order.order_type", "ctp");

      if (fileError) throw fileError;

      // Calculate CTP plates by format
      const platesByFormat: Record<string, number> = {};
      fileEntries?.forEach((entry: any) => {
        const formatName = entry.plate_format?.format_name || "Unknown";
        platesByFormat[formatName] = (platesByFormat[formatName] || 0) + (entry.quantity || 0);
      });

      const topFormats = Object.entries(platesByFormat)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([format, count]) => ({ format, count }));

      // Calculate Digital clicks YTD
      const digitalOrders = orders?.filter(
        (o) => o.order_type === "digital" && o.created_at >= yearStart
      ) || [];
      const totalClicksYTD = digitalOrders.reduce(
        (sum, order) => sum + (order.clicks_count || 0),
        0
      );

      return {
        totalOrders,
        openOrders,
        closedOrders,
        lastOrder,
        topFormats,
        totalClicksYTD,
      };
    },
    enabled: !!clientId,
  });
};
