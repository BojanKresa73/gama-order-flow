import { supabase } from "@/integrations/supabase/client";

export type AppRole = "superuser" | "admin" | "operator" | "operator_ctp";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole | null;
  is_active: boolean;
  created_at: string;
}

export async function listUsers(search = "", limit = 50, offset = 0): Promise<User[]> {
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: search,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return data as User[];
}

export async function setUserRole(userId: string, role: AppRole): Promise<void> {
  const { error } = await supabase.rpc("admin_set_user_role", {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc("admin_set_user_active", {
    p_user_id: userId,
    p_active: active,
  });
  if (error) throw error;
}

export async function inviteUser(
  email: string,
  fullName: string,
  role: AppRole,
  password: string
): Promise<{ success: boolean; user_id?: string; warning?: string }> {
  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: {
      email,
      full_name: fullName,
      app_role: role,
      password,
    },
  });
  
  // If we got data with error field, throw that specific error
  if (data?.error) {
    throw new Error(data.error);
  }
  
  // If there's a functions invoke error, try to extract the message
  if (error) {
    // Try to parse the error context for more details
    const errorMessage = error.message || "Došlo je do greške pri pozivanju korisnika.";
    throw new Error(errorMessage);
  }
  
  return data;
}

export async function resetUserPassword(
  email: string
): Promise<{ success: boolean; recovery_link: string }> {
  const { data, error } = await supabase.functions.invoke("admin-reset-password", {
    body: { email },
  });
  
  if (data?.error) {
    throw new Error(data.error);
  }
  
  if (error) throw error;
  return data;
}
