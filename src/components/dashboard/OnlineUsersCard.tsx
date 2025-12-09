import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, Circle } from "lucide-react";

interface OnlineUser {
  id: string;
  full_name: string;
  online_at: string;
}

export function OnlineUsersCard() {
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

      channel = supabase.channel("online-users", {
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
          
          Object.entries(state).forEach(([userId, presences]) => {
            if (presences && presences.length > 0) {
              const presence = presences[0] as any;
              users.push({
                id: userId,
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
              full_name: profile?.full_name || user.email || "Korisnik",
              online_at: new Date().toISOString(),
            });
          }
        });
    };

    setupPresence();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Aktivni korisnici ({onlineUsers.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {onlineUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nema aktivnih korisnika</p>
        ) : (
          <ul className="space-y-2">
            {onlineUsers.map((user) => (
              <li key={user.id} className="flex items-center gap-2 text-sm">
                <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                <span>{user.full_name}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
