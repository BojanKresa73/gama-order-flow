import { createContext, useContext, useEffect, useRef, useState, ReactNode, useMemo } from "react";
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

function usersEqual(a: OnlinePortalUser[], b: OnlinePortalUser[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a.map(u => u.id));
  const setB = new Set(b.map(u => u.id));
  for (const id of setA) {
    if (!setB.has(id)) return false;
  }
  return true;
}

export function OnlinePortalUsersProvider({ children }: { children: ReactNode }) {
  const [onlinePortalUsers, setOnlinePortalUsers] = useState<OnlinePortalUser[]>([]);
  const prevUsersRef = useRef<OnlinePortalUser[]>([]);

  useEffect(() => {
    const channel = supabase.channel("online-portal-users");

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: OnlinePortalUser[] = [];
        
        Object.entries(state).forEach(([key, presences]) => {
          if (presences && presences.length > 0) {
            const presence = presences[0] as any;
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
        
        if (!usersEqual(prevUsersRef.current, users)) {
          prevUsersRef.current = users;
          setOnlinePortalUsers(users);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ onlinePortalUsers }), [onlinePortalUsers]);

  return (
    <OnlinePortalUsersContext.Provider value={value}>
      {children}
    </OnlinePortalUsersContext.Provider>
  );
}
