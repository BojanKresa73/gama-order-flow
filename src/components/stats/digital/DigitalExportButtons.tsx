import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { DigitalFiltersState } from "@/pages/DigitalStats";
import * as XLSX from "xlsx";

interface DigitalExportButtonsProps {
  filters: DigitalFiltersState;
}

export function DigitalExportButtons({ filters }: DigitalExportButtonsProps) {
  const [exporting, setExporting] = useState(false);

  const { data: exportData } = useQuery({
    queryKey: ["digital-export-data", filters],
    queryFn: async () => {
      const { data: digitalJobs, error } = await supabase
        .from("digital_jobs")
        .select(`
          *,
          work_order:work_orders!inner(
            id,
            order_number,
            display_order_number,
            created_at,
            client_id,
            clients(name),
            deleted_at
          )
        `)
        .gte("work_order.created_at", filters.dateRange.from.toISOString())
        .lte("work_order.created_at", filters.dateRange.to.toISOString())
        .is("work_order.deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Apply filters
      let filteredJobs = digitalJobs || [];

      if (filters.clientIds.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.clientIds.includes(job.work_order?.client_id)
        );
      }

      if (filters.printSides.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.printSides.includes(job.print_sides)
        );
      }

      if (filters.paperTypes.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.paperTypes.includes(job.paper_type || "")
        );
      }

      if (filters.sheetFormats.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.sheetFormats.includes(job.machine_sheet_format)
        );
      }

      return filteredJobs;
    },
    staleTime: 30_000,
  });

  const handleExportXLSX = async () => {
    if (!exportData) return;
    setExporting(true);

    try {
      const rows = exportData.map(job => ({
        "Datum": format(new Date(job.work_order?.created_at), "dd.MM.yyyy"),
        "Nalog": job.work_order?.display_order_number || job.work_order?.order_number,
        "Klijent": job.work_order?.clients?.name || "",
        "Fajl": job.file_name,
        "Format tabaka": job.machine_sheet_format,
        "Pokrivenost": job.print_sides,
        "Tip papira": job.paper_type || "",
        "Tiraž": job.qty,
        "Obim": job.obim,
        "Ukupno tabaka": job.computed_total_sheets,
        "Color klikovi": job.computed_color_clicks,
        "Mono klikovi": job.computed_mono_clicks,
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Digitala");

      const fileName = `Digitala_${format(filters.dateRange.from, "dd-MM-yyyy")}_${format(filters.dateRange.to, "dd-MM-yyyy")}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (!exportData) return;
    setExporting(true);

    try {
      const rows = exportData.map(job => ({
        "Datum": format(new Date(job.work_order?.created_at), "dd.MM.yyyy"),
        "Nalog": job.work_order?.display_order_number || job.work_order?.order_number,
        "Klijent": job.work_order?.clients?.name || "",
        "Fajl": job.file_name,
        "Format tabaka": job.machine_sheet_format,
        "Pokrivenost": job.print_sides,
        "Tip papira": job.paper_type || "",
        "Tiraž": job.qty,
        "Obim": job.obim,
        "Ukupno tabaka": job.computed_total_sheets,
        "Color klikovi": job.computed_color_clicks,
        "Mono klikovi": job.computed_mono_clicks,
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Digitala_${format(filters.dateRange.from, "dd-MM-yyyy")}_${format(filters.dateRange.to, "dd-MM-yyyy")}.csv`;
      link.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? "Izvoz..." : "Izvoz"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportXLSX}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (XLSX)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileText className="h-4 w-4 mr-2" />
          CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
