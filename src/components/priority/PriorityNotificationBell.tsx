import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { usePriorityNotifications, PriorityNotification } from "@/hooks/usePriorityNotifications";
import { PriorityNotificationModal } from "./PriorityNotificationModal";
import { PriorityBadge } from "./PriorityBadge";

export const PriorityNotificationBell = () => {
  const {
    unreadCount,
    notifications,
    showNotificationModal,
    setShowNotificationModal,
    currentNotification,
    setCurrentNotification,
    acknowledgeNotification,
    isAcknowledging,
    canSeeNotifications,
  } = usePriorityNotifications();

  if (!canSeeNotifications) return null;

  const handleNotificationClick = (notification: PriorityNotification) => {
    setCurrentNotification(notification);
    setShowNotificationModal(true);
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-3 border-b">
            <h4 className="font-semibold">Obaveštenja o prioritetima</h4>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} nepročitanih`
                : "Nema novih obaveštenja"}
            </p>
          </div>

          <ScrollArea className="h-[300px]">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Nema obaveštenja
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => {
                  const log = notification.priority_change_log;
                  const wo = notification.work_orders;

                  return (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {wo?.display_order_number || wo?.order_code}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {(wo?.clients as any)?.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <PriorityBadge
                            priority={log?.old_priority || 5}
                            size="sm"
                          />
                          <span className="text-xs">→</span>
                          <PriorityBadge
                            priority={log?.new_priority || 5}
                            size="sm"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {log?.created_at
                          ? format(new Date(log.created_at), "dd.MM. HH:mm", {
                              locale: sr,
                            })
                          : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <PriorityNotificationModal
        open={showNotificationModal}
        onOpenChange={setShowNotificationModal}
        notification={currentNotification}
        onAcknowledge={acknowledgeNotification}
        isAcknowledging={isAcknowledging}
      />
    </>
  );
};
