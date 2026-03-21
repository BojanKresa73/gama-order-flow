import { Card, CardContent } from "@/components/ui/card";
import { FileText, CheckCircle2, Clock, Layers } from "lucide-react";

interface PortalOrderStatsProps {
  orders: {
    status: string;
    created_at: string;
    closed_at: string | null;
    total_plates: number;
    order_type: string;
  }[];
}

export function PortalOrderStats({ orders }: PortalOrderStatsProps) {
  const openCount = orders.filter((o) => o.status === "open").length;
  const closedCount = orders.filter((o) => o.status === "closed").length;

  // Average processing time for closed orders (in hours)
  const closedOrders = orders.filter((o) => o.status === "closed" && o.closed_at);
  let avgHours = 0;
  if (closedOrders.length > 0) {
    const totalMs = closedOrders.reduce((sum, o) => {
      const created = new Date(o.created_at).getTime();
      const closed = new Date(o.closed_at!).getTime();
      return sum + (closed - created);
    }, 0);
    avgHours = totalMs / closedOrders.length / (1000 * 60 * 60);
  }

  // Total plates this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyPlates = orders
    .filter((o) => new Date(o.created_at) >= monthStart)
    .reduce((sum, o) => sum + o.total_plates, 0);

  const stats = [
    {
      icon: FileText,
      label: "Otvoreni",
      value: openCount,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      icon: CheckCircle2,
      label: "Zatvoreni",
      value: closedCount,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/30",
    },
    {
      icon: Clock,
      label: "Prosečna obrada",
      value: avgHours < 24
        ? `${Math.round(avgHours)}h`
        : `${(avgHours / 24).toFixed(1)}d`,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      icon: Layers,
      label: "Ploča ovog meseca",
      value: monthlyPlates,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map((stat, i) => (
        <Card key={i} className="border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stat.bg}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
