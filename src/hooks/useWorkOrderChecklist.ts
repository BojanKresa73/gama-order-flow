import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  file_entry_id: string | null;
  title: string;
  status: "Pending" | "In Progress" | "Completed" | "Blocked";
  is_required: boolean;
  assignee_user_id: string | null;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  comment: string | null;
  blocker_reason: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
  };
  file_entries?: {
    filename: string;
  };
}

export const useWorkOrderChecklist = (workOrderId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: checklistItems = [], isLoading } = useQuery({
    queryKey: ["checklist-items", workOrderId],
    queryFn: async () => {
      const { data: checklists, error: checklistError } = await supabase
        .from("work_order_checklists")
        .select("id")
        .eq("work_order_id", workOrderId);

      if (checklistError) throw checklistError;
      if (!checklists || checklists.length === 0) return [];

      const checklistIds = checklists.map(c => c.id);

      const { data, error } = await supabase
        .from("work_order_checklist_items")
        .select(`
          *,
          file_entries:file_entry_id (filename)
        `)
        .in("checklist_id", checklistIds)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch assignee profiles separately
      const itemsWithProfiles = await Promise.all(
        (data || []).map(async (item) => {
          if (item.assignee_user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", item.assignee_user_id)
              .single();
            return { ...item, profiles: profile };
          }
          return { ...item, profiles: null };
        })
      );

      return itemsWithProfiles as ChecklistItem[];
    },
    enabled: !!workOrderId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ itemId, newStatus }: { itemId: string; newStatus: ChecklistItem["status"] }) => {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "In Progress" && !checklistItems.find(i => i.id === itemId)?.started_at) {
        updateData.started_at = new Date().toISOString();
      }

      if (newStatus === "Completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("work_order_checklist_items")
        .update(updateData)
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-items", workOrderId] });
      toast({
        title: "Uspešno",
        description: "Status je ažuriran",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    checklistItems,
    isLoading,
    updateStatus: updateStatus.mutate,
  };
};
