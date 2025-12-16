import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, FileText, Layers, CheckCircle, Clock } from "lucide-react";

interface WorkOrder {
  id: string;
  created_by: string | null;
  created_by_name: string | null;
  closed_by: string | null;
  closed_by_name: string | null;
  status: string;
  total_plates: number;
  order_type: string;
}

interface WorkerProductivityStatsProps {
  workOrders: WorkOrder[];
  dateFrom: string;
  dateTo: string;
  allWorkers: { id: string; name: string }[];
}

interface WorkerStats {
  id: string;
  name: string;
  ordersOpened: number;
  ordersClosed: number;
  platesTotal: number;      // Pripremljeno - all plates on orders they opened
  platesClosed: number;     // Pušteno - plates on closed orders
  platesRemaining: number;  // Ostalo - plates on open orders
}

const WorkerProductivityStats = ({ workOrders, dateFrom, dateTo, allWorkers }: WorkerProductivityStatsProps) => {
  const workerStats = useMemo(() => {
    const statsMap = new Map<string, WorkerStats>();

    // Initialize all workers with zero stats
    allWorkers.forEach((worker) => {
      statsMap.set(worker.id, {
        id: worker.id,
        name: worker.name,
        ordersOpened: 0,
        ordersClosed: 0,
        platesTotal: 0,
        platesClosed: 0,
        platesRemaining: 0,
      });
    });

    workOrders.forEach((order) => {
      // Only count plates for CTP orders (plates are only relevant for CTP)
      const isCtp = order.order_type === "ctp";
      const platesToCount = isCtp ? order.total_plates : 0;

      // Track orders opened and plates prepared
      if (order.created_by && statsMap.has(order.created_by)) {
        const stats = statsMap.get(order.created_by)!;
        stats.ordersOpened += 1;
        stats.platesTotal += platesToCount;
        
        // Track remaining plates (on open orders created by this worker)
        if (order.status === "open") {
          stats.platesRemaining += platesToCount;
        }
      }

      // Track orders closed and plates released
      if (order.closed_by && order.status === "closed" && statsMap.has(order.closed_by)) {
        const stats = statsMap.get(order.closed_by)!;
        stats.ordersClosed += 1;
        stats.platesClosed += platesToCount;
      }
    });

    return Array.from(statsMap.values()).sort((a, b) =>
      (b.ordersOpened + b.ordersClosed) - (a.ordersOpened + a.ordersClosed)
    );
  }, [workOrders, allWorkers]);

  const totals = useMemo(() => {
    return workerStats.reduce(
      (acc, worker) => ({
        ordersOpened: acc.ordersOpened + worker.ordersOpened,
        ordersClosed: acc.ordersClosed + worker.ordersClosed,
        platesTotal: acc.platesTotal + worker.platesTotal,
        platesClosed: acc.platesClosed + worker.platesClosed,
        platesRemaining: acc.platesRemaining + worker.platesRemaining,
      }),
      { ordersOpened: 0, ordersClosed: 0, platesTotal: 0, platesClosed: 0, platesRemaining: 0 }
    );
  }, [workerStats]);

  const dateRangeText = dateFrom && dateTo 
    ? `${dateFrom} - ${dateTo}` 
    : dateFrom 
    ? `Od ${dateFrom}` 
    : dateTo 
    ? `Do ${dateTo}` 
    : "Svi podaci";

  if (allWorkers.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Produktivnost Radnika
          <span className="text-sm font-normal text-muted-foreground ml-2">
            ({dateRangeText})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">Otvorenih Naloga</span>
            </div>
            <p className="text-2xl font-bold">{totals.ordersOpened}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Zatvorenih Naloga</span>
            </div>
            <p className="text-2xl font-bold">{totals.ordersClosed}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
              <Layers className="h-4 w-4" />
              <span className="text-sm font-medium">Pripremljeno Ploča</span>
            </div>
            <p className="text-2xl font-bold">{totals.platesTotal}</p>
          </div>
          <div className="bg-teal-50 dark:bg-teal-950/30 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Pušteno Ploča</span>
            </div>
            <p className="text-2xl font-bold">{totals.platesClosed}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Ostalo Ploča</span>
            </div>
            <p className="text-2xl font-bold">{totals.platesRemaining}</p>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Radnik</TableHead>
                <TableHead className="text-center">Otvorenih</TableHead>
                <TableHead className="text-center">Zatvorenih</TableHead>
                <TableHead className="text-center">Pripremljeno</TableHead>
                <TableHead className="text-center">Pušteno</TableHead>
                <TableHead className="text-center">Ostalo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workerStats.map((worker) => (
                <TableRow key={worker.id}>
                  <TableCell className="font-medium">{worker.name}</TableCell>
                  <TableCell className="text-center">{worker.ordersOpened}</TableCell>
                  <TableCell className="text-center">{worker.ordersClosed}</TableCell>
                  <TableCell className="text-center">{worker.platesTotal}</TableCell>
                  <TableCell className="text-center">{worker.platesClosed}</TableCell>
                  <TableCell className="text-center">{worker.platesRemaining}</TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>UKUPNO</TableCell>
                <TableCell className="text-center">{totals.ordersOpened}</TableCell>
                <TableCell className="text-center">{totals.ordersClosed}</TableCell>
                <TableCell className="text-center">{totals.platesTotal}</TableCell>
                <TableCell className="text-center">{totals.platesClosed}</TableCell>
                <TableCell className="text-center">{totals.platesRemaining}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkerProductivityStats;
