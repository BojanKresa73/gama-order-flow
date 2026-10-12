import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/layout/AppHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

const fmt = (v: unknown) => (v == null ? "—" : Number(v).toLocaleString("sr-RS", { maximumFractionDigits: 2 }));
const KIND: Record<string, string> = {
  faktura: "Faktura", predracun: "Predračun", avansni_racun: "Avansni račun", storno: "Storno",
  knjizno_odobrenje: "Knjižno odobrenje kupcu", knjizno_odobrenje_dobavljaca: "Knjižno odobrenje dobavljača",
  avans_dobavljacu: "Avans dobavljaču", nacrt: "Nacrt",
};
const ENTITY: Record<string, string> = {
  customers: "Kupci i dobavljači", accounts: "Kontni plan", issuedinvoices: "Izlazni dokumenti",
  receivedinvoices: "Ulazni dokumenti", journal_details: "Stavke knjiženja", link_vat: "PDV ulaznih",
};

export default function FinanceControl() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: access, isLoading: al } = useQuery({
    queryKey: ["finance-access"], queryFn: async () => (await supabase.rpc("has_finance_access")).data === true,
  });
  const { data: c, isLoading } = useQuery({
    queryKey: ["mm-control"], enabled: access === true,
    queryFn: async () => { const { data, error } = await supabase.rpc("mm_control_summary" as any); if (error) throw error; return data as any; },
  });
  const { data: profit } = useQuery({
    queryKey: ["mm-profit", year], enabled: access === true,
    queryFn: async () => { const { data, error } = await supabase.rpc("mm_profit_by_month" as any, { p_year: year }); if (error) throw error; return (data ?? []) as any[]; },
  });

  if (al) return <div className="p-8"><Loader2 className="animate-spin" /></div>;
  if (!access) return <><AppHeader /><div className="p-8 text-muted-foreground">Nemate pristup finansijskim podacima.</div></>;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Finansije – Gama United</h1>
          <p className="text-sm text-muted-foreground">Minimax organizacija 79412 · samo čitanje · podaci GDC i Gama Studio nisu uključeni</p>
        </div>
        {isLoading || !c ? <Loader2 className="animate-spin" /> : (
          <Tabs defaultValue="kontrola">
            <TabsList>
              <TabsTrigger value="kontrola">Kontrola podataka</TabsTrigger>
              <TabsTrigger value="provera">Potrebna provera ({c.review.length})</TabsTrigger>
              <TabsTrigger value="rezultat">Privremeni rezultat</TabsTrigger>
            </TabsList>

            <TabsContent value="kontrola" className="space-y-4">
              <Card className="p-4">
                <h2 className="font-medium mb-2">Preuzimanje: baza vs Minimax</h2>
                <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Podaci</th><th>Minimax</th><th>U bazi</th><th>Stanje</th></tr></thead>
                  <tbody>{c.sync.map((s: any) => {
                    const ok = s.status === "done" && (s.remote == null || s.remote === s.local);
                    return <tr key={s.entity} className="border-t"><td>{ENTITY[s.entity] ?? s.entity.replace("journals_", "Nalozi za knjiženje ")}</td><td>{fmt(s.remote)}</td><td>{fmt(s.local)}</td>
                      <td>{ok ? <Badge variant="secondary">Usaglašeno</Badge> : <Badge variant="destructive">{s.error ?? s.status}</Badge>}</td></tr>;
                  })}</tbody></table>
              </Card>
              <Card className="p-4 overflow-x-auto">
                <h2 className="font-medium mb-2">Dokumenti po vrsti i godini (RSD)</h2>
                <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Smer</th><th>God.</th><th>Vrsta</th><th>Broj</th><th>Ukupno</th><th>Plaćeno</th><th>Otvoreno</th><th>Provera</th></tr></thead>
                  <tbody>{c.docs.map((d: any, i: number) => (
                    <tr key={i} className="border-t"><td>{d.direction === "issued" ? "Izlazni" : "Ulazni"}</td><td>{d.year}</td><td>{KIND[d.kind] ?? d.kind}</td><td>{d.count}</td>
                      <td>{fmt(d.total_rsd)}{d.unknown_total ? <Badge variant="destructive" className="ml-1">{d.unknown_total} bez iznosa</Badge> : null}</td>
                      <td>{fmt(d.paid_rsd)}</td><td>{fmt(d.open_rsd)}</td><td>{d.needs_review ? <Badge variant="destructive">{d.needs_review}</Badge> : "—"}</td></tr>))}</tbody></table>
                <p className="text-xs text-muted-foreground mt-2">Predračuni i avansni računi ne ulaze u prihod; knjižna odobrenja i storna umanjuju prihod jednom i nisu priliv novca.</p>
              </Card>
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-4 text-sm space-y-1">
                  <h2 className="font-medium mb-2">Otvorena potraživanja i obaveze</h2>
                  {[["Potraživanja (dokumenti)", c.open_docs.receivables, "Kupci 204 (knjiga)", c.open_ledger.receivables_204],
                    ["Obaveze (dokumenti)", c.open_docs.payables, "Dobavljači 435 (knjiga)", c.open_ledger.payables_435]].map(([a, av, b, bv]) => {
                    const diff = av != null && bv != null ? Math.abs(Number(av) - Number(bv)) : null;
                    return <div key={String(a)} className="flex flex-wrap gap-2 items-center"><span>{a}: <b>{fmt(av)}</b></span><span>{b}: <b>{fmt(bv)}</b></span>
                      {diff != null && diff > 1 ? <Badge variant="destructive">Razlika {fmt(diff)} – nije potvrđeno</Badge> : <Badge variant="secondary">Slaže se</Badge>}</div>;
                  })}
                  <div>Primljeni avansi 430: <b>{fmt(c.open_ledger.advances_received_430)}</b></div>
                  <div>Banka 241 (saldo): <b>{fmt(c.open_ledger.bank_241)}</b></div>
                </Card>
                <Card className="p-4 text-sm">
                  <h2 className="font-medium mb-2">Glavna knjiga</h2>
                  {c.ledger_years.map((y: any) => <div key={y.year}>{y.year}: {fmt(y.rows)} stavki · duguje {fmt(y.debit)} · potražuje {fmt(y.credit)}
                    {Math.abs(y.debit - y.credit) > 1 && <Badge variant="destructive" className="ml-1">Neuravnoteženo</Badge>}</div>)}
                  <h3 className="font-medium mt-3">Po klasama konta</h3>
                  {c.accounts_by_class.map((a: any) => <div key={a.class}>Klasa {a.class}: saldo {fmt(a.balance)}</div>)}
                  <h3 className="font-medium mt-3">Valute</h3>
                  {c.currencies.map((x: any, i: number) => <span key={i} className="mr-3">{x.direction === "issued" ? "Izl." : "Ul."} {x.currency}: {x.count}</span>)}
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="provera">
              <Card className="p-4 overflow-x-auto">
                <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Partner</th><th>Broj</th><th>Datum</th><th>Valuta</th><th>Ukupno RSD</th><th>Problem</th><th>Povezana knjiženja</th><th>Šta proveriti</th></tr></thead>
                  <tbody>{c.review.map((r: any) => (
                    <tr key={r.direction + r.minimax_id} className="border-t align-top"><td>{r.partner}</td><td>{r.number}</td><td>{r.date}</td><td>{r.currency}</td><td>{fmt(r.total_rsd)}</td><td>{r.reason}</td>
                      <td>{r.journals.length ? r.journals.map((j: any) => <div key={j.id}>{j.type} {j.date}</div>) : "nema"}</td>
                      <td className="text-muted-foreground">{suggest(r)}</td></tr>))}</tbody></table>
              </Card>
            </TabsContent>

            <TabsContent value="rezultat">
              <Card className="p-4 overflow-x-auto space-y-2">
                <div className="flex gap-2">{[2025, 2026].map((y) => <button key={y} onClick={() => setYear(y)} className={`px-3 py-1 rounded border text-sm ${y === year ? "bg-primary text-primary-foreground" : ""}`}>{y}</button>)}</div>
                <p className="text-xs text-muted-foreground">Iz konta glavne knjige (klase 5 i 6), bez zaključnih knjiženja. Privremeni rezultat, nije zvanični bilans.</p>
                <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Mesec</th><th>Prihodi</th><th>Rashodi</th><th>Materijal</th><th>Zarade</th><th>Proizv. usluge</th><th>Amortizacija</th><th>Ostalo</th><th>Rezultat</th><th>Napomene</th></tr></thead>
                  <tbody>{(profit ?? []).map((m: any) => (
                    <tr key={m.month} className="border-t"><td>{m.month}</td><td>{fmt(m.revenue)}</td><td>{fmt(m.expenses)}</td><td>{fmt(m.material)}</td><td>{fmt(m.salaries)}</td><td>{fmt(m.production_services)}</td><td>{fmt(m.depreciation)}</td><td>{fmt(m.other)}</td><td className="font-medium">{fmt(m.result)}</td>
                      <td className="space-x-1">{m.missing_depreciation && <Badge variant="outline">Nema amortizacije</Badge>}{m.unposted_docs > 0 && <Badge variant="destructive">{m.unposted_docs} neusagl. ulaznih</Badge>}</td></tr>))}</tbody></table>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

function suggest(r: any) {
  if (r.reason?.startsWith("Nacrt")) return "Proknjižiti ili obrisati nacrt u Minimax-u.";
  if (r.reason?.startsWith("Ukupno 0")) return "Proveriti da li postoji avans/uplata; bez dokaza se ne smatra zatvorenim.";
  if (r.currency && r.currency !== "RSD") return "Proveriti kurs i PDV evidenciju dokumenta u stranoj valuti.";
  if (r.reason?.startsWith("Nema")) return "Proveriti da li je dokument proknjižen (PR knjiženje).";
  return "Uporediti PDV evidenciju sa iznosom dokumenta.";
}
