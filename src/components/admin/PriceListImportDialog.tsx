import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportRow {
  break_qty: number;
  price_per_sheet: number;
  error?: string;
}

interface PriceListImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const PriceListImportDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: PriceListImportDialogProps) => {
  const { toast } = useToast();
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length === 0) {
        toast({
          title: "Greška",
          description: "CSV fajl je prazan",
          variant: "destructive",
        });
        return;
      }

      const header = lines[0].toLowerCase();
      if (!header.includes("break_qty") || !header.includes("price_per_sheet")) {
        toast({
          title: "Greška",
          description: "CSV mora sadržati kolone: break_qty, price_per_sheet",
          variant: "destructive",
        });
        return;
      }

      const rows: ImportRow[] = [];
      const seenQtys = new Set<number>();

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",");
        if (parts.length < 2) continue;

        const qty = parseInt(parts[0].trim());
        const price = parseFloat(parts[1].trim());

        const row: ImportRow = { break_qty: qty, price_per_sheet: price };

        if (isNaN(qty) || qty <= 0) {
          row.error = "Nevalidna količina";
        } else if (isNaN(price) || price <= 0) {
          row.error = "Nevalidna cena";
        } else if (seenQtys.has(qty)) {
          row.error = "Duplikat količine";
        } else {
          seenQtys.add(qty);
        }

        rows.push(row);
      }

      setPreview(rows);
    };

    reader.readAsText(file);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = preview.filter((row) => !row.error);

      if (validRows.length === 0) {
        throw new Error("Nema validnih redova za import");
      }

      // Delete all existing entries
      const { error: deleteError } = await supabase
        .from("price_list_digital" as any)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (deleteError) throw deleteError;

      // Insert new entries
      const { error: insertError } = await supabase
        .from("price_list_digital" as any)
        .insert(validRows);

      if (insertError) throw insertError;

      return validRows.length;
    },
    onSuccess: (count) => {
      toast({
        title: "Import uspešan",
        description: `Uvezeno ${count} stavki`,
      });
      onSuccess();
      onOpenChange(false);
      setPreview([]);
      setFileName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Greška pri importu",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const validCount = preview.filter((row) => !row.error).length;
  const errorCount = preview.filter((row) => row.error).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import CSV cenovnika</DialogTitle>
          <DialogDescription>
            CSV fajl mora sadržati kolone: break_qty, price_per_sheet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="flex-1"
            />
            {fileName && (
              <span className="text-sm text-muted-foreground">{fileName}</span>
            )}
          </div>

          {preview.length > 0 && (
            <>
              <Alert>
                <AlertDescription className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Validnih: {validCount}</span>
                  </div>
                  {errorCount > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span>Grešaka: {errorCount}</span>
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Količina</TableHead>
                      <TableHead>Cena po tabaku</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, idx) => (
                      <TableRow key={idx} className={row.error ? "bg-destructive/10" : ""}>
                        <TableCell>{row.break_qty}</TableCell>
                        <TableCell>{row.price_per_sheet.toFixed(2)}</TableCell>
                        <TableCell>
                          {row.error ? (
                            <span className="text-destructive text-sm">{row.error}</span>
                          ) : (
                            <span className="text-green-600 text-sm">✓</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Import će OBRISATI sve postojeće stavke i zameniti ih novim.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    setPreview([]);
                    setFileName("");
                  }}
                >
                  Otkaži
                </Button>
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={validCount === 0 || importMutation.isPending}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Uvezi {validCount} stavki
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
