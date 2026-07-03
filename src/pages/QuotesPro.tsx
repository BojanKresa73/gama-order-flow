import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Plus, FileText, Wand2, Copy, Trash2, ExternalLink } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useQuotesPro,
  useDeleteQuotePro,
  useDuplicateQuotePro,
  type QuoteStatus,
  type QuoteQuickFilter,
} from "@/hooks/useQuotesPro";
import { QuoteProEditor } from "@/components/quotes-pro/QuoteProEditor";
import { TenderImportDialog } from "@/components/quotes-pro/TenderImportDialog";

const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Nacrt",
  sent: "Poslato",
  accepted: "Prihvaćeno",
  rejected: "Odbijeno",
  expired: "Isteklo",
};

const STATUS_VARIANT: Record<QuoteStatus, "secondary" | "default" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "default",
  accepted: "default",
  rejected: "destructive",
  expired: "outline",
};

const fmtEur = (n: number | null | undefined) =>
  new Intl.NumberFormat("sr-RS", { style: "currency", currency: "EUR" }).format(Number(n ?? 0));

export default function QuotesPro() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuoteStatus | "all">("all");
  const [quick, setQuick] = useState<QuoteQuickFilter>("all");
  const [editorId, setEditorId] = useState<string | "new" | null>(null);
  const [tenderOpen, setTenderOpen] = useState(false);

  const { data: quotes = [], isLoading } = useQuotesPro({
    search: search || undefined,
    status: status === "all" ? undefined : status,
    quick,
  });
  const del = useDeleteQuotePro();
  const dup = useDuplicateQuotePro();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Ponude PRO</h1>
            <p className="text-sm text-muted-foreground">
              Napredni modul za ponude — sa AI parsiranjem, revizijama i cenovnicima.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTenderOpen(true)}>
              <Wand2 className="w-4 h-4 mr-2" /> Uvezi tender (AI)
            </Button>
            <Button onClick={() => setEditorId("new")}>
              <Plus className="w-4 h-4 mr-2" /> Nova ponuda
            </Button>
          </div>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Pretraga</Label>
              <Input
                placeholder="Broj ponude, klijent, napomena…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi statusi</SelectItem>
                  <SelectItem value="draft">Nacrt</SelectItem>
                  <SelectItem value="sent">Poslato</SelectItem>
                  <SelectItem value="accepted">Prihvaćeno</SelectItem>
                  <SelectItem value="rejected">Odbijeno</SelectItem>
                  <SelectItem value="expired">Isteklo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Brzi filter</Label>
              <Select value={quick} onValueChange={(v) => setQuick(v as QuoteQuickFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sve</SelectItem>
                  <SelectItem value="mine">Moje</SelectItem>
                  <SelectItem value="expiring_soon">Ističu uskoro</SelectItem>
                  <SelectItem value="high_value">Visoka vrednost</SelectItem>
                  <SelectItem value="pending_response">Čekaju odgovor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card>
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : quotes.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              Nema ponuda za zadate filtere.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Broj</TableHead>
                  <TableHead>Klijent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Iznos</TableHead>
                  <TableHead>Ističe</TableHead>
                  <TableHead>Kreirano</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer"
                    onClick={() => setEditorId(q.id)}
                  >
                    <TableCell className="font-mono">{q.quote_number ?? "—"}</TableCell>
                    <TableCell>{q.client?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[q.status]}>
                        {STATUS_LABEL[q.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtEur(q.final_price ?? q.total_price)}
                    </TableCell>
                    <TableCell>
                      {q.expires_at ? format(new Date(q.expires_at), "dd.MM.yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      {q.created_at ? format(new Date(q.created_at), "dd.MM.yyyy") : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Otvori"
                          onClick={() => setEditorId(q.id)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Dupliraj"
                          onClick={async () => {
                            try {
                              await dup.mutateAsync({ id: q.id, asNewVersion: false });
                              toast.success("Ponuda duplirana");
                            } catch (e: any) {
                              toast.error(e.message ?? "Greška pri dupliranju");
                            }
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Obriši"
                          onClick={async () => {
                            if (!confirm(`Obrisati ponudu ${q.quote_number}?`)) return;
                            try {
                              await del.mutateAsync(q.id);
                              toast.success("Ponuda obrisana");
                            } catch (e: any) {
                              toast.error(e.message ?? "Greška pri brisanju");
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {editorId !== null && (
        <QuoteProEditor
          quoteId={editorId === "new" ? null : editorId}
          open
          onOpenChange={(o) => !o && setEditorId(null)}
        />
      )}

      {tenderOpen && (
        <TenderImportDialog
          open={tenderOpen}
          onOpenChange={setTenderOpen}
          onImported={(id) => {
            setTenderOpen(false);
            setEditorId(id);
          }}
        />
      )}
    </div>
  );
}
