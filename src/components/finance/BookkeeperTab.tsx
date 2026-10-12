import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileDown, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { buildIssues, CATEGORY_LABEL, categoryTotals, fmtRsd, Issue, IssueCategory } from "@/lib/bookkeeperReport";
import { exportExcel, exportPdf } from "@/lib/bookkeeperExport";

export function BookkeeperTab({ c, rec, pc }: { c: any; rec: any; pc: any }) {
  const qc = useQueryClient();
  const issues = useMemo(() => buildIssues(c, rec, pc), [c, rec, pc]);
  const { data: resRows = [] } = useQuery({
    queryKey: ["mm-resolutions"],
    queryFn: async () => { const { data, error } = await supabase.from("mm_review_resolutions").select("*"); if (error) throw error; return data; },
  });
  const res = useMemo(() => Object.fromEntries(resRows.map((r) => [r.issue_key, r])), [resRows]);
  const [cat, setCat] = useState<IssueCategory | "all">("all");
  const [status, setStatus] = useState<"all" | "open" | "done">("open");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Issue | null>(null);
  const [form, setForm] = useState({ doc: "", date: new Date().toISOString().slice(0, 10), note: "" });
  const [busy, setBusy] = useState(false);
  const totals = categoryTotals(issues);
  const date = new Date().toISOString().slice(0, 10);
  const profit = pc ? { year: pc.year, result: Number(pc.result) } : null;

  const shown = issues.filter((i) => (cat === "all" || i.category === cat)
    && (status === "all" || (status === "done") === !!res[i.key])
    && (!q || (i.title + i.question).toLowerCase().includes(q.toLowerCase())));

  async function save() {
    if (!sel || !form.doc.trim() || !form.date) return;
    setBusy(true);
    const { error } = await supabase.from("mm_review_resolutions").upsert({
      issue_key: sel.key, category: sel.category, title: sel.title, question: sel.question, amount_rsd: sel.amount,
      confirmation_document: form.doc.trim(), confirmed_on: form.date, note: form.note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error("Čuvanje nije uspelo");
    toast.success("Označeno kao razjašnjeno"); setSel(null); qc.invalidateQueries({ queryKey: ["mm-resolutions"] });
  }
  async function reopen(key: string) {
    const { error } = await supabase.from("mm_review_resolutions").delete().eq("issue_key", key);
    if (error) return toast.error("Nije uspelo"); qc.invalidateQueries({ queryKey: ["mm-resolutions"] });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <h2 className="font-medium">Izveštaj za knjigovođu</h2>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => exportPdf(issues, res, profit, date).catch(() => toast.error("PDF nije napravljen"))}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
            <Button variant="outline" onClick={() => exportExcel(issues, res, profit, date)}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          {(Object.keys(CATEGORY_LABEL) as IssueCategory[]).map((k) => (
            <button key={k} onClick={() => setCat(cat === k ? "all" : k)} className={`text-left rounded border p-2 ${cat === k ? "border-primary bg-accent" : ""}`}>
              <div className="text-muted-foreground text-xs">{CATEGORY_LABEL[k]}</div>
              <div className="font-medium">{totals[k]?.count ?? 0}{issues.some((i) => i.category === k && i.amount != null) ? ` · ${fmtRsd(totals[k]?.amount ?? 0)} RSD` : " · iznos nije poznat"}</div>
              <div className="text-xs text-muted-foreground">razjašnjeno {issues.filter((i) => i.category === k && res[i.key]).length}</div>
            </button>))}
        </div>
        <div className="flex flex-wrap gap-2">
          {([["open", "Otvoreno"], ["done", "Razjašnjeno"], ["all", "Sve"]] as const).map(([v, l]) => (
            <Button key={v} size="sm" variant={status === v ? "default" : "outline"} onClick={() => setStatus(v)}>{l}</Button>))}
          <Input className="max-w-xs h-9" placeholder="Pretraga partnera ili broja" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>

      <div className="space-y-2">
        {shown.map((i) => { const r = res[i.key]; return (
          <Card key={i.key} className="p-3 text-sm space-y-1">
            <div className="flex flex-wrap gap-2 items-start justify-between">
              <div className="font-medium break-words min-w-0">{i.title}</div>
              <div className="flex gap-2 items-center shrink-0">
                {i.amount != null && <span className="font-medium">{fmtRsd(i.amount)} RSD</span>}
                {r ? <Badge variant="secondary">Razjašnjeno</Badge> : <Badge variant="destructive">Otvoreno</Badge>}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">{CATEGORY_LABEL[i.category]} · {i.source}{i.detail ? ` · ${i.detail}` : ""}</div>
            <div><span className="text-muted-foreground">Pitanje: </span>{i.question}</div>
            {r ? (
              <div className="flex flex-wrap gap-2 items-center text-xs">
                <CheckCircle2 className="h-4 w-4 text-primary" />Potvrda: <b>{r.confirmation_document}</b>, {r.confirmed_on}{r.note ? ` · ${r.note}` : ""}
                <Button size="sm" variant="ghost" onClick={() => reopen(i.key)}>Vrati u otvoreno</Button>
              </div>
            ) : <Button size="sm" variant="outline" onClick={() => { setSel(i); setForm({ doc: "", date, note: "" }); }}>Označi kao razjašnjeno</Button>}
          </Card>); })}
        {!shown.length && <p className="text-sm text-muted-foreground">Nema stavki za izabrani filter.</p>}
      </div>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Označi kao razjašnjeno</DialogTitle></DialogHeader>
          <p className="text-sm">{sel?.title}</p>
          <p className="text-xs text-muted-foreground">Izvorna knjiženja i Minimax se ne menjaju; čuva se samo vaša potvrda.</p>
          <Input placeholder="Dokument potvrde (npr. dopis knjigovođe br. 12/2026)" value={form.doc} onChange={(e) => setForm({ ...form, doc: e.target.value })} />
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input placeholder="Napomena (nije obavezno)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <DialogFooter><Button disabled={busy || !form.doc.trim() || !form.date} onClick={save}>Sačuvaj</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
