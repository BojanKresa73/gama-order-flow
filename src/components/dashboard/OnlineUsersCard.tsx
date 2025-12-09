import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOnlineUsers } from "@/contexts/OnlineUsersContext";
import { Users, Circle } from "lucide-react";

export function OnlineUsersCard() {
  const { onlineUsers } = useOnlineUsers();

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
