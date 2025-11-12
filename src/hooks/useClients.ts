import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Client {
  id: string;
  name: string;
  pib: string | null;
  maticni_broj: string | null;
  adresa: string | null;
  grad: string | null;
  postanski_broj: string | null;
  drzava: string;
  kontakt_osoba: string | null;
  telefon: string | null;
  email: string | null;
  notification_email: string | null;
  rok_placanja_dana: number;
  rabat_procenat: number;
  napomena: string | null;
  created_at: string;
  updated_at: string;
}

export const useClients = () => {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return (data || []) as Client[];
    },
  });
};
