import { supabase } from "@/integrations/supabase/client";

export async function getCurrentRole(): Promise<"superuser"|"admin_plus"|"admin"|"operator"|"operator_ctp"|"unknown"> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "unknown";
  
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  
  if (error || !data) return "unknown";
  return (data.role as any) ?? "unknown";
}
