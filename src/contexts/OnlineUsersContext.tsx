import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OnlineUser {
  id: string;
  full_name: string;
  online_at: string;
}

interface OnlineUsersContextType {
  onlineUsers: OnlineUser[];
}

const OnlineUsersContext = createContext<OnlineUsersContextType>({ onlineUsers: [] });

export const useOnlineUsers = () => useContext(OnlineUsersContext);

export function OnlineUsersProvider({ children }: { children: ReactNode }) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("[Presence] No user found");
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      console.log("[Presence] Setting up for user:", profile?.full_name || user.email);

      channel = supabase.channel("online-users-v2", {
        config: {
          presence: {
            key: user.id,
          },
          broadcast: {
            self: true,
          },
        },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState();
          console.log("[Presence] Sync event, state:", state);
          const users: OnlineUser[] = [];
          
          Object.entries(state).forEach(([key, presences]) => {
            if (presences && presences.length > 0) {
              const presence = presences[0] as any;
              users.push({
                id: key,
                full_name: presence.full_name || "Nepoznat korisnik",
                online_at: presence.online_at,
              });
            }
          });
          
          console.log("[Presence] Online users:", users);
          setOnlineUsers(users);
        })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
          console.log("[Presence] User joined:", key, newPresences);
        })
        .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
          console.log("[Presence] User left:", key, leftPresences);
        })
        .subscribe(async (status) => {
          console.log("[Presence] Channel status:", status);
          if (status === "SUBSCRIBED") {
            const trackResult = await channel!.track({
              user_id: user.id,
              full_name: profile?.full_name || user.email || "Korisnik",
              online_at: new Date().toISOString(),
            });
            console.log("[Presence] Track result:", trackResult);
            
            // Heartbeat to keep presence alive
            heartbeatInterval = setInterval(async () => {
              if (channel) {
                await channel.track({
                  user_id: user.id,
                  full_name: profile?.full_name || user.email || "Korisnik",
                  online_at: new Date().toISOString(),
                });
              }
            }, 30000); // Every 30 seconds
          }
        });
    };

    setupPresence();

    // Re-setup on auth change
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        setupPresence();
      } else if (event === "SIGNED_OUT") {
        if (channel) {
          channel.unsubscribe();
          channel = null;
        }
        setOnlineUsers([]);
      }
    });

    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      if (channel) {
        channel.untrack();
        channel.unsubscribe();
      }
      subscription.unsubscribe();
    };
  }, []);

  return (
    <OnlineUsersContext.Provider value={{ onlineUsers }}>
      {children}
    </OnlineUsersContext.Provider>
  );
}
