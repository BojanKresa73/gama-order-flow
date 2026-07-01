import { Card, CardContent } from "@/components/ui/card";
import { Palmtree, Clock, AlertTriangle } from "lucide-react";
import { useMyBalance, useVacationRequests } from "@/hooks/useVacations";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/vacationCalc";

export function BalanceCard() {
  const year = new Date().getFullYear();
  const { data: balance } = useMyBalance(year);
  const { data: requests } = useVacationRequests();
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then((r) => setUid(r.data.user?.id ?? null));
  }, []);

  const remaining = balance ? balance.allocated - balance.used : 21;
  const carried = balance?.carried_over ?? 0;
  const pending = (requests ?? []).filter(
    (r) => r.user_id === uid && r.status === "pending"
  ).reduce((s, r) => s + r.days_count, 0);

  const carryExpires = balance?.carryover_expires_on;
  const carryExpired = carryExpires && new Date(carryExpires) < new Date();

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-start gap-3">
          <Palmtree className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <div className="text-xs text-muted-foreground">Preostalo {year}</div>
            <div className="text-2xl font-bold">{remaining}</div>
            <div className="text-xs text-muted-foreground">od {balance?.allocated ?? 21} dana</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Palmtree className="h-5 w-5 text-emerald-600 mt-0.5" />
          <div>
            <div className="text-xs text-muted-foreground">Preneseno iz {year - 1}</div>
            <div className={`text-2xl font-bold ${carryExpired ? "line-through text-muted-foreground" : ""}`}>
              {carried}
            </div>
            {carryExpires && (
              <div className={`text-xs ${carryExpired ? "text-destructive" : "text-muted-foreground"}`}>
                {carryExpired ? "isteklo" : `ističe ${formatDate(carryExpires)}`}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-500 mt-0.5" />
          <div>
            <div className="text-xs text-muted-foreground">Na čekanju</div>
            <div className="text-2xl font-bold">{pending}</div>
            <div className="text-xs text-muted-foreground">dana u zahtevima</div>
          </div>
        </div>
        {carried > 0 && !carryExpired && (
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <div className="text-xs text-muted-foreground">Podsetnik</div>
              <div className="text-sm">
                Iskoristi <b>{carried}</b> preneseno pre {carryExpires && formatDate(carryExpires)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
