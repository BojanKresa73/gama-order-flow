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

    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      channel = supabase.channel("global-online-users", {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState();
          const users: OnlineUser[] = [];
          
          Object.entries(state).forEach(([, presences]) => {
            if (presences && presences.length > 0) {
              const presence = presences[0] as any;
              users.push({
                id: presence.user_id,
                full_name: presence.full_name || "Nepoznat korisnik",
                online_at: presence.online_at,
              });
            }
          });
          
          setOnlineUsers(users);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({
              user_id: user.id,
              full_name: profile?.full_name || user.email || "Korisnik",
              online_at: new Date().toISOString(),
            });
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
      if (channel) {
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
