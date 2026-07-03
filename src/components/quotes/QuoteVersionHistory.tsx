import { useState } from "react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { GitBranch, ExternalLink, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  quoteId: string;
  parentId: string | null;
  currentRevision: number;
}

export function QuoteVersionHistory({ quoteId, parentId }: Props) {
  const navigate = useNavigate();
  const rootId = parentId ?? quoteId;

  const { data, isLoading } = useQuery({
    queryKey: ["quote-versions", rootId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, quote_number, revision_number, status, final_price, created_at, parent_quote_id")
        .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`)
        .order("revision_number", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4" /> Verzije
          </CardTitle>
        </CardHeader>
        <CardContent><Loader2 className="h-4 w-4 animate-spin" /></CardContent>
      </Card>
    );
  }

  if (!data || data.length <= 1) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4" /> Verzije ({data.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((v: any) => {
          const isCurrent = v.id === quoteId;
          return (
            <div
              key={v.id}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                isCurrent ? "bg-primary/5 border-primary/40" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  v{v.revision_number} — {v.quote_number}
                  <Badge variant="outline" className="text-[10px]">{v.status}</Badge>
                  {isCurrent && <Badge className="text-[10px]">Trenutno</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(v.created_at), "dd.MM.yyyy HH:mm", { locale: sr })}
                  {v.final_price != null && <> • {Number(v.final_price).toFixed(2)} €</>}
                </div>
              </div>
              {!isCurrent && (
                <Button variant="ghost" size="icon" onClick={() => navigate(`/quotes/${v.id}`)}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
