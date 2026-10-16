import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** True only for users on the finance allowlist (checked on the server by has_finance_access). */
export function useFinanceAccess() {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-access"],
    queryFn: async () => (await supabase.rpc("has_finance_access")).data === true,
    staleTime: 60000,
  });
  return { hasFinance: data === true, isLoading };
}
