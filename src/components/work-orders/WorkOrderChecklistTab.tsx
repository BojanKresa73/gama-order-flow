import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkOrderChecklist, ChecklistItem } from "@/hooks/useWorkOrderChecklist";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { sr } from "date-fns/locale";
import { CtpMachineSelector } from "./CtpMachineSelector";
import { CtpPlateProgress } from "./CtpPlateProgress";
import { useAuthz } from "@/hooks/useAuthz";
import { useCtpPrediction } from "@/hooks/useCtpPrediction";
import { useCallback } from "react";

interface WorkOrderChecklistTabProps {
  workOrderId: string;
  orderType?: string;
  totalPlates?: number;
  formatGroup?: string | null;
  isOrderOpen?: boolean;
}

export const WorkOrderChecklistTab = ({ workOrderId, orderType, totalPlates = 0, formatGroup, isOrderOpen = true }: WorkOrderChecklistTabProps) => {
  const { checklistItems, isLoading, updateStatus } = useWorkOrderChecklist(workOrderId);
  const { isSuper } = useAuthz();

  const isCtp = orderType === "ctp" && totalPlates > 0;
  const {
    selectedMachineId,
    startTiming,
    isTimingStarted,
    isTimingComplete,
  } = useCtpPrediction(isCtp ? workOrderId : "");

  const handleStatusUpdate = useCallback((itemId: string, newStatus: ChecklistItem["status"]) => {
    updateStatus({ itemId, newStatus });

    // Auto-start timing when "CTP izlaz" goes to "In Progress"
    if (
      isCtp &&
      newStatus === "In Progress" &&
      !isTimingStarted &&
      !isTimingComplete &&
      selectedMachineId &&
      formatGroup
    ) {
      const item = checklistItems.find(i => i.id === itemId);
      if (item?.title === "CTP izlaz") {
        startTiming({
          machineId: selectedMachineId,
          formatGroup: formatGroup,
          totalPlates,
        });
      }
    }
  }, [isCtp, isTimingStarted, isTimingComplete, selectedMachineId, formatGroup, totalPlates, checklistItems, updateStatus, startTiming]);

  const getStatusBadge = (status: ChecklistItem["status"]) => {
    const variants: Record<ChecklistItem["status"], { variant: any; label: string }> = {
      "Pending": { variant: "secondary", label: "Na čekanju" },
      "In Progress": { variant: "default", label: "U toku" },
      "Completed": { variant: "outline", label: "Završeno" },
      "Blocked": { variant: "destructive", label: "Blokirano" },
    };
    const { variant, label } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const formatDueDate = (dueAt: string | null) => {
    if (!dueAt) return "-";
    try {
      return formatDistanceToNow(new Date(dueAt), { addSuffix: true, locale: sr });
    } catch {
      return "-";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (checklistItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nema checklist stavki za ovaj nalog
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Plate progress - visible to ALL users */}
      {isCtp && (
        <div className="p-4 border rounded-lg bg-muted/30">
          <CtpPlateProgress workOrderId={workOrderId} totalPlates={totalPlates} />
        </div>
      )}

      {/* CTP admin panel - superuser only */}
      {isSuper && isCtp && (
        <CtpMachineSelector
          workOrderId={workOrderId}
          totalPlates={totalPlates}
          formatGroup={formatGroup || null}
          isOrderOpen={isOrderOpen}
        />
      )}

      <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Korak</TableHead>
            <TableHead>Fajl</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Zadužen</TableHead>
            <TableHead>Rok</TableHead>
            <TableHead>Obavezno</TableHead>
            <TableHead>Akcije</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checklistItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.title}</TableCell>
              <TableCell>{item.file_entries?.filename || "-"}</TableCell>
              <TableCell>{getStatusBadge(item.status)}</TableCell>
              <TableCell>{item.profiles?.full_name || "-"}</TableCell>
              <TableCell>{formatDueDate(item.due_at)}</TableCell>
              <TableCell>
                {item.is_required ? (
                  <Badge variant="outline">Da</Badge>
                ) : (
                  <span className="text-muted-foreground">Ne</span>
                )}
              </TableCell>
              <TableCell>
                <Select
                  value={item.status}
                  onValueChange={(value) =>
                    handleStatusUpdate(item.id, value as ChecklistItem["status"])
                  }
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Na čekanju</SelectItem>
                    <SelectItem value="In Progress">U toku</SelectItem>
                    <SelectItem value="Completed">Završeno</SelectItem>
                    <SelectItem value="Blocked">Blokirano</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </div>
  );
};
