import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAuthz() {
  const { data } = useQuery({
    queryKey: ["authz-role"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_user_role");
      if (error) throw error;
      return (data as string) || "guest";
    },
  });

  const role = (data ?? "guest") as
    | "superuser"
    | "admin"
    | "operator"
    | "operator_ctp"
    | "guest";

  return {
    role,
    isSuper: role === "superuser",
    isAdmin: role === "admin",
    isOp: role === "operator",
    isCtp: role === "operator_ctp",
  };
}
