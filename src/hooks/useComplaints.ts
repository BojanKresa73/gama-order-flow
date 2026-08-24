import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ComplaintCategory, ComplaintStatus } from "@/lib/complaints";

export interface Complaint {
  id: string;
  complaint_number: string;
  client_id: string;
  work_order_id: string | null;
  category: ComplaintCategory;
  about_user_id: string | null;
  severity: number;
  subject: string;
  description: string;
  status: ComplaintStatus;
  resolution_note: string | null;
  resolved_at: string | null;
  due_at: string;
  created_at: string;
  created_by: string | null;
}

export interface ComplaintMessage {
  id: string;
  complaint_id: string;
  author_id: string | null;
  author_name: string | null;
  is_internal: boolean;
  is_from_client: boolean;
  body: string;
  created_at: string;
}

export interface ComplaintAttachment {
  id: string;
  complaint_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

/** Complaints for a single client (portal usage). */
export function useClientComplaints(clientId?: string) {
  return useQuery({
    queryKey: ["client-complaints", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaints")
        .select("*")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Complaint[];
    },
    enabled: !!clientId,
  });
}

/** All complaints (internal, superuser only). */
export function useAllComplaints() {
  return useQuery({
    queryKey: ["complaints-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaints")
        .select("*, clients(name)")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as unknown as (Complaint & { clients?: { name: string } })[];
    },
  });
}

export function useComplaintMessages(complaintId?: string) {
  return useQuery({
    queryKey: ["complaint-messages", complaintId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaint_messages")
        .select("*")
        .eq("complaint_id", complaintId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ComplaintMessage[];
    },
    enabled: !!complaintId,
  });
}

export function useComplaintAttachments(complaintId?: string) {
  return useQuery({
    queryKey: ["complaint-attachments", complaintId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaint_attachments")
        .select("*")
        .eq("complaint_id", complaintId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ComplaintAttachment[];
    },
    enabled: !!complaintId,
  });
}

export function useComplaintEvents(complaintId?: string) {
  return useQuery({
    queryKey: ["complaint-events", complaintId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaint_events")
        .select("*")
        .eq("complaint_id", complaintId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!complaintId,
  });
}

export async function openComplaintAttachment(path: string) {
  const { data, error } = await supabase.storage
    .from("complaints")
    .createSignedUrl(path, 60 * 10);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}

export function useAddComplaintMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      complaintId: string;
      body: string;
      isInternal: boolean;
      isFromClient: boolean;
      authorName: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nije prijavljen korisnik");

      const { error } = await supabase.from("complaint_messages").insert({
        complaint_id: input.complaintId,
        author_id: user.id,
        author_name: input.authorName,
        is_internal: input.isInternal,
        is_from_client: input.isFromClient,
        body: input.body,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["complaint-messages", vars.complaintId] });
    },
  });
}

export function useUpdateComplaintStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      complaintId: string;
      status: ComplaintStatus;
      resolutionNote?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const resolved = input.status === "resolved" || input.status === "rejected";

      const { error } = await supabase
        .from("complaints")
        .update({
          status: input.status,
          resolution_note: input.resolutionNote ?? null,
          resolved_at: resolved ? new Date().toISOString() : null,
          resolved_by: resolved ? user?.id ?? null : null,
        })
        .eq("id", input.complaintId);
      if (error) throw error;

      try {
        await supabase.functions.invoke("notify-complaint", {
          body: {
            complaint_id: input.complaintId,
            event: "status_changed",
            note: input.resolutionNote || null,
          },
        });
      } catch (e) {
        console.error("notify-complaint failed", e);
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["complaints-all"] });
      queryClient.invalidateQueries({ queryKey: ["complaint-events", vars.complaintId] });
    },
  });
}
