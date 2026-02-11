import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MachineSpeed {
  id: string;
  machine_id: string;
  machine_name: string;
  format_group: string;
  base_seconds_per_plate: number;
  avg_seconds_per_plate: number | null;
  sample_count: number;
}

export interface CtpTimingLog {
  id: string;
  work_order_id: string;
  machine_id: string;
  format_group: string;
  total_plates: number;
  started_at: string;
  completed_at: string | null;
  actual_seconds_per_plate: number | null;
}

export const useCtpMachineSpeeds = () => {
  return useQuery({
    queryKey: ["ctp-machine-speeds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctp_machine_speeds")
        .select("*")
        .order("machine_id");
      if (error) throw error;
      return data as MachineSpeed[];
    },
  });
};

export const useCtpPrediction = (workOrderId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: machines = [] } = useCtpMachineSpeeds();

  // Get timing log for this work order
  const { data: timingLog } = useQuery({
    queryKey: ["ctp-timing-log", workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctp_job_timing_log")
        .select("*")
        .eq("work_order_id", workOrderId)
        .maybeSingle();
      if (error) throw error;
      return data as CtpTimingLog | null;
    },
    enabled: !!workOrderId,
  });

  // Get the selected machine from work_orders
  const { data: workOrderMachine } = useQuery({
    queryKey: ["work-order-machine", workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("ctp_machine_id")
        .eq("id", workOrderId)
        .single();
      if (error) throw error;
      return data?.ctp_machine_id as string | null;
    },
    enabled: !!workOrderId,
  });

  // Set machine on work order
  const setMachine = useMutation({
    mutationFn: async (machineId: string) => {
      const { error } = await supabase
        .from("work_orders")
        .update({ ctp_machine_id: machineId })
        .eq("id", workOrderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-order-machine", workOrderId] });
      toast({ title: "Uspešno", description: "Mašina je postavljena" });
    },
    onError: (err: any) => {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    },
  });

  // Start timing
  const startTiming = useMutation({
    mutationFn: async ({ machineId, formatGroup, totalPlates }: { machineId: string; formatGroup: string; totalPlates: number }) => {
      const { error } = await supabase
        .from("ctp_job_timing_log")
        .insert({
          work_order_id: workOrderId,
          machine_id: machineId,
          format_group: formatGroup,
          total_plates: totalPlates,
          started_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ctp-timing-log", workOrderId] });
      toast({ title: "Počinjem", description: "Merenje vremena pokrenuto" });
    },
    onError: (err: any) => {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    },
  });

  // Complete timing (called when order is closed)
  const completeTiming = useMutation({
    mutationFn: async () => {
      if (!timingLog) throw new Error("No timing log found");
      const completedAt = new Date().toISOString();
      const durationSeconds = (new Date(completedAt).getTime() - new Date(timingLog.started_at).getTime()) / 1000;
      const actualSpp = durationSeconds / timingLog.total_plates;

      const { error } = await supabase
        .from("ctp_job_timing_log")
        .update({
          completed_at: completedAt,
          actual_seconds_per_plate: actualSpp,
        })
        .eq("id", timingLog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ctp-timing-log", workOrderId] });
      queryClient.invalidateQueries({ queryKey: ["ctp-machine-speeds"] });
    },
  });

  // Calculate ETA
  const getEta = (machineId: string, formatGroup: string, remainingPlates: number) => {
    const speed = machines.find(m => m.machine_id === machineId && m.format_group === formatGroup);
    if (!speed) return null;

    const spp = speed.avg_seconds_per_plate ?? speed.base_seconds_per_plate;
    const totalSeconds = remainingPlates * spp;

    return {
      totalSeconds,
      totalMinutes: Math.ceil(totalSeconds / 60),
      secondsPerPlate: spp,
      isEstimate: speed.avg_seconds_per_plate === null,
      sampleCount: speed.sample_count,
    };
  };

  // Get unique machine list
  const uniqueMachines = machines.reduce((acc, m) => {
    if (!acc.find(x => x.machine_id === m.machine_id)) {
      acc.push({ machine_id: m.machine_id, machine_name: m.machine_name });
    }
    return acc;
  }, [] as { machine_id: string; machine_name: string }[]);

  return {
    machines: uniqueMachines,
    allSpeeds: machines,
    timingLog,
    selectedMachineId: workOrderMachine,
    setMachine: setMachine.mutate,
    startTiming: startTiming.mutate,
    completeTiming: completeTiming.mutate,
    getEta,
    isTimingStarted: !!timingLog?.started_at && !timingLog?.completed_at,
    isTimingComplete: !!timingLog?.completed_at,
  };
};
