import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/layout/AppHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertTriangle } from "lucide-react";
import { FreshnessSummary, FreshnessTab, useFreshness } from "@/components/finance/Freshness";
import { BookkeeperTab } from "@/components/finance/BookkeeperTab";
import { PROFIT_WARNING } from "@/lib/bookkeeperReport";
import { VatTab } from "@/components/finance/VatTab";
import { SyncPrompt } from "@/components/finance/SyncPrompt";

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

  const { data: rec } = useQuery({
    queryKey: ["mm-rec"], enabled: access === true,
    queryFn: async () => { const { data, error } = await supabase.rpc("mm_reconciliation" as any); if (error) throw error; return data as any; },
  });
  const { data: pc } = useQuery({
    queryKey: ["mm-profit-check", year], enabled: access === true,
    queryFn: async () => { const { data, error } = await supabase.rpc("mm_profit_check" as any, { p_year: year }); if (error) throw error; return data as any; },
  });

  const { data: fresh } = useFreshness(access === true);

  if (al) return <div className="p-8"><Loader2 className="animate-spin" /></div>;
  if (!access) return <><AppHeader /><div className="p-8 text-muted-foreground">Nemate pristup finansijskim podacima.</div></>;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <SyncPrompt />
      <main className="container mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Finansije – Gama United</h1>
          <p className="text-sm text-muted-foreground">Minimax organizacija 79412 · samo čitanje · podaci GDC i Gama Studio nisu uključeni</p>
        </div>
        {fresh && <FreshnessSummary f={fresh} />}
        {isLoading || !c ? <Loader2 className="animate-spin" /> : (
          <Tabs defaultValue="kontrola">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="kontrola">Kontrola podataka</TabsTrigger>
              <TabsTrigger value="azurnost">Ažurnost izvoda</TabsTrigger>
              <TabsTrigger value="provera">Potrebna provera ({c.review.length})</TabsTrigger>
              <TabsTrigger value="usaglasavanje">Usaglašavanje</TabsTrigger>
              <TabsTrigger value="banke">Banke</TabsTrigger>
              <TabsTrigger value="rezultat">Privremeni rezultat</TabsTrigger>
              <TabsTrigger value="pdv">PDV</TabsTrigger>
              <TabsTrigger value="knjigovodja">Izveštaj za knjigovođu</TabsTrigger>
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
                    {Math.abs(y.debit - y.credit) > 1 && <Badge variant="outline" className="ml-1">Razlika samo zbog prelaza godine – vidi Ažurnost izvoda</Badge>}</div>)}
                  <h3 className="font-medium mt-3">Po klasama konta</h3>
                  {c.accounts_by_class.map((a: any) => <div key={a.class}>Klasa {a.class}: saldo {fmt(a.balance)}</div>)}
                  <h3 className="font-medium mt-3">Valute</h3>
                  {c.currencies.map((x: any, i: number) => <span key={i} className="mr-3">{x.direction === "issued" ? "Izl." : "Ul."} {x.currency}: {x.count}</span>)}
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="provera">
              <Card className="p-4 overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]"><thead><tr className="text-left text-muted-foreground"><th>Partner</th><th>Broj</th><th>Datum</th><th>Valuta</th><th>Ukupno RSD</th><th>Problem</th><th>Povezana knjiženja</th><th>Šta proveriti</th></tr></thead>
                  <tbody>{c.review.map((r: any) => (
                    <tr key={r.direction + r.minimax_id} className="border-t align-top"><td>{r.partner}</td><td>{r.number}</td><td>{r.date}</td><td>{r.currency}</td><td>{fmt(r.total_rsd)}</td><td>{r.reason}</td>
                      <td>{r.journals.length ? r.journals.map((j: any) => <div key={j.id}>{j.type} {j.date}</div>) : "nema"}</td>
                      <td className="text-muted-foreground">{suggest(r)}</td></tr>))}</tbody></table>
              </Card>
            </TabsContent>

            <TabsContent value="usaglasavanje" className="space-y-4">
              {!rec ? <Loader2 className="animate-spin" /> : <>
                {(["kupci", "dobavljaci"] as const).map((k) => { const o = rec.open_items[k]; return (
                  <Card key={k} className="p-4 text-sm space-y-1">
                    <h2 className="font-medium">{k === "kupci" ? "Kupci – konto 204" : "Dobavljači – konto 435"}</h2>
                    <div>Prethodni iznos (zbir svih godina): <b>{fmt(o.previous)}</b></div>
                    <div>Uzrok: otvaranje {rec.first_year + 1}. ponavlja stavke iz {rec.first_year}. koje su već u knjizi – korekcija <b>−{fmt(o.carried_double)}</b></div>
                    <div>Novi iznos konta: <b>{fmt(o.new)}</b></div>
                    <div className="pt-1">Od toga: otvorene fakture <b>{fmt(o.docs_open)}</b> + početno stanje {rec.first_year}. (pre Minimax-a) <b>{fmt(o.opening_first_year)}</b> + neobjašnjeno <b>{fmt(o.unexplained)}</b></div>
                    <div className="text-muted-foreground">Kontrola: {fmt(o.docs_open)} + {fmt(o.opening_first_year)} + ({fmt(o.unexplained)}) = {fmt(o.new)} · izvor: nalog otvaranja {o.sources.map((x: any) => `${x.type} ${x.year}`).join(", ")}</div>
                    <table className="w-full mt-2"><thead><tr className="text-left text-muted-foreground"><th>Partner</th><th>Konto</th><th>Otvorene fakture</th><th>Početno {rec.first_year}.</th><th>Fakturisano</th><th>Uplate</th><th>Neobjašnjeno</th><th>Status</th></tr></thead>
                      <tbody>{(rec.partners[k] ?? []).slice(0, 40).map((p: any, i: number) => (
                        <tr key={i} className="border-t"><td>{p.partner}</td><td>{fmt(p.ledger)}</td><td>{fmt(p.docs_open)}</td><td>{fmt(p.opening)}</td><td>{fmt(p.invoiced)}</td><td>{fmt(p.payments)}</td><td>{fmt(p.residual)}</td>
                          <td>{Math.abs(p.residual) <= 10 ? (Math.abs(p.opening) > 1 ? <Badge variant="outline">Stari dug – potvrditi</Badge> : <Badge variant="secondary">Objašnjeno</Badge>) : <Badge variant="destructive">Potrebna provera</Badge>}</td></tr>))}</tbody></table>
                  </Card>); })}
                <p className="text-xs text-muted-foreground">Početna stanja se ne uklanjaju automatski i ne proglašavaju se nenaplativim – potvrđuje knjigovođa.</p>
              </>}
            </TabsContent>

            <TabsContent value="banke" className="space-y-4">
              {!rec ? <Loader2 className="animate-spin" /> : <>
                <Card className="p-4 text-sm overflow-x-auto">
                  <p className="mb-2"><Badge variant="destructive">Nije potvrđeno</Badge> {rec.bank_note}</p>
                  <table className="w-full"><thead><tr className="text-left text-muted-foreground"><th>Konto</th><th>Naziv</th><th>Vrsta</th><th>Početno</th><th>Duguje</th><th>Potražuje</th><th>Saldo</th><th>Poslednje knjiženje</th></tr></thead>
                    <tbody>{rec.banks.map((b: any) => <tr key={b.code} className="border-t"><td>{b.code}</td><td>{b.name}</td><td>{b.transit ? "Prelazni" : "Bankarski"}</td><td>{fmt(b.opening)}</td><td>{fmt(b.debit)}</td><td>{fmt(b.credit)}</td><td className="font-medium">{fmt(b.closing)}</td><td>{b.last_date}</td></tr>)}</tbody></table>
                </Card>
                <Card className="p-4 text-sm space-y-1 overflow-x-auto">
                  <h2 className="font-medium">Prelazni računi – uparivanje bez menjanja knjiženja</h2>
                  <div>Stavki: {rec.transit.rows} · isti iznos upareno: {rec.transit.paired} ({fmt(rec.transit.paired_amount)}) · devizne konverzije istog dana: {rec.transit.fx_paired} ({fmt(rec.transit.fx_paired_amount)}, razlika kursa {fmt(rec.transit.fx_diff_total)})</div>
                  <div>Neupareno: <b>{rec.transit.unpaired_count}</b> stavki, neto <b>{fmt(rec.transit.unpaired_net)}</b></div>
                  <table className="w-full mt-2"><thead><tr className="text-left text-muted-foreground"><th>Konto</th><th>Datum</th><th>Strana</th><th>Iznos</th><th>Opis</th></tr></thead>
                    <tbody>{rec.transit.unpaired.slice(0, 30).map((u: any, i: number) => <tr key={i} className="border-t"><td>{u.account}</td><td>{u.date}</td><td>{u.side === "D" ? "Duguje" : "Potražuje"}</td><td>{fmt(u.amount)}</td><td className="text-muted-foreground">{u.description}</td></tr>)}</tbody></table>
                </Card>
              </>}
            </TabsContent>

            <TabsContent value="azurnost">{fresh ? <FreshnessTab f={fresh} /> : <Loader2 className="animate-spin" />}</TabsContent>

            <TabsContent value="knjigovodja">
              {rec && pc ? <BookkeeperTab c={c} rec={rec} pc={pc} /> : <Loader2 className="animate-spin" />}
            </TabsContent>

            <TabsContent value="rezultat">
              <div className="mb-4 flex gap-2 items-start rounded border border-destructive/50 bg-destructive/10 p-3 text-sm"><AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" /><span>{PROFIT_WARNING}</span></div>
              {pc && <Card className="p-4 text-sm space-y-1 mb-4">
                <h2 className="font-medium">Provera rezultata {pc.year}. – privremeno prema dostupnim knjiženjima</h2>
                <div>Kontrolna vrednost: <b>{fmt(pc.check_value)}</b> · sada izračunato: <b>{fmt(pc.result)}</b> · zbir meseci: {fmt(pc.sum_of_months)} {Math.abs(pc.result - pc.sum_of_months) < 1 ? <Badge variant="secondary">Slaže se</Badge> : <Badge variant="destructive">Ne slaže se</Badge>}</div>
                <div>Uključeno: proknjiženi prihodi ({fmt(pc.revenue)}) i rashodi ({fmt(pc.expenses)}) klasa 6 i 5, bez zaključnih i početnih knjiženja; poslednje knjiženje {pc.last_entry}.</div>
                <div>Amortizacija knjižena: <b>{fmt(pc.depreciation_booked)}</b> (prethodna godina: {fmt(pc.depreciation_prev_year)}) {Number(pc.depreciation_booked) === 0 && <Badge variant="outline">Nije uključena</Badge>}</div>
                <div>Kursne razlike neto: {fmt(pc.fx_net)} · konta zaliha korišćena: {pc.inventory_accounts_used <= 2 ? "praktično ne (jedno knjiženje i njegov storno) – nabavka ploča ide direktno u trošak, lager na kraju perioda nije umanjio trošak" : pc.inventory_accounts_used} · dati avansi (150): {fmt(pc.advances_paid_150)}</div>
                <div className="text-muted-foreground">Računovodstvena dobit nije poreska osnovica (porez na dobit nije obračunat) niti novac na računu.</div>
              </Card>}
              <Card className="p-4 overflow-x-auto space-y-2">
                <div className="flex gap-2">{[2025, 2026].map((y) => <button key={y} onClick={() => setYear(y)} className={`px-3 py-1 rounded border text-sm ${y === year ? "bg-primary text-primary-foreground" : ""}`}>{y}</button>)}</div>
                <p className="text-xs text-muted-foreground">Iz konta glavne knjige (klase 5 i 6), bez zaključnih knjiženja. Privremeni rezultat, nije zvanični bilans.</p>
                <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Mesec</th><th>Prihodi</th><th>Rashodi</th><th>Materijal</th><th>Zarade</th><th>Proizv. usluge</th><th>Amortizacija</th><th>Ostalo</th><th>Rezultat</th><th>Napomene</th></tr></thead>
                  <tbody>{(profit ?? []).map((m: any) => (
                    <tr key={m.month} className="border-t"><td>{m.month}</td><td>{fmt(m.revenue)}</td><td>{fmt(m.expenses)}</td><td>{fmt(m.material)}</td><td>{fmt(m.salaries)}</td><td>{fmt(m.production_services)}</td><td>{fmt(m.depreciation)}</td><td>{fmt(m.other)}</td><td className="font-medium">{fmt(m.result)}</td>
                      <td className="space-x-1">{m.missing_depreciation && <Badge variant="outline">Nema amortizacije</Badge>}{m.unposted_docs > 0 && <Badge variant="destructive">{m.unposted_docs} neusagl. ulaznih</Badge>}</td></tr>))}</tbody></table>
              </Card>
            </TabsContent>

            <TabsContent value="pdv"><VatTab year={year} setYear={setYear} /></TabsContent>
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
