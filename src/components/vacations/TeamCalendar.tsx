import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VacationRequest } from "@/hooks/useVacations";
import { useVacationHolidays } from "@/hooks/useVacations";
import { colorForUser, statusLabel } from "@/lib/vacationCalc";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  requests: VacationRequest[];
}

export function TeamCalendar({ requests }: Props) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const { data: holidays = [] } = useVacationHolidays();
  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.holiday_date)), [holidays]);

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const activeRequests = requests.filter(
    (r) => r.status === "approved" || r.status === "pending"
  );

  // group by user
  const usersMap = new Map<string, { name: string; requests: VacationRequest[] }>();
  activeRequests.forEach((r) => {
    if (!usersMap.has(r.user_id)) usersMap.set(r.user_id, { name: r.user_name || "Nepoznat", requests: [] });
    usersMap.get(r.user_id)!.requests.push(r);
  });
  const users = Array.from(usersMap.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name, "sr"));

  const isInRange = (r: VacationRequest, day: number) => {
    const cur = new Date(month.getFullYear(), month.getMonth(), day);
    const start = new Date(r.start_date);
    const end = new Date(r.end_date);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return cur >= start && cur <= end;
  };

  const isWeekend = (day: number) => {
    const d = new Date(month.getFullYear(), month.getMonth(), day).getDay();
    return d === 0 || d === 6;
  };

  const iso = (day: number) =>
    new Date(month.getFullYear(), month.getMonth(), day).toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-lg font-semibold capitalize">
          {month.toLocaleDateString("sr-RS", { month: "long", year: "numeric" })}
        </div>
        <Button variant="outline" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <TooltipProvider>
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-2 sticky left-0 bg-muted/40 min-w-[160px]">Zaposleni</th>
                {days.map((d) => (
                  <th
                    key={d}
                    className={`text-center p-1 w-8 ${isWeekend(d) ? "bg-muted" : ""} ${holidaySet.has(iso(d)) ? "bg-destructive/10 text-destructive" : ""}`}
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={days.length + 1} className="text-center text-muted-foreground py-6">
                    Nema odsustava u ovom mesecu
                  </td>
                </tr>
              )}
              {users.map(([uid, u]) => {
                const color = colorForUser(uid);
                return (
                  <tr key={uid} className="border-b">
                    <td className="p-2 font-medium sticky left-0 bg-background">{u.name}</td>
                    {days.map((d) => {
                      const req = u.requests.find((r) => isInRange(r, d));
                      const cellBg = isWeekend(d) ? "bg-muted/30" : holidaySet.has(iso(d)) ? "bg-destructive/5" : "";
                      if (!req) return <td key={d} className={`h-8 ${cellBg}`} />;
                      const isPending = req.status === "pending";
                      return (
                        <td key={d} className={`h-8 p-0 ${cellBg}`}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="h-full w-full"
                                style={{
                                  background: color.bg,
                                  borderTop: `3px solid ${color.border}`,
                                  borderBottom: `3px solid ${color.border}`,
                                  opacity: isPending ? 0.55 : 1,
                                  borderStyle: isPending ? "dashed" : "solid",
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs">
                                <b>{u.name}</b><br />
                                {statusLabel(req.status)} · {req.days_count} dana
                                {req.reason && <><br /><span className="text-muted-foreground">{req.reason}</span></>}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TooltipProvider>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-muted rounded" /> vikend</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-destructive/10 rounded" /> praznik</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: "hsl(200 70% 88%)", borderTop: "3px solid hsl(200 60% 55%)", borderBottom: "3px solid hsl(200 60% 55%)" }} /> odobreno</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: "hsl(200 70% 88%)", borderTop: "3px dashed hsl(200 60% 55%)", borderBottom: "3px dashed hsl(200 60% 55%)", opacity: 0.55 }} /> na čekanju</span>
      </div>
    </div>
  );
}
