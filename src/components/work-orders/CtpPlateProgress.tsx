import { Progress } from "@/components/ui/progress";
import { useCtpPlateProgress } from "@/hooks/useCtpPrediction";
import { CheckCircle } from "lucide-react";

interface CtpPlateProgressProps {
  workOrderId: string;
  totalPlates: number;
  compact?: boolean;
}

export const CtpPlateProgress = ({ workOrderId, totalPlates, compact = false }: CtpPlateProgressProps) => {
  const { data: progress } = useCtpPlateProgress(workOrderId);

  if (!progress || totalPlates === 0) return null;

  const isComplete = progress.closed >= progress.total;

  if (compact) {
    return (
      <div className="flex items-center gap-2 w-full">
        <Progress value={progress.percent} className="h-1.5 flex-1" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {progress.closed}/{progress.total}
        </span>
        {isComplete && <CheckCircle className="h-3 w-3 text-primary shrink-0" />}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Osvetljavanje ploča
        </span>
        <span className="font-medium">
          {progress.closed}/{progress.total} ploča
          {isComplete && (
            <CheckCircle className="h-4 w-4 text-primary inline ml-1.5 -mt-0.5" />
          )}
        </span>
      </div>
      <Progress value={progress.percent} className="h-2.5" />
      {!isComplete && progress.remaining > 0 && (
        <p className="text-xs text-muted-foreground">
          Preostalo: {progress.remaining} ploča ({progress.percent}% završeno)
        </p>
      )}
    </div>
  );
};
