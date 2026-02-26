import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { sr } from "date-fns/locale";

interface PortalNotification {
  id: string;
  event_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  work_order_id: string;
}

const eventTypeLabels: Record<string, string> = {
  created: "Novi nalog",
  closed: "Zatvoren",
  priority_changed: "Prioritet",
  status_changed: "Status",
  invalidated: "Storniran",
};

const eventTypeColors: Record<string, string> = {
  created: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  closed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  priority_changed: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  invalidated: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  status_changed: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

export const PortalNotificationBell = ({ clientId }: { clientId: string }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ["portal-notifications", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_notifications")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as PortalNotification[];
    },
    enabled: !!clientId,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Realtime subscription
  useEffect(() => {
    if (!clientId) return;

    const channel = supabase
      .channel("portal-notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "portal_notifications",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["portal-notifications", clientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, queryClient]);

  // Mark all as read when popover opens
  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("portal_notifications")
        .update({ is_read: true, read_at: new Date().toISOString(), read_by: user.id })
        .in("id", unreadIds);

      queryClient.invalidateQueries({ queryKey: ["portal-notifications", clientId] });
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
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
          <h4 className="font-semibold">Obaveštenja</h4>
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
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 transition-colors ${
                    !notification.is_read ? "bg-muted/30" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            eventTypeColors[notification.event_type] || "bg-muted text-muted-foreground"
                          }`}
                        >
                          {eventTypeLabels[notification.event_type] || notification.event_type}
                        </span>
                        {!notification.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="font-medium text-sm">{notification.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(notification.created_at), "dd.MM. HH:mm", {
                      locale: sr,
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
