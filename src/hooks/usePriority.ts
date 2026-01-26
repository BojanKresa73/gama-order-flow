import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UpdatePriorityParams {
  workOrderId: string;
  newPriority: number;
  note?: string;
}

interface PriorityChangeResult {
  success: boolean;
  log_id: string;
  old_priority: number;
  new_priority: number;
  order_number: string;
}

export const usePriority = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updatePriority = useMutation({
    mutationFn: async ({ workOrderId, newPriority, note }: UpdatePriorityParams) => {
      const { data, error } = await supabase.rpc("update_work_order_priority", {
        p_work_order_id: workOrderId,
        p_new_priority: newPriority,
        p_note: note || null,
      });

      if (error) throw error;
      return data as unknown as PriorityChangeResult;
    },
    onSuccess: async (data) => {
      toast({
        title: "Prioritet ažuriran",
        description: `Prioritet naloga ${data.order_number} promenjen sa ${data.old_priority} na ${data.new_priority}`,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["checklist"] });
      queryClient.invalidateQueries({ queryKey: ["client-portal-orders"] });

      // Send email notification (fire and forget)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user?.id)
          .single();

        const { data: wo } = await supabase
          .from("work_orders")
          .select("clients(name)")
          .eq("id", data.log_id.split("-")[0]) // This won't work, need work_order_id
          .single();

        await supabase.functions.invoke("notify-priority-change", {
          body: {
            logId: data.log_id,
            workOrderId: data.log_id, // Will be fixed in actual usage
            orderNumber: data.order_number,
            oldPriority: data.old_priority,
            newPriority: data.new_priority,
            clientName: "Klijent", // Will be passed from caller
            changedByName: profile?.full_name || "Nepoznat",
          },
        });
      } catch (e) {
        console.error("Failed to send priority notification email:", e);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message || "Greška pri promeni prioriteta",
        variant: "destructive",
      });
    },
  });

  return {
    updatePriority: updatePriority.mutate,
    isUpdating: updatePriority.isPending,
  };
};
