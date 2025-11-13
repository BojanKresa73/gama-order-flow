import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FileEntry {
  id: string;
  filename: string;
  quantity: number | null;
  plate_format_id: string | null;
  status: string;
  plate_formats: {
    format_name: string;
  } | null;
}

export const useOrderFiles = (orderId: string) => {
  return useQuery({
    queryKey: ["order-files", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("file_entries")
        .select(`
          id,
          filename,
          quantity,
          plate_format_id,
          status,
          plate_formats (
            format_name
          )
        `)
        .eq("work_order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as FileEntry[];
    },
    enabled: !!orderId,
  });
};
