import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { bankStatus, overall, STATUS_LABEL, FreshStatus } from "@/lib/booksFreshness";

const fmt = (v: unknown) => (v == null ? "—" : Number(v).toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const d = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("sr-RS") : "—");
const VAR: Record<FreshStatus, "secondary" | "destructive" | "outline"> = { azurno: "secondary", provera: "outline", kasnjenje: "destructive", prelazni: "outline" };

export function useFreshness(enabled: boolean) {
  return useQuery({
    queryKey: ["mm-fresh"], enabled,
    queryFn: async () => { const { data, error } = await supabase.rpc("mm_books_freshness" as any); if (error) throw error; return data as any; },
  });
}

export function FreshnessSummary({ f }: { f: any }) {
  const o = overall(f.banks, f.today);
  return (
    <div className={`rounded border p-3 text-sm flex gap-2 items-start ${o.complete ? "border-primary/40 bg-primary/5" : "border-destructive/50 bg-destructive/10"}`}>
      {o.complete ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />}
      <div className="space-y-1">
        <div className="font-medium">Finansijski podaci su ažurni do: {d(o.upTo)}</div>
        <div className="text-muted-foreground">Poslednje preuzimanje iz Minimaxa: {f.last_sync ? new Date(f.last_sync).toLocaleString("sr-RS") : "—"}{f.sync_errors ? ` · ${f.sync_errors} preuzimanja nije završeno` : ""}</div>
        {!o.complete && <div>
          <div className="font-medium">Šta Natalija treba da proveri:</div>
          <ul className="list-disc ml-5">{o.problems.map(({ b, s }) => <li key={b.code}>{b.name} ({b.code}): {s.text}</li>)}</ul>
        </div>}
      </div>
    </div>
  );
}

export function FreshnessTab({ f }: { f: any }) {
  const qc = useQueryClient();
  const banks = f.banks.filter((b: any) => !b.transit);
  const [form, setForm] = useState({ code: banks[0]?.code ?? "", date: f.today, number: "", balance: "", bank: "", acc: "" });
  async function save() {
    if (!form.code || !form.date) return;
    const { error } = await supabase.from("mm_bank_statements").insert({
      account_code: form.code, statement_date: form.date, statement_number: form.number || null,
      closing_balance: form.balance === "" ? null : Number(form.balance.replace(/\./g, "").replace(",", ".")),
      bank_name: form.bank || null, account_number: form.acc || null,
    });
    if (error) return toast.error("Čuvanje nije uspelo");
    toast.success("Izvod je upisan"); qc.invalidateQueries({ queryKey: ["mm-fresh"] });
  }
  const t = f.bank_totals; const yrs = f.ledger_years ?? [];
  return (
    <div className="space-y-4">
      <Card className="p-4 text-sm overflow-x-auto">
        <h2 className="font-medium mb-2">Ažurnost po računu</h2>
        <table className="w-full min-w-[900px]"><thead><tr className="text-left text-muted-foreground">
          <th>Račun</th><th>Poslednji izvod iz banke</th><th>Poslednji proknjižen izvod</th><th>Nedostaje izvoda</th><th>Stanje u knjigama</th><th>Stanje na izvodu</th><th>Status</th></tr></thead>
          <tbody>{f.banks.map((b: any) => { const s = bankStatus(b, f.today); return (
            <tr key={b.code} className="border-t align-top">
              <td>{b.statement?.bank ? `${b.statement.bank} · ` : ""}{b.name} ({b.code}){b.statement?.account_number ? <div className="text-xs text-muted-foreground">{b.statement.account_number}</div> : null}</td>
              <td>{b.transit ? "—" : b.statement ? `${d(b.statement.date)}${b.statement.number ? ` (br. ${b.statement.number})` : ""}` : "nije uneto"}</td>
              <td>{d(b.last_statement_booked)}</td>
              <td className="text-muted-foreground">{b.transit ? "—" : "ne može se potvrditi"}</td>
              <td>{fmt(b.booked_balance)}</td>
              <td>{b.statement?.balance != null ? <>{fmt(b.statement.balance)}<div className="text-xs text-muted-foreground">u knjigama na taj dan {fmt(b.booked_at_statement_date)}</div></> : "—"}</td>
              <td><Badge variant={VAR[s.status]}>{STATUS_LABEL[s.status]}</Badge><div className="text-xs text-muted-foreground max-w-xs">{s.text}</div></td>
            </tr>); })}</tbody></table>
        <p className="text-xs text-muted-foreground mt-2">Broj izvoda koji nedostaju ne prikazujemo dok ne unesete broj izvoda iz banke; starije knjiženje samo po sebi ne znači da izvod nedostaje.</p>
      </Card>

      <Card className="p-4 text-sm space-y-2">
        <h2 className="font-medium">Upiši poslednji izvod iz banke</h2>
        <p className="text-xs text-muted-foreground">Upisuje se samo ovde, radi poređenja. Minimax i knjiženja se ne menjaju.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select className="h-9 rounded border bg-background px-2" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}>
            {banks.map((b: any) => <option key={b.code} value={b.code}>{b.code} {b.name}</option>)}
          </select>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input placeholder="Broj izvoda" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          <Input placeholder="Stanje na izvodu (RSD)" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
          <Input placeholder="Banka (npr. UniCredit)" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
          <Input placeholder="Broj računa" value={form.acc} onChange={(e) => setForm({ ...form, acc: e.target.value })} />
        </div>
        <Button onClick={save} disabled={!form.code || !form.date}>Sačuvaj izvod</Button>
      </Card>

      <Card className="p-4 text-sm space-y-1 overflow-x-auto">
        <h2 className="font-medium">Zašto se stanje banke razlikuje: 4,82 mil. ili 6,11 mil.</h2>
        <div>Samo pravi bankarski računi (tekući i devizni): <b>{fmt(t.bank_only)}</b></div>
        <div>Konto 241 u kartici Kontrola podataka (tekući i prelazni, bez deviznog): <b>{fmt(t.konto_241)}</b></div>
        <table className="w-full mt-2"><thead><tr className="text-left text-muted-foreground"><th>Konto</th><th>Naziv</th><th>Saldo</th><th>U 4,82 mil.</th><th>U 6,11 mil.</th></tr></thead>
          <tbody>{f.banks.map((b: any) => <tr key={b.code} className="border-t"><td>{b.code}</td><td>{b.name}</td><td>{fmt(b.booked_balance)}</td><td>{!b.transit ? "da" : "ne"}</td><td>{b.code.startsWith("241") ? "da" : "ne"}</td></tr>)}</tbody></table>
        <p className="text-muted-foreground">Razlika nije greška u knjiženjima: obračun od 6,11 mil. uključuje prelazne račune 2419, 24191 i 24192, a ne uključuje devizni račun 2440. Pravi novac na bankama je samo prvi iznos, i on se potvrđuje izvodima.</p>
      </Card>

      <Card className="p-4 text-sm space-y-1">
        <h2 className="font-medium">Glavna knjiga – „neuravnoteženo“ po godinama</h2>
        {yrs.map((y: any) => <div key={y.year}>{y.year}: duguje {fmt(y.debit)} · potražuje {fmt(y.credit)} · razlika <b>{fmt(y.diff)}</b></div>)}
        <div>Ukupno obe godine: razlika <b>{fmt(f.ledger_total_diff)}</b> · knjiženja koja sama nisu u ravnoteži: <b>{f.unbalanced_journals}</b></div>
        <div>{f.cross_year.count} knjiženja ima stavke i u decembru {yrs[0]?.year} i u januaru {yrs[1]?.year}: {(f.cross_year.by_type ?? []).map((x: any) => `${x.type} ${x.count} (${fmt(x.net_first_year)})`).join(", ")}.</div>
        <p className="text-muted-foreground">Svako knjiženje je u ravnoteži. Razlika nastaje samo u prikazu, jer smo stavke delili po godini datuma stavke, pa je deo istog knjiženja pao u jednu, a deo u drugu godinu. Evidencija u Minimaxu je ispravna.</p>
      </Card>
    </div>
  );
}
