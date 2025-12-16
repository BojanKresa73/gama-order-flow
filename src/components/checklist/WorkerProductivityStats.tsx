import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, FileText, Layers, CheckCircle } from "lucide-react";

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
  platesOpened: number;
  platesClosed: number;
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
        platesOpened: 0,
        platesClosed: 0,
      });
    });

    workOrders.forEach((order) => {
      // Track orders opened (plates prepared)
      if (order.created_by && statsMap.has(order.created_by)) {
        const stats = statsMap.get(order.created_by)!;
        stats.ordersOpened += 1;
        stats.platesOpened += order.total_plates;
      }

      // Track orders closed (plates consumed - from file_entries on closed orders)
      if (order.closed_by && order.status === "closed" && statsMap.has(order.closed_by)) {
        const stats = statsMap.get(order.closed_by)!;
        stats.ordersClosed += 1;
        stats.platesClosed += order.total_plates;
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
        platesOpened: acc.platesOpened + worker.platesOpened,
        platesClosed: acc.platesClosed + worker.platesClosed,
      }),
      { ordersOpened: 0, ordersClosed: 0, platesOpened: 0, platesClosed: 0 }
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
            <p className="text-2xl font-bold">{totals.platesOpened}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
              <Layers className="h-4 w-4" />
              <span className="text-sm font-medium">Pušteno Ploča</span>
            </div>
            <p className="text-2xl font-bold">{totals.platesClosed}</p>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Radnik</TableHead>
                <TableHead className="text-center">Otvorenih Naloga</TableHead>
                <TableHead className="text-center">Zatvorenih Naloga</TableHead>
                <TableHead className="text-center">Pripremljeno Ploča</TableHead>
                <TableHead className="text-center">Pušteno Ploča</TableHead>
                <TableHead className="text-center">Ukupno Aktivnosti</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workerStats.map((worker) => (
                <TableRow key={worker.id}>
                  <TableCell className="font-medium">{worker.name}</TableCell>
                  <TableCell className="text-center">{worker.ordersOpened}</TableCell>
                  <TableCell className="text-center">{worker.ordersClosed}</TableCell>
                  <TableCell className="text-center">{worker.platesOpened}</TableCell>
                  <TableCell className="text-center">{worker.platesClosed}</TableCell>
                  <TableCell className="text-center font-semibold">
                    {worker.ordersOpened + worker.ordersClosed}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>UKUPNO</TableCell>
                <TableCell className="text-center">{totals.ordersOpened}</TableCell>
                <TableCell className="text-center">{totals.ordersClosed}</TableCell>
                <TableCell className="text-center">{totals.platesOpened}</TableCell>
                <TableCell className="text-center">{totals.platesClosed}</TableCell>
                <TableCell className="text-center">{totals.ordersOpened + totals.ordersClosed}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkerProductivityStats;
