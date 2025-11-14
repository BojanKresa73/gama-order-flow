import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CtpFiltersState } from "@/pages/CtpStats";
import { BookmarkPlus, ChevronDown, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, startOfYear, subDays, subYears } from "date-fns";

interface SavedReportsDropdownProps {
  filters: CtpFiltersState;
  onFiltersChange: (filters: CtpFiltersState) => void;
}

export const SavedReportsDropdown = ({ filters, onFiltersChange }: SavedReportsDropdownProps) => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [reportName, setReportName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const queryClient = useQueryClient();

  const { data: savedReports } = useQuery({
    queryKey: ["saved-reports", "ctp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_reports")
        .select("*")
        .eq("type", "ctp")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("saved_reports").insert({
        user_id: user.id,
        name: reportName,
        type: "ctp",
        filters: filters as any,
        is_public: isPublic,
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-reports"] });
      toast.success("Izveštaj je sačuvan");
      setShowSaveDialog(false);
      setReportName("");
      setIsPublic(false);
    },
    onError: (error) => {
      console.error("Error saving report:", error);
      toast.error("Greška pri čuvanju izveštaja");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from("saved_reports")
        .delete()
        .eq("id", reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-reports"] });
      toast.success("Izveštaj je obrisan");
    },
    onError: (error) => {
      console.error("Error deleting report:", error);
      toast.error("Greška pri brisanju izveštaja");
    },
  });

  const applyQuickFilter = (filterType: string) => {
    const today = new Date();
    let newFilters: CtpFiltersState = {
      ...filters,
      clientIds: [],
      plateFormatIds: [],
    };

    switch (filterType) {
      case "last7days":
        newFilters.dateRange = {
          from: subDays(today, 7),
          to: today,
        };
        break;
      case "last30days":
        newFilters.dateRange = {
          from: subDays(today, 30),
          to: today,
        };
        break;
      case "thisMonth":
        newFilters.dateRange = {
          from: startOfMonth(today),
          to: today,
        };
        break;
      case "lastYear":
        newFilters.dateRange = {
          from: startOfYear(subYears(today, 1)),
          to: new Date(today.getFullYear() - 1, 11, 31),
        };
        break;
    }

    onFiltersChange(newFilters);
    toast.success("Filter je primenjen");
  };

  const loadSavedReport = (report: any) => {
    const loadedFilters: CtpFiltersState = {
      dateRange: {
        from: new Date(report.filters.dateRange.from),
        to: new Date(report.filters.dateRange.to),
      },
      clientIds: report.filters.clientIds || [],
      plateFormatIds: report.filters.plateFormatIds || [],
    };
    onFiltersChange(loadedFilters);
    toast.success(`Učitan izveštaj: ${report.name}`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <BookmarkPlus className="h-4 w-4" />
            Sačuvani izveštaji
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 bg-card z-50">
          <DropdownMenuLabel>Brzi izbor</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => applyQuickFilter("last7days")}>
            <Calendar className="h-4 w-4 mr-2" />
            Poslednjih 7 dana
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyQuickFilter("last30days")}>
            <Calendar className="h-4 w-4 mr-2" />
            Poslednjih 30 dana
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyQuickFilter("thisMonth")}>
            <Calendar className="h-4 w-4 mr-2" />
            Ovaj mesec
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyQuickFilter("lastYear")}>
            <Calendar className="h-4 w-4 mr-2" />
            Prošla godina
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setShowSaveDialog(true)}>
            <BookmarkPlus className="h-4 w-4 mr-2" />
            Sačuvaj trenutne filtere...
          </DropdownMenuItem>

          {savedReports && savedReports.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Sačuvani</DropdownMenuLabel>
              {savedReports.map((report) => (
                <DropdownMenuItem
                  key={report.id}
                  className="flex items-center justify-between"
                  onSelect={(e) => e.preventDefault()}
                >
                  <span
                    onClick={() => loadSavedReport(report)}
                    className="flex-1 cursor-pointer"
                  >
                    {report.name}
                    {report.is_public && (
                      <span className="ml-2 text-xs text-muted-foreground">(javno)</span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(report.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Sačuvaj izveštaj</DialogTitle>
            <DialogDescription>
              Sačuvajte trenutne filtere kao novi izveštaj
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-name">Naziv izveštaja</Label>
              <Input
                id="report-name"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="npr. Glavni klijenti Q1 2024"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is-public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
              <Label htmlFor="is-public">Javno vidljiv (svi korisnici)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveDialog(false);
                setReportName("");
                setIsPublic(false);
              }}
            >
              Otkaži
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!reportName.trim() || saveMutation.isPending}
            >
              Sačuvaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
