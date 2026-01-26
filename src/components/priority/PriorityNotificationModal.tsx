import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { PriorityNotification } from "@/hooks/usePriorityNotifications";

interface PriorityNotificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: PriorityNotification | null;
  onAcknowledge: (id: string) => void;
  isAcknowledging: boolean;
}

export const PriorityNotificationModal = ({
  open,
  onOpenChange,
  notification,
  onAcknowledge,
  isAcknowledging,
}: PriorityNotificationModalProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (open && notification) {
      // Play sound when modal opens
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio("/notification.mp3");
          audioRef.current.volume = 0.6;
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {
          console.log("Audio autoplay blocked");
        });
      } catch (e) {
        console.log("Could not play sound");
      }
    }
  }, [open, notification]);

  if (!notification) return null;

  const log = notification.priority_change_log;
  const wo = notification.work_orders;
  const oldPriority = log?.old_priority ?? 5;
  const newPriority = log?.new_priority ?? 5;
  const priorityDiff = newPriority - oldPriority;

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "bg-red-500 text-white";
    if (priority >= 5) return "bg-yellow-500 text-black";
    return "bg-green-500 text-white";
  };

  const getPriorityIcon = () => {
    if (priorityDiff > 0) return <ArrowUp className="h-5 w-5 text-red-500" />;
    if (priorityDiff < 0) return <ArrowDown className="h-5 w-5 text-green-500" />;
    return <Minus className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary animate-pulse" />
            Promena prioriteta
          </DialogTitle>
          <DialogDescription>
            Klijent je promenio prioritet naloga
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Order info */}
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Nalog</p>
            <p className="font-semibold text-lg">
              {wo?.display_order_number || wo?.order_code || "N/A"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {(wo?.clients as any)?.name || "Nepoznat klijent"}
            </p>
          </div>

          {/* Priority change */}
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Stari</p>
              <Badge className={`text-lg px-4 py-2 ${getPriorityColor(oldPriority)}`}>
                {oldPriority}
              </Badge>
            </div>

            {getPriorityIcon()}

            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Novi</p>
              <Badge className={`text-lg px-4 py-2 ${getPriorityColor(newPriority)}`}>
                {newPriority}
              </Badge>
            </div>
          </div>

          {/* Note */}
          {log?.note && (
            <div className="p-3 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground mb-1">Napomena:</p>
              <p className="text-sm">{log.note}</p>
            </div>
          )}

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground text-center">
            {log?.created_at
              ? format(new Date(log.created_at), "dd.MM.yyyy. HH:mm", { locale: sr })
              : ""}
          </p>
        </div>

        <DialogFooter>
          <Button
            onClick={() => onAcknowledge(notification.id)}
            disabled={isAcknowledging}
            className="w-full"
          >
            {isAcknowledging ? "Potvrđivanje..." : "Potvrdi prijem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
