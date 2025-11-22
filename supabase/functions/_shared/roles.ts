import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<"superuser"|"admin"|"operator"|"operator_ctp"|"unknown"> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return "unknown";
  return (data.role as any) ?? "unknown";
}
