import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, 
  FileStack, 
  Palette, 
  Layers, 
  TrendingUp, 
  Calendar,
  BarChart3,
  Zap,
  Target,
  Clock
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { sr } from "date-fns/locale";

const GRADIENT_COLORS = {
  primary: ["#6366f1", "#8b5cf6", "#a855f7"],
  success: ["#10b981", "#34d399", "#6ee7b7"],
  warning: ["#f59e0b", "#fbbf24", "#fcd34d"],
  info: ["#3b82f6", "#60a5fa", "#93c5fd"],
};

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#c084fc", "#d8b4fe"];

export const DigitalStatsSection = () => {
  // Fetch digital stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["digital-dashboard-stats"],
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const last30Days = subDays(now, 30);

      // Fetch all digital jobs with work orders for this month
      const { data: digitalJobs } = await supabase
        .from("digital_jobs")
        .select(`
          *,
          work_order:work_orders!inner(
            id,
            status,
            created_at,
            closed_at,
            client_id,
            clients(name)
          )
        `)
        .gte("work_order.created_at", monthStart.toISOString())
        .is("work_order.deleted_at", null);

      // Fetch digital work orders for chart data (last 30 days)
      const { data: recentOrders } = await supabase
        .from("work_orders")
        .select("id, status, created_at, closed_at, client_id")
        .eq("order_type", "digital")
        .is("deleted_at", null)
        .gte("created_at", last30Days.toISOString())
        .order("created_at", { ascending: true });

      // Calculate totals
      const totalSheets = digitalJobs?.reduce((sum, job) => sum + (job.computed_total_sheets || 0), 0) || 0;
      const totalColorClicks = digitalJobs?.reduce((sum, job) => sum + (job.computed_color_clicks || 0), 0) || 0;
      const totalMonoClicks = digitalJobs?.reduce((sum, job) => sum + (job.computed_mono_clicks || 0), 0) || 0;
      const totalJobs = digitalJobs?.length || 0;

      // Jobs this week
      const weekJobs = digitalJobs?.filter(job => {
        const createdAt = new Date(job.work_order?.created_at);
        return createdAt >= weekStart && createdAt <= weekEnd;
      }) || [];

      const weekSheets = weekJobs.reduce((sum, job) => sum + (job.computed_total_sheets || 0), 0);

      // Orders by status
      const openOrders = recentOrders?.filter(o => o.status === "open").length || 0;
      const closedOrders = recentOrders?.filter(o => o.status === "closed").length || 0;

      // Daily chart data (last 14 days)
      const last14Days = eachDayOfInterval({ start: subDays(now, 13), end: now });
      const dailyData = last14Days.map(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayJobs = digitalJobs?.filter(job => {
          const jobDate = format(new Date(job.work_order?.created_at), "yyyy-MM-dd");
          return jobDate === dayStr;
        }) || [];
        
        return {
          date: format(day, "dd.MM", { locale: sr }),
          tabaka: dayJobs.reduce((sum, job) => sum + (job.computed_total_sheets || 0), 0),
          klikovi: dayJobs.reduce((sum, job) => sum + (job.computed_color_clicks || 0) + (job.computed_mono_clicks || 0), 0),
        };
      });

      // Print sides distribution
      const printSidesCount: Record<string, number> = {};
      digitalJobs?.forEach(job => {
        const sides = job.print_sides || "4/0";
        printSidesCount[sides] = (printSidesCount[sides] || 0) + (job.computed_total_sheets || 0);
      });

      const printSidesData = Object.entries(printSidesCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Paper types distribution
      const paperTypesCount: Record<string, number> = {};
      digitalJobs?.forEach(job => {
        const paper = job.paper_type || "Neodređeno";
        paperTypesCount[paper] = (paperTypesCount[paper] || 0) + (job.computed_total_sheets || 0);
      });

      const paperTypesData = Object.entries(paperTypesCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Top clients this month
      const clientStats: Record<string, { name: string; sheets: number; jobs: number }> = {};
      digitalJobs?.forEach(job => {
        const clientId = job.work_order?.client_id;
        const clientName = job.work_order?.clients?.name || "Nepoznat";
        if (clientId) {
          if (!clientStats[clientId]) {
            clientStats[clientId] = { name: clientName, sheets: 0, jobs: 0 };
          }
          clientStats[clientId].sheets += job.computed_total_sheets || 0;
          clientStats[clientId].jobs += 1;
        }
      });

      const topClients = Object.values(clientStats)
        .sort((a, b) => b.sheets - a.sheets)
        .slice(0, 5);

      // Format distribution
      const formatCount: Record<string, number> = {};
      digitalJobs?.forEach(job => {
        const format = job.machine_sheet_format || "488x330";
        formatCount[format] = (formatCount[format] || 0) + (job.computed_total_sheets || 0);
      });

      const formatData = Object.entries(formatCount).map(([name, value]) => ({ name, value }));

      return {
        totalSheets,
        totalColorClicks,
        totalMonoClicks,
        totalJobs,
        weekSheets,
        weekJobs: weekJobs.length,
        openOrders,
        closedOrders,
        dailyData,
        printSidesData,
        paperTypesData,
        topClients,
        formatData,
        avgSheetsPerJob: totalJobs > 0 ? Math.round(totalSheets / totalJobs) : 0,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="col-span-12 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-12 space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
          <Printer className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Digitalna Štampa
          </h2>
          <p className="text-sm text-muted-foreground">Statistika za tekući mesec</p>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Sheets */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-xl shadow-indigo-500/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <FileStack className="h-8 w-8 opacity-80" />
              <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                Ovog meseca
              </Badge>
            </div>
            <div className="text-4xl font-bold tracking-tight">
              {stats?.totalSheets.toLocaleString("sr-RS")}
            </div>
            <p className="text-indigo-100 text-sm mt-1">Ukupno tabaka</p>
          </CardContent>
        </Card>

        {/* Color Clicks */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-xl shadow-purple-500/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <Palette className="h-8 w-8 opacity-80" />
              <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                Color
              </Badge>
            </div>
            <div className="text-4xl font-bold tracking-tight">
              {stats?.totalColorClicks.toLocaleString("sr-RS")}
            </div>
            <p className="text-purple-100 text-sm mt-1">Klikova u boji</p>
          </CardContent>
        </Card>

        {/* Mono Clicks */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-xl shadow-slate-500/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <Layers className="h-8 w-8 opacity-80" />
              <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                Mono
              </Badge>
            </div>
            <div className="text-4xl font-bold tracking-tight">
              {stats?.totalMonoClicks.toLocaleString("sr-RS")}
            </div>
            <p className="text-slate-300 text-sm mt-1">Mono klikova</p>
          </CardContent>
        </Card>

        {/* Total Jobs */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xl shadow-emerald-500/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <Target className="h-8 w-8 opacity-80" />
              <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                Stavki
              </Badge>
            </div>
            <div className="text-4xl font-bold tracking-tight">
              {stats?.totalJobs.toLocaleString("sr-RS")}
            </div>
            <p className="text-emerald-100 text-sm mt-1">Ukupno stavki</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.weekSheets.toLocaleString("sr-RS")}</p>
                <p className="text-xs text-muted-foreground">Tabaka ove nedelje</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.openOrders}</p>
                <p className="text-xs text-muted-foreground">Aktivnih naloga</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.closedOrders}</p>
                <p className="text-xs text-muted-foreground">Zatvorenih (30 dana)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                <Zap className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.avgSheetsPerJob}</p>
                <p className="text-xs text-muted-foreground">Prosek tab/stavka</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend Chart */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              Dnevni trend (14 dana)
            </CardTitle>
            <CardDescription>Tabaka i klikova po danu</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.dailyData || []}>
                  <defs>
                    <linearGradient id="colorTabaka" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorKlikovi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: 12, 
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))"
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="tabaka" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorTabaka)" 
                    name="Tabaka"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="klikovi" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorKlikovi)" 
                    name="Klikova"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Print Sides Distribution */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-500" />
              Pokrivenost štampe
            </CardTitle>
            <CardDescription>Distribucija po tipu štampe (tabaka)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.printSidesData || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    fill="#8884d8"
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {stats?.printSidesData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value.toLocaleString("sr-RS") + " tab.", "Količina"]}
                    contentStyle={{ 
                      borderRadius: 12, 
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))"
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Top Clients & Paper Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Clients */}
        <Card className="border shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Top klijenti (digitala)
            </CardTitle>
            <CardDescription>Po broju tabaka ovog meseca</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.topClients && stats.topClients.length > 0 ? (
                stats.topClients.map((client, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      index === 0 ? "bg-gradient-to-br from-amber-400 to-amber-600" :
                      index === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500" :
                      index === 2 ? "bg-gradient-to-br from-orange-400 to-orange-600" :
                      "bg-gradient-to-br from-slate-200 to-slate-400"
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.jobs} stavki</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-indigo-600">{client.sheets.toLocaleString("sr-RS")}</p>
                      <p className="text-xs text-muted-foreground">tabaka</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">Nema podataka za ovaj mesec</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Format Distribution */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileStack className="h-5 w-5 text-blue-500" />
              Format tabaka
            </CardTitle>
            <CardDescription>Distribucija po formatu</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.formatData || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number) => [value.toLocaleString("sr-RS"), "Tabaka"]}
                    contentStyle={{ 
                      borderRadius: 12, 
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))"
                    }} 
                  />
                  <Bar 
                    dataKey="value" 
                    fill="url(#formatGradient)"
                    radius={[0, 4, 4, 0]}
                  />
                  <defs>
                    <linearGradient id="formatGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
