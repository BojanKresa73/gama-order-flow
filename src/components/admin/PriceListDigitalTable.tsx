import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PriceListForm } from "./PriceListForm";
import { PriceListImportDialog } from "./PriceListImportDialog";

export interface PriceListEntry {
  id: string;
  break_qty: number;
  price_per_sheet: number;
}

export const PriceListDigitalTable = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data: priceList, isLoading } = useQuery({
    queryKey: ["digital-price-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_digital" as any)
        .select("*")
        .order("break_qty");

      if (error) throw error;
      return data as unknown as PriceListEntry[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("price_list_digital" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["digital-price-list"] });
      toast({ title: "Stavka obrisana" });
    },
    onError: () => {
      toast({
        title: "Greška",
        description: "Nije moguće obrisati stavku",
        variant: "destructive",
      });
    },
  });

  const handleExportCSV = () => {
    if (!priceList || priceList.length === 0) {
      toast({
        title: "Nema podataka",
        description: "Cenovnik je prazan",
        variant: "destructive",
      });
      return;
    }

    const csv = [
      "break_qty,price_per_sheet",
      ...priceList.map((entry) => `${entry.break_qty},${entry.price_per_sheet}`),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cenovnik_digital_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({ title: "CSV fajl preuzet" });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Učitavanje...</div>;
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          Cenovnik ({priceList?.length || 0} stavki)
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!priceList || priceList.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAdding(true)}
            disabled={isAdding || editingId !== null}
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Količina (tabaka)</TableHead>
              <TableHead>Cena po tabaku (RSD)</TableHead>
              <TableHead className="w-[100px]">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAdding && (
              <TableRow>
                <TableCell colSpan={3} className="p-0">
                  <PriceListForm
                    onSuccess={() => {
                      setIsAdding(false);
                      queryClient.invalidateQueries({ queryKey: ["digital-price-list"] });
                    }}
                    onCancel={() => setIsAdding(false)}
                    existingBreakQtys={priceList?.map((p) => p.break_qty) || []}
                  />
                </TableCell>
              </TableRow>
            )}
            {priceList?.map((entry) =>
              editingId === entry.id ? (
                <TableRow key={entry.id}>
                  <TableCell colSpan={3} className="p-0">
                    <PriceListForm
                      entry={entry}
                      onSuccess={() => {
                        setEditingId(null);
                        queryClient.invalidateQueries({ queryKey: ["digital-price-list"] });
                      }}
                      onCancel={() => setEditingId(null)}
                      existingBreakQtys={
                        priceList
                          ?.filter((p) => p.id !== entry.id)
                          .map((p) => p.break_qty) || []
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {entry.break_qty.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {entry.price_per_sheet.toFixed(2)} RSD
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingId(entry.id)}
                        disabled={isAdding || editingId !== null}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(entry.id)}
                        disabled={isAdding || editingId !== null || deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
            {!isAdding && (!priceList || priceList.length === 0) && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Nema stavki u cenovniku. Kliknite "Dodaj" da dodate prvu stavku.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PriceListImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["digital-price-list"] });
        }}
      />
    </Card>
  );
};
