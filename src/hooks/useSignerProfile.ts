import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { QuoteSigner } from "@/lib/quotePdf";

export function useSignerProfile() {
  return useQuery({
    queryKey: ["signer-profile"],
    queryFn: async (): Promise<QuoteSigner> => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return { fullName: "", email: null, phone: null };
      const { data } = await (supabase as any)
        .from("profiles")
        .select("full_name, phone, job_title")
        .eq("id", user.id)
        .maybeSingle();
      return {
        fullName: data?.full_name || user.email?.split("@")[0] || "Korisnik",
        jobTitle: data?.job_title ?? null,
        phone: data?.phone ?? null,
        email: user.email ?? null,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
