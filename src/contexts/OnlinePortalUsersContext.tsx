import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OnlinePortalUser {
  id: string;
  full_name: string;
  client_name: string;
  online_at: string;
}

interface OnlinePortalUsersContextType {
  onlinePortalUsers: OnlinePortalUser[];
}

const OnlinePortalUsersContext = createContext<OnlinePortalUsersContextType>({ onlinePortalUsers: [] });

export const useOnlinePortalUsers = () => useContext(OnlinePortalUsersContext);

export function OnlinePortalUsersProvider({ children }: { children: ReactNode }) {
  const [onlinePortalUsers, setOnlinePortalUsers] = useState<OnlinePortalUser[]>([]);

  useEffect(() => {
    // Listen to the portal users presence channel
    const channel = supabase.channel("online-portal-users");

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        console.log("[Portal Presence] Sync event, state:", state);
        const users: OnlinePortalUser[] = [];
        
        Object.entries(state).forEach(([key, presences]) => {
          if (presences && presences.length > 0) {
            const presence = presences[0] as any;
            // Only include portal users (they have client_name)
            if (presence.client_name) {
              users.push({
                id: key,
                full_name: presence.full_name || "Nepoznat korisnik",
                client_name: presence.client_name || "Nepoznat klijent",
                online_at: presence.online_at,
              });
            }
          }
        });
        
        console.log("[Portal Presence] Online portal users:", users);
        setOnlinePortalUsers(users);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("[Portal Presence] User joined:", key, newPresences);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        console.log("[Portal Presence] User left:", key, leftPresences);
      })
      .subscribe((status) => {
        console.log("[Portal Presence] Channel status:", status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return (
    <OnlinePortalUsersContext.Provider value={{ onlinePortalUsers }}>
      {children}
    </OnlinePortalUsersContext.Provider>
  );
}
