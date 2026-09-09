import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientStats {
  totalOrders: number;
  openOrders: number;
  closedOrders: number;
  totalClicksYTD: number;
  lastOrder: {
    id: string;
    order_number: string;
    order_type: string;
    status: string;
    created_at: string;
    clicks_count: number | null;
  } | null;
  topFormats: { format: string; count: number }[];
}

export const useClientStats = (clientId: string) => {
  return useQuery({
    queryKey: ["client-stats", clientId],
    queryFn: async (): Promise<ClientStats> => {
      // Aggregation runs in the database (get_client_stats RPC) instead of
      // fetching up to 50k file_entries rows client-side.
      const { data, error } = await supabase.rpc("get_client_stats", {
        p_client_id: clientId,
      });
      if (error) throw error;
      return data as unknown as ClientStats;
    },
    enabled: !!clientId,
  });
};
