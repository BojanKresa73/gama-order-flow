import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthz } from "@/hooks/useAuthz";

export interface PriorityNotification {
  id: string;
  priority_change_log_id: string;
  work_order_id: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  is_read: boolean;
  created_at: string;
  priority_change_log?: {
    old_priority: number;
    new_priority: number;
    note: string | null;
    changed_by_type: string;
    created_at: string;
  };
  work_orders?: {
    order_code: string;
    display_order_number: string;
    clients: {
      name: string;
    };
  };
}

export const usePriorityNotifications = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isOp, isCtp } = useAuthz();
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<PriorityNotification | null>(null);

  // Check if user should see notifications
  const canSeeNotifications = isAdmin || isOp || isCtp;

  // Fetch unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["priority-notifications-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_unread_priority_notifications_count");
      if (error) throw error;
      return data as number;
    },
    enabled: canSeeNotifications,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch unread notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ["priority-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("priority_notifications")
        .select(`
          *,
          priority_change_log (
            old_priority,
            new_priority,
            note,
            changed_by_type,
            created_at
          )
        `)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Fetch work order details separately
      const withWorkOrders = await Promise.all(
        (data || []).map(async (n) => {
          const { data: wo } = await supabase
            .from("work_orders")
            .select("order_code, display_order_number, clients(name)")
            .eq("id", n.work_order_id)
            .single();

          return { ...n, work_orders: wo } as PriorityNotification;
        })
      );

      return withWorkOrders;
    },
    enabled: canSeeNotifications,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Acknowledge notification mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase.rpc("acknowledge_priority_notification", {
        p_notification_id: notificationId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priority-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["priority-notifications-count"] });
      setShowNotificationModal(false);
      setCurrentNotification(null);
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Autoplay may be blocked, that's okay
        console.log("Notification sound blocked by browser");
      });
    } catch (e) {
      console.log("Could not play notification sound");
    }
  }, []);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!canSeeNotifications) return;

    const channel = supabase
      .channel("priority-notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "priority_notifications",
        },
        async (payload) => {
          console.log("New priority notification:", payload);

          // Fetch the full notification details
          const { data: notif } = await supabase
            .from("priority_notifications")
            .select(`
              *,
              priority_change_log (
                old_priority,
                new_priority,
                note,
                changed_by_type,
                created_at
              )
            `)
            .eq("id", payload.new.id)
            .single();

          if (notif) {
            const { data: wo } = await supabase
              .from("work_orders")
              .select("order_code, display_order_number, clients(name)")
              .eq("id", notif.work_order_id)
              .single();

            const fullNotification = { ...notif, work_orders: wo } as PriorityNotification;

            // Play sound
            playNotificationSound();

            // Show modal
            setCurrentNotification(fullNotification);
            setShowNotificationModal(true);

            // Refresh queries
            queryClient.invalidateQueries({ queryKey: ["priority-notifications"] });
            queryClient.invalidateQueries({ queryKey: ["priority-notifications-count"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canSeeNotifications, queryClient, playNotificationSound]);

  const acknowledgeNotification = (notificationId: string) => {
    acknowledgeMutation.mutate(notificationId);
  };

  return {
    unreadCount,
    notifications,
    showNotificationModal,
    setShowNotificationModal,
    currentNotification,
    setCurrentNotification,
    acknowledgeNotification,
    isAcknowledging: acknowledgeMutation.isPending,
    canSeeNotifications,
  };
};
