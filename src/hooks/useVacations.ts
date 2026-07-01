import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VacationRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  used_from_previous: number;
  used_from_current: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  reviewer_note: string | null;
  created_at: string;
  user_name?: string;
}

export interface VacationBalance {
  user_id: string;
  year: number;
  allocated: number;
  used: number;
  carried_over: number;
  carryover_expires_on: string | null;
}

export function useVacationHolidays() {
  return useQuery({
    queryKey: ["vacation-holidays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_holidays")
        .select("holiday_date, name")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as { holiday_date: string; name: string }[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useVacationRequests() {
  return useQuery({
    queryKey: ["vacation-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as VacationRequest[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
        rows.forEach((r) => (r.user_name = map.get(r.user_id) || "Nepoznat"));
      }
      return rows;
    },
  });
}

export function useMyBalance(year: number) {
  return useQuery({
    queryKey: ["vacation-balance-me", year],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return null;
      // ensure balance exists via submit-safe path: read; if missing, no row
      const { data, error } = await supabase
        .from("vacation_balances")
        .select("*")
        .eq("user_id", uid)
        .eq("year", year)
        .maybeSingle();
      if (error) throw error;
      return data as VacationBalance | null;
    },
  });
}

export function useSubmitVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { start: string; end: string; reason: string | null }) => {
      const { data, error } = await supabase.rpc("vacation_submit", {
        p_start: p.start,
        p_end: p.end,
        p_reason: p.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacation-requests"] });
      qc.invalidateQueries({ queryKey: ["vacation-balance-me"] });
    },
  });
}

export function useReviewVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; decision: "approved" | "rejected"; note: string | null }) => {
      const { error } = await supabase.rpc("vacation_review", {
        p_id: p.id,
        p_decision: p.decision,
        p_note: p.note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacation-requests"] });
      qc.invalidateQueries({ queryKey: ["vacation-balance-me"] });
    },
  });
}

export function useCancelVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vacation_requests")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vacation-requests"] }),
  });
}
