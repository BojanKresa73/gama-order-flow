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
  notification_email_2: string | null;
  notification_email_3: string | null;
  rok_placanja_dana: number;
  rabat_procenat: number;
  napomena: string | null;
  is_vip: boolean;
  is_blocked: boolean;
  has_mono_pricing: boolean;
  segment: 'novi' | 'redovan' | 'premium';
  last_activity_at: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  owner_user_id: string | null;
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
  onlyVip?: boolean;
  onlyBlocked?: boolean;
  segment?: "all" | "novi" | "redovan" | "premium";
  followUpDate?: string;
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

      // VIP filter
      if (filters.onlyVip && !client.is_vip) {
        return false;
      }

      // Blocked filter
      if (filters.onlyBlocked && !client.is_blocked) {
        return false;
      }

      // Segment filter
      if (filters.segment && filters.segment !== "all" && client.segment !== filters.segment) {
        return false;
      }

      // Follow-up date filter
      if (filters.followUpDate && client.next_follow_up_at) {
        const followUpDate = new Date(client.next_follow_up_at);
        const filterDate = new Date(filters.followUpDate);
        filterDate.setHours(23, 59, 59, 999);
        if (followUpDate > filterDate) {
          return false;
        }
      }

      return true;
    });
  }, [query.data, filters]);

  return {
    ...query,
    data: filteredData,
  };
};
