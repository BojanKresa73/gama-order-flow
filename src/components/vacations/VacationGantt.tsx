import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VacationRequest } from "@/hooks/useVacations";
import { colorForUser, statusLabel } from "@/lib/vacationCalc";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props { requests: VacationRequest[]; }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];

export function VacationGantt({ requests }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const totalDays = Math.round((yearEnd.getTime() - yearStart.getTime()) / 86_400_000) + 1;

  const active = requests.filter((r) => r.status === "approved" || r.status === "pending");
  const byUser = new Map<string, { name: string; items: VacationRequest[] }>();
  active.forEach((r) => {
    if (new Date(r.end_date).getFullYear() < year || new Date(r.start_date).getFullYear() > year) return;
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, { name: r.user_name || "Nepoznat", items: [] });
    byUser.get(r.user_id)!.items.push(r);
  });
  const users = Array.from(byUser.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name, "sr"));

  const monthOffsets = useMemo(() => {
    const arr: number[] = [];
    for (let m = 0; m < 12; m++) {
      const d = new Date(year, m, 1);
      arr.push(Math.round((d.getTime() - yearStart.getTime()) / 86_400_000) / totalDays * 100);
    }
    return arr;
  }, [year, totalDays]);

  const barStyle = (r: VacationRequest) => {
    const start = new Date(Math.max(new Date(r.start_date).getTime(), yearStart.getTime()));
    const end = new Date(Math.min(new Date(r.end_date).getTime(), yearEnd.getTime()));
    const left = Math.round((start.getTime() - yearStart.getTime()) / 86_400_000) / totalDays * 100;
    const width = (Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1) / totalDays * 100;
    return { left: `${left}%`, width: `${width}%` };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setYear(year - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-lg font-semibold">{year}</div>
        <Button variant="outline" size="sm" onClick={() => setYear(year + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="relative h-8 border-b bg-muted/40">
          {MONTHS.map((m, i) => (
            <div key={m} className="absolute top-0 h-full flex items-center pl-2 text-xs font-medium border-l"
              style={{ left: `${monthOffsets[i]}%`, width: `${(monthOffsets[i + 1] ?? 100) - monthOffsets[i]}%` }}>
              {m}
            </div>
          ))}
        </div>
        <TooltipProvider>
          {users.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">Nema odsustava za {year}</div>
          )}
          {users.map(([uid, u]) => {
            const color = colorForUser(uid);
            return (
              <div key={uid} className="flex border-b last:border-b-0">
                <div className="w-40 shrink-0 p-2 text-sm font-medium border-r bg-background">{u.name}</div>
                <div className="relative flex-1 h-10">
                  {u.items.map((r) => (
                    <Tooltip key={r.id}>
                      <TooltipTrigger asChild>
                        <div
                          className="absolute top-1.5 h-7 rounded-md cursor-pointer"
                          style={{
                            ...barStyle(r),
                            background: color.bg,
                            border: `2px ${r.status === "pending" ? "dashed" : "solid"} ${color.border}`,
                            opacity: r.status === "pending" ? 0.65 : 1,
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs"><b>{u.name}</b><br />{statusLabel(r.status)} · {r.days_count} dana</div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
