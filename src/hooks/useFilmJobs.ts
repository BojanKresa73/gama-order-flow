import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface FilmJob {
  id?: string;
  work_order_id?: string;
  file_name: string;
  width_mm: number;
  height_mm: number;
  qty: number;
  allow_rotate_90: boolean;
  margin_mm: number;
  note?: string;
  computed_rotation_deg?: number;
  computed_m_per_piece?: number;
  computed_total_m?: number;
}

export const useFilmJobs = (workOrderId: string | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: filmJobs = [], isLoading } = useQuery({
    queryKey: ["film-jobs", workOrderId],
    queryFn: async () => {
      if (!workOrderId) return [];
      
      const { data, error } = await supabase
        .from("film_jobs")
        .select("*")
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as FilmJob[];
    },
    enabled: !!workOrderId,
  });

  const createFilmJob = useMutation({
    mutationFn: async (filmJob: FilmJob) => {
      const insertData = {
        work_order_id: filmJob.work_order_id!,
        file_name: filmJob.file_name,
        width_mm: filmJob.width_mm,
        height_mm: filmJob.height_mm,
        qty: filmJob.qty,
        allow_rotate_90: filmJob.allow_rotate_90,
        margin_mm: filmJob.margin_mm,
        note: filmJob.note,
      };
      
      const { data, error } = await supabase
        .from("film_jobs")
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["film-jobs", workOrderId] });
      toast({
        title: "Uspešno",
        description: "Stavka filmovanja je dodata",
      });
    },
    onError: (error) => {
      console.error("Error creating film job:", error);
      toast({
        title: "Greška",
        description: "Greška pri dodavanju stavke filmovanja",
        variant: "destructive",
      });
    },
  });

  const updateFilmJob = useMutation({
    mutationFn: async ({ id, ...filmJob }: FilmJob & { id: string }) => {
      const { data, error } = await supabase
        .from("film_jobs")
        .update(filmJob)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["film-jobs", workOrderId] });
      toast({
        title: "Uspešno",
        description: "Stavka filmovanja je ažurirana",
      });
    },
    onError: (error) => {
      console.error("Error updating film job:", error);
      toast({
        title: "Greška",
        description: "Greška pri ažuriranju stavke filmovanja",
        variant: "destructive",
      });
    },
  });

  const deleteFilmJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("film_jobs")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["film-jobs", workOrderId] });
      toast({
        title: "Uspešno",
        description: "Stavka filmovanja je obrisana",
      });
    },
    onError: (error) => {
      console.error("Error deleting film job:", error);
      toast({
        title: "Greška",
        description: "Greška pri brisanju stavke filmovanja",
        variant: "destructive",
      });
    },
  });

  return {
    filmJobs,
    isLoading,
    createFilmJob: createFilmJob.mutate,
    updateFilmJob: updateFilmJob.mutate,
    deleteFilmJob: deleteFilmJob.mutate,
  };
};
