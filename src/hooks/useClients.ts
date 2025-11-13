import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

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

export interface ClientFilters {
  search?: string;
  grad?: string;
  pibFilter?: "all" | "with" | "without";
  rokPlacanjaMin?: number;
  rokPlacanjaMax?: number;
  rabatMin?: number;
  rabatMax?: number;
}

export const useClients = (filters?: ClientFilters) => {
  const query = useQuery({
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

  const filteredData = useMemo(() => {
    if (!query.data || !filters) return query.data || [];

    return query.data.filter((client) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        // Normalize PIB for search (remove spaces)
        const normalizedPib = client.pib?.replace(/\s/g, '').toLowerCase() || '';
        const matchesSearch =
          client.name?.toLowerCase().includes(searchLower) ||
          normalizedPib.includes(searchLower.replace(/\s/g, '')) ||
          client.email?.toLowerCase().includes(searchLower) ||
          client.grad?.toLowerCase().includes(searchLower) ||
          client.telefon?.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Grad filter
      if (filters.grad && client.grad !== filters.grad) {
        return false;
      }

      // PIB filter
      if (filters.pibFilter === "with" && !client.pib) {
        return false;
      }
      if (filters.pibFilter === "without" && client.pib) {
        return false;
      }

      // Rok plaćanja range
      if (filters.rokPlacanjaMin !== undefined && client.rok_placanja_dana < filters.rokPlacanjaMin) {
        return false;
      }
      if (filters.rokPlacanjaMax !== undefined && client.rok_placanja_dana > filters.rokPlacanjaMax) {
        return false;
      }

      // Rabat range
      if (filters.rabatMin !== undefined && client.rabat_procenat < filters.rabatMin) {
        return false;
      }
      if (filters.rabatMax !== undefined && client.rabat_procenat > filters.rabatMax) {
        return false;
      }

      return true;
    });
  }, [query.data, filters]);

  return {
    ...query,
    data: filteredData,
  };
};
