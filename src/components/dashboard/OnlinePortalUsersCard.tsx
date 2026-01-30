import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOnlinePortalUsers } from "@/contexts/OnlinePortalUsersContext";
import { Users, Circle } from "lucide-react";

export function OnlinePortalUsersCard() {
  const { onlinePortalUsers } = useOnlinePortalUsers();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          Portal korisnici online ({onlinePortalUsers.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {onlinePortalUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nema aktivnih portal korisnika</p>
        ) : (
          <ul className="space-y-2">
            {onlinePortalUsers.map((user) => (
              <li key={user.id} className="flex flex-col gap-0.5 text-sm">
                <div className="flex items-center gap-2">
                  <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                  <span className="font-medium">{user.full_name}</span>
                </div>
                <span className="text-xs text-muted-foreground ml-4">
                  {user.client_name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
