import { formatDistanceToNow } from "date-fns";
import { srLatn } from "date-fns/locale";
import { Activity, User, X, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useQuoteActivities } from "@/hooks/useQuoteActivities";
import {
  useQuoteCollaborators,
  useAddQuoteCollaborator,
  useRemoveQuoteCollaborator,
} from "@/hooks/useQuoteCollaborators";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  quoteId: string;
}

const ACTION_LABEL: Record<string, string> = {
  status_changed: "Promena statusa",
  quote_updated: "Izmena ponude",
  item_added: "Dodata stavka",
  item_updated: "Izmena stavke",
  item_deleted: "Obrisana stavka",
  collaborator_added: "Dodat kolaborator",
  collaborator_removed: "Uklonjen kolaborator",
};

function useInternalUsers() {
  return useQuery({
    queryKey: ["internal-users-for-collab"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      return (data ?? []) as { id: string; full_name: string | null }[];
    },
  });
}

export function QuoteProActivityPanel({ quoteId }: Props) {
  const { data: activities = [], isLoading } = useQuoteActivities(quoteId);
  const { data: collabs = [] } = useQuoteCollaborators(quoteId);
  const { data: users = [] } = useInternalUsers();
  const add = useAddQuoteCollaborator();
  const remove = useRemoveQuoteCollaborator();
  const [pick, setPick] = useState("");

  const collabIds = new Set(collabs.map((c) => c.user_id));
  const available = users.filter((u) => !collabIds.has(u.id));

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2 text-sm font-medium">
          <User className="w-4 h-4" /> Kolaboratori
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {collabs.length === 0 && (
            <span className="text-xs text-muted-foreground">Još nema kolaboratora.</span>
          )}
          {collabs.map((c) => (
            <Badge key={c.id} variant="secondary" className="gap-1">
              {c.profile?.full_name ?? c.user_id.slice(0, 8)}
              <button
                className="ml-1 hover:text-destructive"
                onClick={async () => {
                  try {
                    await remove.mutateAsync({ id: c.id, quoteId });
                    toast.success("Kolaborator uklonjen");
                  } catch (e: any) { toast.error(e.message); }
                }}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Dodaj korisnika…" /></SelectTrigger>
            <SelectContent>
              {available.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!pick}
            onClick={async () => {
              try {
                await add.mutateAsync({ quoteId, userId: pick });
                setPick("");
                toast.success("Kolaborator dodat");
              } catch (e: any) { toast.error(e.message); }
            }}
          >
            <UserPlus className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2 text-sm font-medium">
          <Activity className="w-4 h-4" /> Aktivnosti
        </div>
        <ScrollArea className="h-72 pr-2">
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Učitavanje…</div>
          ) : activities.length === 0 ? (
            <div className="text-xs text-muted-foreground">Nema zabeleženih aktivnosti.</div>
          ) : (
            <ul className="space-y-2">
              {activities.map((a) => (
                <li key={a.id} className="text-xs border-l-2 pl-2 border-muted">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{ACTION_LABEL[a.action] ?? a.action}</span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: srLatn })}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {a.user_name}
                    {a.item_name ? ` • ${a.item_name}` : ""}
                    {a.field_name ? ` • ${a.field_name}` : ""}
                    {a.old_value || a.new_value
                      ? `: ${a.old_value ?? "—"} → ${a.new_value ?? "—"}`
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
}
