import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ClientActivity {
  id: string;
  client_id: string;
  type: "poziv" | "email" | "sastanak" | "napomena";
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export const useClientActivities = (clientId: string) => {
  return useQuery({
    queryKey: ["client-activities", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_activities")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as ClientActivity[];
    },
    enabled: !!clientId,
  });
};

export const useAddClientActivity = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      type,
      note,
      setFollowUp,
    }: {
      clientId: string;
      type: ClientActivity["type"];
      note: string;
      setFollowUp: boolean;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Insert activity
      const { error: activityError } = await supabase
        .from("client_activities")
        .insert({
          client_id: clientId,
          type,
          note,
          created_by: user?.id,
        });

      if (activityError) throw activityError;

      // Update client's last_activity_at
      const updates: any = {
        last_activity_at: new Date().toISOString(),
      };

      // Set follow-up if requested
      if (setFollowUp) {
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + 7);
        updates.next_follow_up_at = followUpDate.toISOString();
      }

      const { error: clientError } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", clientId);

      if (clientError) throw clientError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-activities", variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({
        title: "Aktivnost dodata",
        description: "Aktivnost je uspešno sačuvana",
      });
    },
    onError: (error) => {
      toast({
        title: "Greška",
        description: "Nije moguće sačuvati aktivnost",
        variant: "destructive",
      });
      console.error("Error adding activity:", error);
    },
  });
};
