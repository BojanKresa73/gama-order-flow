import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface QuoteActivity {
  id: string;
  quote_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  item_name: string | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  details: any;
  created_at: string;
  user_name?: string | null;
}

export function useQuoteActivities(quoteId: string | undefined) {
  return useQuery({
    queryKey: ["quote-activities", quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from("quote_activities")
        .select("*")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(
        new Set((data || []).map((a: any) => a.user_id).filter(Boolean))
      );
      let nameMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        nameMap = Object.fromEntries(
          (profiles || []).map((p: any) => [p.id, p.full_name || ""])
        );
      }
      return (data || []).map((a: any) => ({
        ...a,
        user_name: a.user_id ? nameMap[a.user_id] || "Nepoznat" : "Sistem",
      })) as QuoteActivity[];
    },
    enabled: !!quoteId,
  });
}
