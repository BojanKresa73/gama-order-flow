import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownRight, ArrowUpRight, Minus, BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MONTHS = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];

interface MonthRow {
  month: string; // YYYY-MM-DD
  plates: number;
  orders: number;
  ctp_orders: number;
}

interface Props {
  clientId: string;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function Delta({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return (
      <p className="text-xs text-muted-foreground mt-1">
        {label}: <span className="font-medium">novo (nema podataka)</span>
      </p>
    );
  }
  const rounded = Math.round(value * 10) / 10;
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : Minus;
  const color =
    rounded > 0 ? "text-emerald-600" : rounded < 0 ? "text-amber-600" : "text-muted-foreground";
  return (
    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
      {label}:
      <span className={`inline-flex items-center font-semibold ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        {rounded > 0 ? "+" : ""}
        {rounded.toLocaleString("sr-Latn", { maximumFractionDigits: 1 })}%
      </span>
    </p>
  );
}

export function PortalMonthlyStats({ clientId }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

  const { data = [], isLoading } = useQuery({
    queryKey: ["portal-monthly-stats", clientId, year],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_portal_monthly_stats", { p_year: year });
      if (error) throw error;
      return (data as unknown as MonthRow[]) ?? [];
    },
    staleTime: 300_000,
  });

  const byKey = useMemo(() => {
    const map = new Map<string, MonthRow>();
    data.forEach((r) => map.set(r.month.slice(0, 7), r));
    return map;
  }, [data]);

  const get = (y: number, m: number): MonthRow =>
    byKey.get(`${y}-${String(m + 1).padStart(2, "0")}`) ?? {
      month: "",
      plates: 0,
      orders: 0,
      ctp_orders: 0,
    };

  const isFuture = (y: number, m: number) =>
    y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth());

  // Selected month
  const cur = get(year, month);
  const prevMonthY = month === 0 ? year - 1 : year;
  const prevMonthM = month === 0 ? 11 : month - 1;
  const prevMonth = get(prevMonthY, prevMonthM);
  const lastYearSame = get(year - 1, month);

  // Kvartal (poređenje sa prethodnim kvartalom, isti broj meseci)
  const qStart = Math.floor(month / 3) * 3;
  const quarterNo = Math.floor(month / 3) + 1;
  const elapsed = month - qStart + 1;
  const qMonths: number[] = [];
  for (let m = qStart; m <= month; m++) qMonths.push(m);
  // Prethodni kvartal: poslednjih `elapsed` meseci prethodnog kvartala
  const prevQYear = qStart === 0 ? year - 1 : year;
  const prevQNo = qStart === 0 ? 4 : quarterNo - 1;
  const prevQEnd = qStart === 0 ? 11 : qStart - 1;
  const prevQMonths: number[] = [];
  for (let k = 0; k < elapsed; k++) prevQMonths.push(prevQEnd - k);
  const sumQ = (y: number, ms: number[], key: "plates" | "orders") =>
    ms.reduce((s, m) => s + get(y, m)[key], 0);
  const qPlatesCur = sumQ(year, qMonths, "plates");
  const qPlatesPrev = sumQ(prevQYear, prevQMonths, "plates");
  const qOrdersCur = sumQ(year, qMonths, "orders");
  const qOrdersPrev = sumQ(prevQYear, prevQMonths, "orders");
  const partialQuarter = elapsed < 3;
  const qLabel = partialQuarter
    ? `${quarterNo}. kvartal (${MONTHS[qStart].toLowerCase()} – ${MONTHS[month].toLowerCase()})`
    : `${quarterNo}. kvartal`;
  const prevQLabel = `${prevQNo}. kvartal ${prevQYear}.`;

  const chartData = MONTHS_SHORT.map((label, m) => ({
    name: label,
    [String(year)]: isFuture(year, m) ? null : get(year, m).plates,
    [String(year - 1)]: get(year - 1, m).plates,
  }));

  const yearOptions = [now.getFullYear(), now.getFullYear() - 1];

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            Mesečna statistika
          </CardTitle>
          <div className="flex gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((name, m) => (
                  <SelectItem key={m} value={String(m)} disabled={isFuture(year, m)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(year)}
              onValueChange={(v) => {
                const y = Number(v);
                setYear(y);
                if (isFuture(y, month)) setMonth(now.getMonth());
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              {/* Selected month */}
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {MONTHS[month]} {year}
                </p>
                <p className="text-3xl font-bold mt-1 leading-none">
                  {cur.plates.toLocaleString("sr-Latn")}
                  <span className="text-sm font-normal text-muted-foreground ml-1">ploča</span>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {cur.orders} {cur.orders === 1 ? "nalog" : "naloga"}
                </p>
                <Delta
                  value={pctChange(cur.plates, prevMonth.plates)}
                  label={`u odnosu na ${MONTHS[prevMonthM].toLowerCase()}`}
                />
                <Delta
                  value={pctChange(cur.plates, lastYearSame.plates)}
                  label={`u odnosu na ${MONTHS[month].toLowerCase()} ${year - 1}.`}
                />
              </div>

              {/* Same month last year */}
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {MONTHS[month]} {year - 1}
                </p>
                <p className="text-3xl font-bold mt-1 leading-none">
                  {lastYearSame.plates.toLocaleString("sr-Latn")}
                  <span className="text-sm font-normal text-muted-foreground ml-1">ploča</span>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {lastYearSame.orders} {lastYearSame.orders === 1 ? "nalog" : "naloga"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Isti mesec prošle godine</p>
              </div>

              {/* Quarter comparison */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {qLabel}
                </p>
                <div className="flex items-end gap-4 mt-1">
                  <div>
                    <p className="text-3xl font-bold leading-none">
                      {qPlatesCur.toLocaleString("sr-Latn")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{year}.</p>
                  </div>
                  <div className="text-muted-foreground pb-1">vs</div>
                  <div>
                    <p className="text-2xl font-semibold leading-none text-muted-foreground">
                      {qPlatesPrev.toLocaleString("sr-Latn")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{year - 1}.</p>
                  </div>
                </div>
                <Delta
                  value={pctChange(qPlatesCur, qPlatesPrev)}
                  label="ploče, isti period prošle godine"
                />
                <Delta
                  value={pctChange(qOrdersCur, qOrdersPrev)}
                  label={`nalozi (${qOrdersCur} vs ${qOrdersPrev})`}
                />
              </div>
            </div>

            <p className="text-sm font-medium mb-2">
              Potrošnja ploča po mesecima: {year}. u odnosu na {year - 1}.
            </p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number, name: string) => [`${v ?? 0} ploča`, `${name}.`]}
                  />
                  <Legend formatter={(v) => `${v}.`} />
                  <Bar dataKey={String(year - 1)} fill="hsl(var(--muted-foreground) / 0.45)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey={String(year)} fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Prikazani su CTP nalozi (ploče); broj naloga obuhvata sve vrste usluga.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
