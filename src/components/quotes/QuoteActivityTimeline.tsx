import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuoteActivities, type QuoteActivity } from "@/hooks/useQuoteActivities";
import { History, Plus, Trash2, Pencil, UserPlus, UserMinus, Send, ChevronDown } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { sr } from "date-fns/locale";
import { useState } from "react";

function actionMeta(a: QuoteActivity) {
  switch (a.action) {
    case "item_added":
      return { icon: Plus, label: "Dodata stavka", color: "text-emerald-600" };
    case "item_deleted":
      return { icon: Trash2, label: "Obrisana stavka", color: "text-destructive" };
    case "item_updated":
      return { icon: Pencil, label: "Izmena stavke", color: "text-blue-600" };
    case "quote_updated":
      return { icon: Pencil, label: "Izmena ponude", color: "text-blue-600" };
    case "status_changed":
      return { icon: Send, label: "Promena statusa", color: "text-amber-600" };
    case "collaborator_added":
      return { icon: UserPlus, label: "Dodat kolaborator", color: "text-emerald-600" };
    case "collaborator_removed":
      return { icon: UserMinus, label: "Uklonjen kolaborator", color: "text-destructive" };
    default:
      return { icon: History, label: a.action, color: "text-muted-foreground" };
  }
}

function describe(a: QuoteActivity) {
  if (a.action === "item_added") return `"${a.item_name ?? "stavka"}"`;
  if (a.action === "item_deleted") return `"${a.item_name ?? "stavka"}"`;
  if (a.action === "collaborator_added") return `${a.new_value}`;
  if (a.action === "collaborator_removed") return `${a.old_value}`;
  if (a.field_name) {
    const item = a.item_name ? ` na stavci "${a.item_name}"` : "";
    return `${a.field_name}${item}: ${a.old_value ?? "—"} → ${a.new_value ?? "—"}`;
  }
  return "";
}

export function QuoteActivityTimeline({ quoteId }: { quoteId: string }) {
  const { data: activities, isLoading } = useQuoteActivities(quoteId);
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Istorija izmena
              {activities && activities.length > 0 && (
                <Badge variant="secondary" className="ml-2">{activities.length}</Badge>
              )}
              <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !activities || activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Još uvek nema zabeleženih izmena.</p>
            ) : (
              <ScrollArea className="h-[400px] pr-3">
                <ul className="space-y-3">
                  {activities.map((a) => {
                    const meta = actionMeta(a);
                    const Icon = meta.icon;
                    return (
                      <li key={a.id} className="flex gap-3 border-l-2 border-border pl-3 pb-2">
                        <div className={`mt-0.5 ${meta.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                            <span className="font-medium">{a.user_name}</span>
                            <span className="text-muted-foreground">{meta.label.toLowerCase()}</span>
                          </div>
                          <p className="text-sm break-words">{describe(a)}</p>
                          <p className="text-xs text-muted-foreground" title={format(new Date(a.created_at), "dd.MM.yyyy HH:mm:ss", { locale: sr })}>
                            {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: sr })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Collapsible>
      </Collapsible>
    </Card>
  );
}
