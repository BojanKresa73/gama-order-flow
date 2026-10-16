import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Mail, Send, Eye } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

const fmt = (v: unknown) => (v == null ? "—" : Number(v).toLocaleString("sr-RS", { maximumFractionDigits: 2 }));
const d = (s?: string) => (s ? s.split("-").reverse().join(".") + "." : "—");

export function DunningTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["mm-aging"],
    queryFn: async () => { const { data, error } = await supabase.rpc("mm_receivables_aging" as any); if (error) throw error; return data as any; },
  });
  const [search, setSearch] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(true);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<any>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => (data?.partners ?? []).filter((p: any) =>
    (!onlyOverdue || p.overdue_rsd > 0) &&
    (!search || `${p.partner} ${p.client_name ?? ""} ${p.pib ?? ""}`.toLowerCase().includes(search.toLowerCase()))), [data, search, onlyOverdue]);
  const totals = useMemo(() => list.reduce((a: any, p: any) => ({ open: a.open + p.open_rsd, over: a.over + p.overdue_rsd }), { open: 0, over: 0 }), [list]);

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
      const ok = r.results.filter((x: any) => !x.error).length;
      const bad = r.results.filter((x: any) => x.error);
      toast.success(`Poslato: ${ok}${bad.length ? `, nije poslato: ${bad.length}` : ""}`);
      bad.slice(0, 5).forEach((x: any) => toast.error(`${x.partner ?? x.id}: ${x.error}`));
      qc.invalidateQueries({ queryKey: ["mm-aging"] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (isLoading || !data) return <Loader2 className="animate-spin" />;
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
          <label className="flex items-center gap-2 text-sm"><Switch checked={onlyOverdue} onCheckedChange={setOnlyOverdue} /> Samo van valute</label>
          <div className="flex-1" />
          <Button variant="outline" disabled={busy} onClick={() => send([...sel], true)}><Mail className="h-4 w-4 mr-1" />Pošalji meni probu</Button>
          <Button disabled={busy || !sel.size} onClick={() => send([...sel], false)}>{busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Pošalji izabranima ({sel.size})</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead><tr className="text-left text-muted-foreground border-b">
              <th className="w-10 px-3 py-2.5"><Checkbox checked={sel.size > 0 && list.every((p: any) => sel.has(p.partner_minimax_id))} onCheckedChange={(c) => setSel(c ? new Set(list.filter((p: any) => p.email).map((p: any) => p.partner_minimax_id)) : new Set())} /></th>
              <th className="px-3 py-2.5">Kupac</th>
              <th className="px-3 py-2.5 min-w-[220px]">Kontakt / email</th>
              <th className="px-3 py-2.5 text-right">Otvoreno</th>
              <th className="px-3 py-2.5 text-right">Van valute</th>
              <th className="px-3 py-2.5 text-center">Faktura</th>
              <th className="px-3 py-2.5 text-center">Najduže kasni</th>
              <th className="px-3 py-2.5 text-right">Poslednja opomena</th>
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
