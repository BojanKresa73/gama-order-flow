import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Mail, Send, Eye, ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle } from "lucide-react";
import { sumAmounts, summarizeResults, toAmount, type SendResult } from "@/lib/dunning";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

const fmt = (v: unknown) => (v == null ? "—" : Number(v).toLocaleString("sr-RS", { maximumFractionDigits: 2 }));
const d = (s?: string) => (s ? s.split("-").reverse().join(".") + "." : "—");

type SortKey = "partner" | "open_rsd" | "overdue_rsd" | "docs" | "max_days" | "last_sent";

const cellValue = (p: any, key: SortKey): string | number => {
  if (key === "partner") return String(p.partner ?? "");
  if (key === "last_sent") return p.last_sent ? new Date(p.last_sent).getTime() : -Infinity;
  const n = Number(p[key]);
  return Number.isFinite(n) ? n : -Infinity;
};

export function DunningTab() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["mm-aging"],
    queryFn: async () => { const { data, error } = await supabase.rpc("mm_receivables_aging" as any); if (error) throw error; return data as any; },
  });
  const [search, setSearch] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "overdue_rsd", dir: -1 });
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<any>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<SendResult[] | null>(null);

  const allPartners = useMemo(() => (data?.partners ?? []), [data]);
  const notOverdue = useMemo(() => allPartners.filter((p: any) => !(Number(p.overdue_rsd) > 0.5)).length, [allPartners]);

  const list = useMemo(() => {
    const arr = allPartners.filter((p: any) =>
      (!onlyOverdue || Number(p.overdue_rsd) > 0.5) &&
      (!search || `${p.partner} ${p.client_name ?? ""} ${p.pib ?? ""}`.toLowerCase().includes(search.toLowerCase())));
    arr.sort((a: any, b: any) => {
      const av = cellValue(a, sort.key), bv = cellValue(b, sort.key);
      if (typeof av === "string" || typeof bv === "string") return sort.dir * String(av).localeCompare(String(bv), "sr");
      return sort.dir * (Number(av) - Number(bv));
    });
    return arr;
  }, [allPartners, search, onlyOverdue, sort]);

  const totals = useMemo(() => sumAmounts(list), [list]);

  // Prvi klik = od najmanjeg ka najvećem, drugi klik = obrnuto.
  const toggleSort = (key: SortKey) => setSort((s) => s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 });

  const sortHead = (key: SortKey, label: string, align: "left" | "right" | "center" = "left", extra = "") => {
    const active = sort.key === key;
    return (
      <th className={`px-3 py-2.5 ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${extra}`}
        aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggleSort(key)} title="Kliknite za sortiranje"
          className={`inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground ${active ? "text-foreground" : ""}`}>
          <span>{label}</span>
          {active
            ? (sort.dir === 1 ? <ArrowUp className="h-3.5 w-3.5 shrink-0" /> : <ArrowDown className="h-3.5 w-3.5 shrink-0" />)
            : <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />}
        </button>
      </th>
    );
  };

  const call = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("send-dunning", { body });
    if (error || data?.error) throw new Error(data?.error ?? error?.message);
    return data;
  };
  const doPreview = async (p: any) => { try { setPreview((await call({ partner_ids: [p.partner_minimax_id], preview: true })).html); } catch (e: any) { toast.error(e.message); } };
  const send = async (ids: number[], test: boolean) => {
    if (!ids.length) return toast.error("Izaberite klijente");
    if (!test && !confirm(`Poslati opomenu za ${ids.length} klijenata na njihove email adrese?`)) return;
    setBusy(true);
    try {
      const r = await call({ partner_ids: ids, test });
      const { sent, failed } = summarizeResults(ids, r?.results);
      const warned = sent.filter((x) => x.warning);
      if (sent.length) toast.success(`Poslato: ${sent.length} od ${ids.length}`);
      if (failed.length || warned.length) setFailures([...failed, ...warned.map((x) => ({ ...x, error: `Poslato, ali: ${x.warning}` }))]);
      qc.invalidateQueries({ queryKey: ["mm-aging"] });
    } catch (e: any) {
      setFailures(ids.map((id) => ({ id, error: `Nije potvrđeno slanje: ${e.message}` })));
    } finally { setBusy(false); }
  };

  if (isLoading) return <Loader2 className="animate-spin" />;
  if (isError || !data) return (
    <Card className="p-6 space-y-3">
      <div className="flex items-center gap-2 text-destructive font-medium"><AlertTriangle className="h-4 w-4" />Spisak dužnika nije učitan.</div>
      <p className="text-sm text-muted-foreground">{(error as any)?.message ?? "Nepoznata greška"}. Ništa nije poslato.</p>
      <Button variant="outline" onClick={() => refetch()}>Pokušaj ponovo</Button>
    </Card>
  );
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-sm text-muted-foreground">Kupaca na spisku</div><div className="text-2xl font-semibold">{list.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">Ukupno otvoreno</div><div className="text-2xl font-semibold">{fmt(totals.open)}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">Van valute</div><div className="text-2xl font-semibold text-destructive">{fmt(totals.over)}</div></Card>
      </div>
      <p className="text-xs text-muted-foreground">Iznosi su iz otvorenih faktura u Minimaxu (stanje {d(data.today)}). Stari dug iz početnog stanja 2025. nije uključen dok ga knjigovođa ne potvrdi.</p>
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <Input placeholder="Pretraga kupca ili PIB-a" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <div className="inline-flex items-center rounded-md border p-0.5" role="group" aria-label="Filter dugovanja">
            <Button size="sm" variant={onlyOverdue ? "outline" : "default"} className="h-8 rounded-[5px] px-3 text-xs" onClick={() => setOnlyOverdue(false)}>Svi kupci</Button>
            <Button size="sm" variant={onlyOverdue ? "default" : "outline"} className="h-8 rounded-[5px] px-3 text-xs" onClick={() => setOnlyOverdue(true)}>Samo van valute</Button>
          </div>
          <div className="flex-1" />
          <Button variant="outline" disabled={busy} onClick={() => send([...sel], true)}><Mail className="h-4 w-4 mr-1" />Pošalji meni probu</Button>
          <Button disabled={busy || !sel.size} onClick={() => send([...sel], false)}>{busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Pošalji izabranima ({sel.size})</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {onlyOverdue
            ? <>{list.length} kupaca ima dug van valute. <button type="button" className="underline hover:text-foreground" onClick={() => setOnlyOverdue(false)}>{notOverdue} kupaca</button> ima otvorene fakture koje još nisu dospele — prikaži ih.</>
            : <>Prikazani su svi kupci sa otvorenim fakturama. {notOverdue} njih još nema dug van valute.</>}
          <span className="ml-1 opacity-70">Kliknite na naslov kolone (strelica) za sortiranje od najmanjeg ka najvećem ili obrnuto.</span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead><tr className="text-left text-muted-foreground border-b">
              <th className="w-10 px-3 py-2.5"><Checkbox checked={sel.size > 0 && list.every((p: any) => sel.has(p.partner_minimax_id))} onCheckedChange={(c) => setSel(c ? new Set(list.filter((p: any) => p.email).map((p: any) => p.partner_minimax_id)) : new Set())} /></th>
              {sortHead("partner", "Kupac")}
              <th className="px-3 py-2.5 min-w-[220px]">Kontakt / email</th>
              {sortHead("open_rsd", "Otvoreno", "right")}
              {sortHead("overdue_rsd", "Van valute", "right")}
              {sortHead("docs", "Faktura", "center")}
              {sortHead("max_days", "Najduže kasni", "center")}
              {sortHead("last_sent", "Poslednja opomena", "right")}
              <th className="w-12 px-3 py-2.5"></th></tr></thead>
            <tbody>{list.map((p: any) => (
              <tr key={p.partner_minimax_id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                <td className="px-3 py-2.5 align-top"><Checkbox checked={sel.has(p.partner_minimax_id)} onCheckedChange={() => toggle(p.partner_minimax_id)} /></td>
                <td className="px-3 py-2.5 align-middle max-w-[340px]"><button className="text-left hover:underline font-medium" onClick={() => setDetail(p)}>{p.partner}</button></td>
                <td className="px-3 py-2.5 align-middle"><div>{p.contact ?? "—"}</div><div className="text-xs text-muted-foreground break-all">{p.email ?? <Badge variant="outline">Nema email-a</Badge>}</div></td>
                <td className="px-3 py-2.5 align-middle text-right tabular-nums whitespace-nowrap">{fmt(p.open_rsd)}</td>
                <td className="px-3 py-2.5 align-middle text-right font-medium text-destructive tabular-nums whitespace-nowrap">{p.overdue_rsd > 0 ? fmt(p.overdue_rsd) : "—"}</td>
                <td className="px-3 py-2.5 align-middle text-center tabular-nums whitespace-nowrap">{p.overdue_docs}/{p.docs}</td>
                <td className="px-3 py-2.5 align-middle text-center">{p.max_days ? <Badge variant={p.max_days > 60 ? "destructive" : "outline"}>{p.max_days} dana</Badge> : "—"}</td>
                <td className="px-3 py-2.5 align-middle text-right text-xs tabular-nums">{p.last_sent ? new Date(p.last_sent).toLocaleDateString("sr-RS") : "—"}</td>
                <td className="px-3 py-2.5 align-middle text-right"><Button size="sm" variant="ghost" onClick={() => doPreview(p)} aria-label="Pregled"><Eye className="h-4 w-4" /></Button></td>
              </tr>))}</tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail?.partner}</DialogTitle></DialogHeader>
          {detail && <div className="space-y-4">
            <div className="text-sm">Otvoreno <b>{fmt(detail.open_rsd)}</b> · van valute <b className="text-destructive">{fmt(detail.overdue_rsd)}</b> · kontakt {detail.contact ?? "—"} ({detail.email ?? "nema email-a"})</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={detail.months}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="invoiced" name="Fakturisano" fill="hsl(var(--primary))" />
                  <Bar dataKey="paid" name="Uplaćeno" fill="hsl(var(--muted-foreground))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b"><th className="px-3 py-2">Broj</th><th className="px-3 py-2">Datum</th><th className="px-3 py-2">Rok</th><th className="px-3 py-2 text-right">Iznos</th><th className="px-3 py-2 text-right">Otvoreno</th><th className="px-3 py-2 text-center">Kasni</th></tr></thead>
              <tbody>{detail.invoices.map((i: any) => <tr key={i.number} className="border-b last:border-0 hover:bg-muted/40"><td className="px-3 py-2 whitespace-nowrap">{i.number}</td><td className="px-3 py-2 tabular-nums">{d(i.date)}</td><td className="px-3 py-2 tabular-nums">{d(i.due)}</td><td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(i.total)}</td><td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(i.open)}</td><td className="px-3 py-2 text-center">{i.days > 0 ? <Badge variant="destructive">{i.days} d</Badge> : "u roku"}</td></tr>)}</tbody>
            </table></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => doPreview(detail)}><Eye className="h-4 w-4 mr-1" />Pregled opomene</Button>
              <Button variant="outline" disabled={busy} onClick={() => send([detail.partner_minimax_id], true)}><Mail className="h-4 w-4 mr-1" />Proba meni</Button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl h-[90vh] p-2"><iframe title="Pregled opomene" srcDoc={preview ?? ""} className="w-full h-full rounded bg-background" /></DialogContent>
      </Dialog>
    </div>
  );
}
