import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Layers, Square, LayoutGrid } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CtpStatsSummaryProps {
  workOrderIds: string[];
}

interface FormatStats {
  formatName: string;
  count: number;
  widthMm: number;
  heightMm: number;
}

export function CtpStatsSummary({ workOrderIds }: CtpStatsSummaryProps) {
  const { data: fileEntries, isLoading } = useQuery({
    queryKey: ["ctp-stats-summary", workOrderIds],
    queryFn: async () => {
      if (workOrderIds.length === 0) return [];

      const { data, error } = await supabase
        .from("file_entries")
        .select(`
          id,
          quantity,
          plate_format_id,
          plate_formats (
            id,
            format_name
          )
        `)
        .in("work_order_id", workOrderIds);

      if (error) throw error;
      return data || [];
    },
    enabled: workOrderIds.length > 0,
  });

  const { data: plateFormats } = useQuery({
    queryKey: ["plate-formats-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plate_formats")
        .select("id, format_name");

      if (error) throw error;
      return data || [];
    },
  });

  if (workOrderIds.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardHeader className="py-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate statistics
  const totalPlates = fileEntries?.reduce((sum, entry) => sum + (entry.quantity || 0), 0) || 0;
  const totalOrders = workOrderIds.length;

  // Group by format
  const formatStats: Record<string, FormatStats> = {};
  fileEntries?.forEach((entry) => {
    const format = entry.plate_formats as { id: string; format_name: string } | null;
    if (format) {
      if (!formatStats[format.id]) {
        // Parse dimensions from format name (e.g., "650x550" or "1030x800")
        const match = format.format_name.match(/(\d+)[xX×](\d+)/);
        const widthMm = match ? parseInt(match[1]) : 0;
        const heightMm = match ? parseInt(match[2]) : 0;
        
        formatStats[format.id] = {
          formatName: format.format_name,
          count: 0,
          widthMm,
          heightMm,
        };
      }
      formatStats[format.id].count += entry.quantity || 0;
    }
  });

  // Calculate total area in m²
  let totalAreaM2 = 0;
  Object.values(formatStats).forEach((stat) => {
    // Convert mm² to m² (divide by 1,000,000)
    const areaPerPlate = (stat.widthMm * stat.heightMm) / 1_000_000;
    totalAreaM2 += areaPerPlate * stat.count;
  });

  // Sort formats by count (descending)
  const sortedFormats = Object.values(formatStats).sort((a, b) => b.count - a.count);

  return (
    <Card className="mb-4 border-primary/20 bg-primary/5">
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          Statistika CTP naloga ({totalOrders} {totalOrders === 1 ? "nalog" : totalOrders < 5 ? "naloga" : "naloga"})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Broj naloga
            </p>
            <p className="text-2xl font-bold">{totalOrders}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <LayoutGrid className="h-4 w-4" />
              Ukupno ploča
            </p>
            <p className="text-2xl font-bold text-primary">{totalPlates}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Square className="h-4 w-4" />
              Ukupna površina
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalAreaM2.toFixed(2)} m²
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Layers className="h-4 w-4" />
              Broj formata
            </p>
            <p className="text-2xl font-bold">{sortedFormats.length}</p>
          </div>
        </div>

        {sortedFormats.length > 0 && (
          <div className="border-t pt-3 mt-2">
            <p className="text-sm font-medium mb-2 text-muted-foreground">Raspodela po formatima:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {sortedFormats.map((stat) => {
                const areaPerPlate = (stat.widthMm * stat.heightMm) / 1_000_000;
                const totalFormatArea = areaPerPlate * stat.count;
                const percentage = totalPlates > 0 ? ((stat.count / totalPlates) * 100).toFixed(1) : "0";
                
                return (
                  <div
                    key={stat.formatName}
                    className="bg-background rounded-lg p-2 border"
                  >
                    <p className="text-sm font-medium">{stat.formatName}</p>
                    <p className="text-lg font-bold text-primary">{stat.count} kom</p>
                    <p className="text-xs text-muted-foreground">
                      {totalFormatArea.toFixed(2)} m² ({percentage}%)
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
