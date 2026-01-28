import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/components/priority/PriorityBadge";
import { Calendar, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";

interface WorkOrder {
  id: string;
  order_code: string;
  display_order_number: string;
  job_name: string | null;
  status: string;
  priority: number;
  created_at: string;
  closed_at: string | null;
  order_type: string;
  total_plates: number;
}

interface FileItem {
  id: string;
  name: string;
  qty: number;
  details: string;
}

interface Props {
  order: WorkOrder;
  index: number;
  onChangePriority: (order: WorkOrder) => void;
  searchQuery: string;
}

export function ClientOrderCard({ order, index, onChangePriority, searchQuery }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch files for this order
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ["order-files-portal", order.id, order.order_type],
    queryFn: async () => {
      const items: FileItem[] = [];

      if (order.order_type === "ctp") {
        const { data } = await supabase
          .from("file_entries")
          .select("id, filename, quantity, plate_formats(format_name)")
          .eq("work_order_id", order.id)
          .order("created_at");
        
        (data || []).forEach((f: any) => {
          items.push({
            id: f.id,
            name: f.filename,
            qty: f.quantity || 0,
            details: f.plate_formats?.format_name || "",
          });
        });
      } else if (order.order_type === "film") {
        const { data } = await supabase
          .from("film_jobs")
          .select("id, file_name, width_mm, height_mm, qty")
          .eq("work_order_id", order.id)
          .order("created_at");
        
        (data || []).forEach((f: any) => {
          items.push({
            id: f.id,
            name: f.file_name,
            qty: f.qty,
            details: `${f.width_mm}×${f.height_mm} mm`,
          });
        });
      } else if (order.order_type === "digital") {
        const { data } = await supabase
          .from("digital_jobs")
          .select("id, file_name, finished_w_mm, finished_h_mm, qty, pages")
          .eq("work_order_id", order.id)
          .order("order_index");
        
        (data || []).forEach((f: any) => {
          items.push({
            id: f.id,
            name: f.file_name,
            qty: f.qty,
            details: `${f.finished_w_mm}×${f.finished_h_mm} mm, ${f.pages} str`,
          });
        });
      }

      return items;
    },
    enabled: isOpen,
  });

  // Highlight matching text
  const highlightMatch = (text: string) => {
    if (!searchQuery) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header row with index, order number and status */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base flex items-center gap-2">
              <span className="text-muted-foreground text-sm">#{index}</span>
              {order.display_order_number || order.order_code}
              {order.order_type === "ctp" && order.total_plates > 0 && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {order.total_plates} ploča
                </span>
              )}
            </div>
            {order.job_name && (
              <div className="text-sm text-muted-foreground truncate">
                {highlightMatch(order.job_name)}
              </div>
            )}
          </div>
          <Badge variant={order.status === "open" ? "default" : "secondary"}>
            {order.status === "open" ? "Otvoren" : "Zatvoren"}
          </Badge>
        </div>

        {/* Priority and date row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Prioritet:</span>
            <PriorityBadge priority={order.priority} size="sm" />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(order.created_at), "dd.MM.yyyy", { locale: sr })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {order.status === "open" && (
            <Button
              size="sm"
              variant="default"
              className="flex-1"
              onClick={() => onChangePriority(order)}
            >
              Promeni prioritet
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsOpen(!isOpen)}
            className="gap-1"
          >
            <FileText className="h-4 w-4" />
            Fajlovi
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Expanded files section */}
        {isOpen && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Fajlovi ({files.length})</span>
            </div>
            {filesLoading ? (
              <p className="text-sm text-muted-foreground">Učitavanje...</p>
            ) : files.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nema fajlova</p>
            ) : (
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="text-sm p-2 rounded bg-muted/50"
                  >
                    <div className="font-medium mb-1 break-all">
                      {highlightMatch(file.name)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{file.qty} kom</span>
                      <span>•</span>
                      <span>{file.details}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
