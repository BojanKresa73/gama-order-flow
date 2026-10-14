import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const fmt = (n: any) => n == null ? "—" : Number(n).toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function VatTab({ year, setYear }: { year: number; setYear: (y: number) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["mm-vat", year],
    queryFn: async () => { const { data, error } = await supabase.rpc("mm_vat_by_month" as any, { p_year: year }); if (error) throw error; return data as any; },
  });
  const months: any[] = data?.months ?? [];
  const cur = months[months.length - 1];
  return (
    <div className="space-y-4">
      <div className="flex gap-2">{[2025, 2026].map((y) => <button key={y} onClick={() => setYear(y)} className={`px-3 py-1 rounded border text-sm ${y === year ? "bg-primary text-primary-foreground" : ""}`}>{y}</button>)}</div>
      {isLoading ? <Loader2 className="animate-spin" /> : <>
        {cur && <Card className="p-4 text-sm space-y-1">
          <h2 className="font-medium">Trenutni PDV – {cur.month} (privremeno)</h2>
          <div>Izlazni PDV: <b>{fmt(cur.output_vat)}</b> · Ulazni (prethodni) PDV: <b>{fmt(cur.input_vat)}</b></div>
          <div className="text-base">{cur.net >= 0 ? "Za uplatu" : "Poreski kredit"}: <b>{fmt(Math.abs(cur.net))} RSD</b></div>
          <div className="text-muted-foreground">Mesec je nepotpun dok knjigovođa ne proknjiži sve fakture. Konačan iznos je PP PDV prijava. Nezatvorena obaveza za PDV na kontu 4790: {fmt(data.unpaid_4790)}.</div>
        </Card>}
        <Card className="p-4 overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Mesec</th><th>Izlazni PDV</th><th>Ulazni PDV</th><th>Neto (+ uplata / − kredit)</th><th>Knjigovođa zatvorio</th><th>Status</th></tr></thead>
            <tbody>{months.map((m) => (
              <tr key={m.month} className="border-t"><td>{m.month}</td><td>{fmt(m.output_vat)}</td><td>{fmt(m.input_vat)}</td><td className="font-medium">{fmt(m.net)}</td><td>{m.closing_present ? fmt(m.booked_closing) : "—"}</td>
                <td>{!m.closing_present ? <Badge variant="outline">Nije zatvoren</Badge> : Math.abs(m.difference) < 5 ? <Badge variant="secondary">Slaže se</Badge> : <Badge variant="destructive">Razlika {fmt(m.difference)}</Badge>}</td></tr>))}</tbody></table>
          <p className="text-xs text-muted-foreground mt-2">{data?.source}</p>
        </Card>
      </>}
    </div>
  );
}
