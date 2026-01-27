import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PriorityBadge } from "@/components/priority/PriorityBadge";
import { Calendar, ChevronDown, ChevronRight, FileText } from "lucide-react";
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
}

interface FileItem {
  id: string;
  name: string;
  qty: number;
  details: string;
}

interface Props {
  order: WorkOrder;
  onChangePriority: (order: WorkOrder) => void;
  searchQuery: string;
}

export function ClientOrderRow({ order, onChangePriority, searchQuery }: Props) {
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

  // Check if any file matches the search
  const filesMatchSearch = files.some((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="hover:bg-muted/50">
        <TableCell>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="font-medium">
          {order.display_order_number || order.order_code}
        </TableCell>
        <TableCell>{highlightMatch(order.job_name || "-")}</TableCell>
        <TableCell>
          <Badge variant={order.status === "open" ? "default" : "secondary"}>
            {order.status === "open" ? "Otvoren" : "Zatvoren"}
          </Badge>
        </TableCell>
        <TableCell>
          <PriorityBadge priority={order.priority} />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(order.created_at), "dd.MM.yyyy", { locale: sr })}
          </div>
        </TableCell>
        <TableCell>
          {order.status === "open" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onChangePriority(order)}
            >
              Promeni prioritet
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </TableCell>
      </TableRow>
      <CollapsibleContent asChild>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={7} className="py-3">
            <div className="pl-8">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Fajlovi ({files.length})</span>
              </div>
              {filesLoading ? (
                <p className="text-sm text-muted-foreground">Učitavanje...</p>
              ) : files.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nema fajlova</p>
              ) : (
                <div className="grid gap-1">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 text-sm p-2 rounded bg-background"
                    >
                      <span className="font-medium flex-1">
                        {highlightMatch(file.name)}
                      </span>
                      <span className="text-muted-foreground">{file.qty} kom</span>
                      <span className="text-muted-foreground">{file.details}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}
