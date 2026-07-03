import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface QuoteCollaborator {
  id: string;
  quote_id: string;
  user_id: string;
  added_by: string;
  created_at: string;
  profile?: { id: string; full_name: string | null } | null;
}

export function useQuoteCollaborators(quoteId: string | undefined) {
  return useQuery({
    queryKey: ["quote-collaborators", quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_collaborators")
        .select("*")
        .eq("quote_id", quoteId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const ids = (data ?? []).map((c) => c.user_id);
      const profiles: Record<string, { id: string; full_name: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        for (const p of profs ?? []) profiles[p.id] = p as any;
      }
      return (data ?? []).map((c: any) => ({
        ...c,
        profile: profiles[c.user_id] ?? null,
      })) as QuoteCollaborator[];
    },
  });
}

export function useAddQuoteCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId, userId }: { quoteId: string; userId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niste prijavljeni");
      const { error } = await supabase
        .from("quote_collaborators")
        .insert({ quote_id: quoteId, user_id: userId, added_by: user.id });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["quote-collaborators", vars.quoteId] });
      toast.success("Saradnik dodat");
    },
    onError: (e: any) => toast.error(e?.message ?? "Greška pri dodavanju"),
  });
}

export function useRemoveQuoteCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quoteId }: { id: string; quoteId: string }) => {
      const { error } = await supabase.from("quote_collaborators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["quote-collaborators", vars.quoteId] });
      toast.success("Saradnik uklonjen");
    },
    onError: (e: any) => toast.error(e?.message ?? "Greška pri uklanjanju"),
  });
}
