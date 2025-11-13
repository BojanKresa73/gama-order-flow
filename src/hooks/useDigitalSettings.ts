import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DigitalSettings } from "@/lib/digitalCalculations";

export const useDigitalSettings = () => {
  return useQuery({
    queryKey: ["digital-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_settings" as any)
        .select("*")
        .single();

      if (error) throw error;
      return data as unknown as DigitalSettings;
    },
  });
};
