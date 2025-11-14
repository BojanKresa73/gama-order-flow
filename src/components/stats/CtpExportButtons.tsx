import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CtpFiltersState } from "@/pages/CtpStats";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { format } from "date-fns";

interface CtpExportButtonsProps {
  filters: CtpFiltersState;
}

export const CtpExportButtons = ({ filters }: CtpExportButtonsProps) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isExportingXLSX, setIsExportingXLSX] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  const fetchCtpData = async () => {
    let query = supabase
      .from("v_ctp_items" as any)
      .select("work_order_id, work_order_number, client_name, plate_format_name, plates_qty, closed_on");

    if (filters.dateRange.from) {
      query = query.gte("closed_on", filters.dateRange.from.toISOString().split("T")[0]);
    }
    if (filters.dateRange.to) {
      query = query.lte("closed_on", filters.dateRange.to.toISOString().split("T")[0]);
    }
    if (filters.clientIds.length > 0) {
      query = query.in("client_id", filters.clientIds);
    }
    if (filters.plateFormatIds.length > 0) {
      query = query.in("plate_format_id", filters.plateFormatIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ((data || []) as unknown) as Array<{
      work_order_id: string;
      work_order_number: string;
      client_name: string;
      plate_format_name: string;
      plates_qty: number;
      closed_on: string;
    }>;
  };

  const handleExportCSV = async () => {
    try {
      setIsExportingCSV(true);
      const data = await fetchCtpData();

      // Create CSV content
      const csvRows = [
        "datum;format;qty", // Header
        ...data.map(item => 
          `${item.closed_on};${item.plate_format_name || "N/A"};${item.plates_qty}`
        )
      ];

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ctp-data-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("CSV fajl je preuzet");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Greška pri exportu CSV");
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleExportXLSX = async () => {
    try {
      setIsExportingXLSX(true);
      const data = await fetchCtpData();

      // Calculate KPIs
      const totalPlates = data.reduce((sum, item) => sum + item.plates_qty, 0);
      const uniqueOrders = new Set(data.map(item => item.work_order_id)).size;
      const uniqueClients = new Set(data.map(item => item.client_name)).size;
      const avgPlatesPerOrder = uniqueOrders > 0 ? (totalPlates / uniqueOrders).toFixed(1) : "0.0";

      // Create workbook
      const wb = XLSX.utils.book_new();

      // KPI Sheet
      const kpiData = [
        ["CTP Statistika - Izveštaj"],
        [`Period: ${filters.dateRange.from.toISOString().split("T")[0]} - ${filters.dateRange.to.toISOString().split("T")[0]}`],
        [],
        ["Ključni pokazatelji"],
        ["Ukupno ploča", totalPlates],
        ["Broj CTP naloga", uniqueOrders],
        ["Prosečno ploča/nalog", avgPlatesPerOrder],
        ["Broj klijenata", uniqueClients],
      ];
      const kpiSheet = XLSX.utils.aoa_to_sheet(kpiData);
      XLSX.utils.book_append_sheet(wb, kpiSheet, "KPI");

      // Raw Data Sheet
      const rawData = data.map(item => ({
        "Datum": item.closed_on,
        "Broj naloga": item.work_order_number,
        "Klijent": item.client_name,
        "Format": item.plate_format_name,
        "Količina": item.plates_qty,
      }));
      const rawSheet = XLSX.utils.json_to_sheet(rawData);
      XLSX.utils.book_append_sheet(wb, rawSheet, "Podaci");

      // Top Clients Sheet
      const clientStats: Record<string, { plates: number; orders: Set<string> }> = {};
      data.forEach(item => {
        if (!clientStats[item.client_name]) {
          clientStats[item.client_name] = { plates: 0, orders: new Set() };
        }
        clientStats[item.client_name].plates += item.plates_qty;
        clientStats[item.client_name].orders.add(item.work_order_id);
      });

      const topClients = Object.entries(clientStats)
        .map(([name, stats]) => ({
          "Klijent": name,
          "Ploča ukupno": stats.plates,
          "Nalozi": stats.orders.size,
          "% učešća": totalPlates > 0 ? ((stats.plates / totalPlates) * 100).toFixed(1) + "%" : "0.0%",
        }))
        .sort((a, b) => b["Ploča ukupno"] - a["Ploča ukupno"]);

      const clientsSheet = XLSX.utils.json_to_sheet(topClients);
      XLSX.utils.book_append_sheet(wb, clientsSheet, "Top Klijenti");

      // Top Formats Sheet
      const formatStats: Record<string, number> = {};
      data.forEach(item => {
        const format = item.plate_format_name || "Nepoznato";
        formatStats[format] = (formatStats[format] || 0) + item.plates_qty;
      });

      const topFormats = Object.entries(formatStats)
        .map(([format, plates]) => ({
          "Format": format,
          "Ploča ukupno": plates,
          "% učešća": totalPlates > 0 ? ((plates / totalPlates) * 100).toFixed(1) + "%" : "0.0%",
        }))
        .sort((a, b) => b["Ploča ukupno"] - a["Ploča ukupno"]);

      const formatsSheet = XLSX.utils.json_to_sheet(topFormats);
      XLSX.utils.book_append_sheet(wb, formatsSheet, "Top Formati");

      // Save file
      XLSX.writeFile(wb, `ctp-report-${format(new Date(), "yyyy-MM-dd-HHmm")}.xlsx`);
      toast.success("XLSX fajl je preuzet");
    } catch (error) {
      console.error("Error exporting XLSX:", error);
      toast.error("Greška pri exportu XLSX");
    } finally {
      setIsExportingXLSX(false);
    }
  };

  const handleGeneratePDF = async () => {
    try {
      setIsGeneratingPDF(true);
      toast.info("Generisanje PDF izveštaja...");

      const { data, error } = await supabase.functions.invoke("generate-ctp-report", {
        body: { 
          filters: {
            dateRange: {
              from: filters.dateRange.from.toISOString().split("T")[0],
              to: filters.dateRange.to.toISOString().split("T")[0],
            },
            clientIds: filters.clientIds,
            plateFormatIds: filters.plateFormatIds,
          }
        },
      });

      if (error) throw error;

      if (data.success && data.url) {
        // Open PDF in new tab
        window.open(data.url, "_blank");
        toast.success("PDF izveštaj je generisan");
      } else {
        throw new Error("Failed to generate PDF");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Greška pri generisanju PDF");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportXLSX}
        disabled={isExportingXLSX}
      >
        {isExportingXLSX ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 mr-2" />
        )}
        Export XLSX
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleExportCSV}
        disabled={isExportingCSV}
      >
        {isExportingCSV ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <FileText className="h-4 w-4 mr-2" />
        )}
        Export CSV
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleGeneratePDF}
        disabled={isGeneratingPDF}
      >
        {isGeneratingPDF ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        PDF izveštaj
      </Button>
    </div>
  );
};
