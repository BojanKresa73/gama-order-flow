import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DigitalPaperType {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

export const useDigitalPaperTypes = () => {
  return useQuery({
    queryKey: ["digital-paper-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_paper_types")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as DigitalPaperType[];
    },
  });
};
