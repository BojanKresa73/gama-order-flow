import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

interface InvoiceStats {
  total: number;
  invoiced: number;
  notInvoiced: number;
  invoicedPercentage: number;
}

export function InvoiceStatsCard() {
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchInvoiceStats();
  }, []);

  const fetchInvoiceStats = async () => {
    try {
      // Use count queries to avoid the 1000-row default limit
      const baseFilter = supabase
        .from("work_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "closed")
        .is("deleted_at", null)
        .is("invalidated_at", null);

      const [totalRes, invoicedRes] = await Promise.all([
        baseFilter,
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "closed")
          .is("deleted_at", null)
          .is("invalidated_at", null)
          .not("invoiced_at", "is", null),
      ]);

      if (totalRes.error) throw totalRes.error;
      if (invoicedRes.error) throw invoicedRes.error;

      const total = totalRes.count || 0;
      const invoiced = invoicedRes.count || 0;
      const notInvoiced = total - invoiced;
      const invoicedPercentage = total > 0 ? Math.round((invoiced / total) * 100) : 0;

      setStats({ total, invoiced, notInvoiced, invoicedPercentage });
    } catch (error) {
      console.error("Error fetching invoice stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Fakturisanje
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Fakturisanje (zatvoreni nalozi)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fakturisano</span>
            <span className="font-medium">{stats?.invoicedPercentage}%</span>
          </div>
          <Progress value={stats?.invoicedPercentage || 0} className="h-2" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/work-orders?status=invoiced")}
            className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors text-left"
          >
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xl font-bold text-green-700 dark:text-green-400">
                {stats?.invoiced}
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">
                Fakturisano
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate("/work-orders?status=not_invoiced")}
            className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors text-left"
          >
            <XCircle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
                {stats?.notInvoiced}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Nije fakturisano
              </p>
            </div>
          </button>
        </div>

        {/* Total */}
        <div className="pt-2 border-t text-center">
          <p className="text-sm text-muted-foreground">
            Ukupno zatvorenih: <span className="font-medium text-foreground">{stats?.total}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
