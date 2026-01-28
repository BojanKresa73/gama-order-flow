import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAuthz() {
  const { data, isLoading } = useQuery({
    queryKey: ["authz-role"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_user_role");
      if (error) throw error;
      return (data as string) || "guest";
    },
  });

  const role = (data ?? "guest") as
    | "superuser"
    | "admin_plus"
    | "admin"
    | "operator"
    | "operator_ctp"
    | "guest";

  return {
    role,
    isLoading,
    isSuper: role === "superuser",
    isAdminPlus: role === "admin_plus" || role === "superuser",
    isAdmin: role === "admin" || role === "admin_plus" || role === "superuser",
    isOp: role === "operator",
    isCtp: role === "operator_ctp",
  };
}
