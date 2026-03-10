import { createContext, useContext, useEffect, useRef, useState, ReactNode, useMemo, useCallback } from "react";
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

/**
 * Compares two user lists by id+full_name only (ignoring online_at which changes on every heartbeat).
 * Returns true if the lists are effectively the same.
 */
function usersEqual(a: OnlineUser[], b: OnlineUser[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a.map(u => u.id));
  const setB = new Set(b.map(u => u.id));
  for (const id of setA) {
    if (!setB.has(id)) return false;
  }
  return true;
}

export function OnlineUsersProvider({ children }: { children: ReactNode }) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const prevUsersRef = useRef<OnlineUser[]>([]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

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
          
          // Only update state if the user list actually changed (ignoring online_at)
          if (!usersEqual(prevUsersRef.current, users)) {
            prevUsersRef.current = users;
            setOnlineUsers(users);
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({
              user_id: user.id,
              full_name: profile?.full_name || user.email || "Korisnik",
              online_at: new Date().toISOString(),
            });
            
            // Heartbeat to keep presence alive
            heartbeatInterval = setInterval(async () => {
              if (channel) {
                await channel.track({
                  user_id: user.id,
                  full_name: profile?.full_name || user.email || "Korisnik",
                  online_at: new Date().toISOString(),
                });
              }
            }, 30000);
          }
        });
    };

    setupPresence();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        setupPresence();
      } else if (event === "SIGNED_OUT") {
        if (channel) {
          channel.unsubscribe();
          channel = null;
        }
        prevUsersRef.current = [];
        setOnlineUsers([]);
      }
    });

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (channel) {
        channel.untrack();
        channel.unsubscribe();
      }
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ onlineUsers }), [onlineUsers]);

  return (
    <OnlineUsersContext.Provider value={value}>
      {children}
    </OnlineUsersContext.Provider>
  );
}
