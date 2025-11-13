import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useFilmSettings = () => {
  return useQuery({
    queryKey: ["film-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("film_settings")
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
  });
};
