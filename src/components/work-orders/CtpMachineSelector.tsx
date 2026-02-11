import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCtpPrediction } from "@/hooks/useCtpPrediction";
import { Play, Clock, CheckCircle, Timer } from "lucide-react";
import { useEffect, useState } from "react";

interface CtpMachineSelectorProps {
  workOrderId: string;
  totalPlates: number;
  formatGroup: string | null;
  isOrderOpen: boolean;
}

export const CtpMachineSelector = ({ workOrderId, totalPlates, formatGroup, isOrderOpen }: CtpMachineSelectorProps) => {
  const {
    machines,
    selectedMachineId,
    setMachine,
    startTiming,
    getEta,
    isTimingStarted,
    isTimingComplete,
    timingLog,
  } = useCtpPrediction(workOrderId);

  const [elapsed, setElapsed] = useState(0);

  // Live elapsed timer
  useEffect(() => {
    if (!isTimingStarted || !timingLog?.started_at) return;
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - new Date(timingLog.started_at).getTime()) / 1000);
      setElapsed(seconds);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimingStarted, timingLog?.started_at]);

  if (!formatGroup) return null;

  const eta = selectedMachineId ? getEta(selectedMachineId, formatGroup, totalPlates) : null;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}min`;
    if (m > 0) return `${m}min ${s}s`;
    return `${s}s`;
  };

  const estimatedFinishTime = () => {
    if (!eta || !isTimingStarted || !timingLog?.started_at) return null;
    const finishAt = new Date(new Date(timingLog.started_at).getTime() + eta.totalSeconds * 1000);
    return finishAt.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" });
  };

  const progressPercent = eta ? Math.min(100, (elapsed / eta.totalSeconds) * 100) : 0;

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Timer className="h-4 w-4" />
        CTP Predikcija
      </div>

      {/* Machine selector */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Select
            value={selectedMachineId || ""}
            onValueChange={(val) => setMachine(val)}
            disabled={!isOrderOpen || isTimingStarted}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Izaberi mašinu..." />
            </SelectTrigger>
            <SelectContent>
              {machines.map((m) => (
                <SelectItem key={m.machine_id} value={m.machine_id}>
                  {m.machine_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Start button */}
        {selectedMachineId && !isTimingStarted && !isTimingComplete && isOrderOpen && (
          <Button
            size="sm"
            onClick={() =>
              startTiming({
                machineId: selectedMachineId,
                formatGroup: formatGroup!,
                totalPlates,
              })
            }
          >
            <Play className="h-4 w-4 mr-1" />
            Počinjem
          </Button>
        )}
      </div>

      {/* ETA display */}
      {eta && selectedMachineId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              ETA: <span className="font-medium text-foreground">{formatTime(eta.totalSeconds)}</span>
              {eta.isEstimate && (
                <Badge variant="outline" className="ml-2 text-xs">bazna procena</Badge>
              )}
              {!eta.isEstimate && (
                <Badge variant="outline" className="ml-2 text-xs">
                  avg ({eta.sampleCount} poslova)
                </Badge>
              )}
            </span>
            <span className="text-muted-foreground text-xs">
              {eta.secondsPerPlate.toFixed(1)}s/ploča × {totalPlates} ploča
            </span>
          </div>

          {/* Active timing */}
          {isTimingStarted && (
            <div className="space-y-1">
              <Progress value={progressPercent} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 animate-pulse text-primary" />
                  Proteklo: {formatTime(elapsed)}
                </span>
                {estimatedFinishTime() && (
                  <span>Završetak: ~{estimatedFinishTime()}</span>
                )}
              </div>
            </div>
          )}

          {/* Completed timing */}
          {isTimingComplete && timingLog && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle className="h-4 w-4" />
              <span>
                Završeno — {timingLog.actual_seconds_per_plate?.toFixed(1)}s/ploča stvarno
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
