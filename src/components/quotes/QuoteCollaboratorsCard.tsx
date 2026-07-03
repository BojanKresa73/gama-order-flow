import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useQuoteCollaborators,
  useAddQuoteCollaborator,
  useRemoveQuoteCollaborator,
} from "@/hooks/useQuoteCollaborators";

interface Props {
  quoteId: string;
}

export function QuoteCollaboratorsCard({ quoteId }: Props) {
  const { data: collaborators = [], isLoading } = useQuoteCollaborators(quoteId);
  const add = useAddQuoteCollaborator();
  const remove = useRemoveQuoteCollaborator();
  const [selectedUser, setSelectedUser] = useState<string>("");

  const { data: users = [] } = useQuery({
    queryKey: ["profiles-for-collaborators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const existingIds = new Set(collaborators.map((c) => c.user_id));
  const available = users.filter((u: any) => !existingIds.has(u.id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> Saradnici ({collaborators.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Izaberi saradnika" /></SelectTrigger>
            <SelectContent>
              {available.map((u: any) => (
                <SelectItem key={u.id} value={u.id}>{u.full_name ?? "Bez imena"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!selectedUser || add.isPending}
            onClick={async () => {
              await add.mutateAsync({ quoteId, userId: selectedUser });
              setSelectedUser("");
            }}
          >
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : collaborators.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nema saradnika.</p>
        ) : (
          <div className="space-y-1">
            {collaborators.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                <span>{c.profile?.full_name ?? "Nepoznat"}</span>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => remove.mutate({ id: c.id, quoteId })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
