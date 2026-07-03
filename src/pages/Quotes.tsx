import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/layout/AppHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, FileText, Search, X, Plus, ClipboardPaste, Calculator, FileUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PasteQuoteEditor } from "@/components/quotes/PasteQuoteEditor";
import { PdfImportQuoteDialog } from "@/components/quotes/PdfImportQuoteDialog";
import { QuickPriceCalculator } from "@/components/calculator/QuickPriceCalculator";

interface QuoteRow {
  id: string;
  quote_number: string | null;
  client_name: string | null;
  client_company: string | null;
  client_email: string | null;
  signer_name: string | null;
  total_eur: number | null;
  sent_at: string | null;
  created_at: string;
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("sr-RS", { dateStyle: "short", timeStyle: "short" }) : "—";

const fmtEur = (n: number | null) =>
  new Intl.NumberFormat("sr-RS", { style: "currency", currency: "EUR" }).format(n ?? 0);

export default function Quotes() {
  const [client, setClient] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["quick-calc-quotes", client, from, to],
    queryFn: async (): Promise<QuoteRow[]> => {
      let q = (supabase as any)
        .from("quick_calc_quotes")
        .select(
          "id, quote_number, client_name, client_company, client_email, signer_name, total_eur, sent_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (client.trim()) {
        const s = `%${client.trim()}%`;
        q = q.or(
          `client_name.ilike.${s},client_company.ilike.${s},client_email.ilike.${s},quote_number.ilike.${s}`,
        );
      }
      if (from) q = q.gte("created_at", new Date(from).toISOString());
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data as QuoteRow[]) ?? [];
    },
  });

  const total = useMemo(
    () => (data ?? []).reduce((sum, r) => sum + (Number(r.total_eur) || 0), 0),
    [data],
  );

  const clearFilters = () => {
    setClient("");
    setFrom("");
    setTo("");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Ponude" />
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-6 space-y-4">
        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
            <div className="space-y-1">
              <Label htmlFor="client">Klijent / broj ponude</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="client"
                  className="pl-8"
                  placeholder="Naziv, firma, email ili PON-…"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="from">Od</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to">Do</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button variant="outline" onClick={clearFilters} disabled={!client && !from && !to}>
              <X className="h-4 w-4 mr-2" />
              Očisti
            </Button>
          </div>
        </Card>

        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova ponuda
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPasteOpen(true)}>
                <ClipboardPaste className="h-4 w-4 mr-2" />
                Nalepi tekst
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCalcOpen(true)}>
                <Calculator className="h-4 w-4 mr-2" />
                Brzi Kalkulator
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <PasteQuoteEditor
          open={pasteOpen}
          onOpenChange={setPasteOpen}
          onSaved={() => qc.invalidateQueries({ queryKey: ["quick-calc-quotes"] })}
        />

        <QuickPriceCalculator
          open={calcOpen}
          onOpenChange={(o) => {
            setCalcOpen(o);
            if (!o) qc.invalidateQueries({ queryKey: ["quick-calc-quotes"] });
          }}
          hideTrigger
        />


        <Card>
          <div className="p-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {isLoading ? "Učitavanje…" : `${data?.length ?? 0} ponuda`}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Ukupno: <span className="font-semibold text-foreground">{fmtEur(total)}</span>
            </div>
          </div>

          {isLoading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (data?.length ?? 0) === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Nema ponuda za zadate filtere.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Broj</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Klijent</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Potpisnik</TableHead>
                    <TableHead className="text-right">Iznos</TableHead>
                    <TableHead>Poslato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.quote_number || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                      <TableCell>{r.client_name || "—"}</TableCell>
                      <TableCell>{r.client_company || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.client_email || "—"}</TableCell>
                      <TableCell>{r.signer_name || "—"}</TableCell>
                      <TableCell className="text-right font-medium">{fmtEur(r.total_eur)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.sent_at ? fmtDate(r.sent_at) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
