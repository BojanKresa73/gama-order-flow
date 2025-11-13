import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, AlertCircle, CheckCircle2, FileEdit, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type CsvRow = {
  naziv: string;
  pib?: string;
  maticni_broj?: string;
  adresa?: string;
  grad?: string;
  postanski_broj?: string;
  drzava?: string;
  kontakt_osoba?: string;
  telefon?: string;
  email?: string;
  notification_email?: string;
  rok_placanja_dana?: string;
  rabat_procenat?: string;
  napomena?: string;
};

type PreviewRow = CsvRow & {
  status: "NOVO" | "UPDATE" | "SKIP" | "ERROR";
  error?: string;
  existingId?: string;
};

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

export function ClientsCsvImport() {
  const [open, setOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const validatePib = (pib: string): boolean => {
    if (!pib) return true; // Empty PIB is allowed
    const normalized = pib.replace(/\s/g, "");
    return /^\d{9}$/.test(normalized);
  };

  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Empty email is allowed
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const parseCsv = (text: string): CsvRow[] => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const rows: CsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      rows.push(row as CsvRow);
    }

    return rows;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      toast({
        title: "Greška",
        description: "Molimo učitajte CSV fajl",
        variant: "destructive",
      });
      return;
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      toast({
        title: "Greška",
        description: "CSV fajl je prazan ili neispravan",
        variant: "destructive",
      });
      return;
    }

    if (rows.length > 500) {
      toast({
        title: "Greška",
        description: "Maksimalno 500 redova po uploadu",
        variant: "destructive",
      });
      return;
    }

    // Get all PIBs from database
    const { data: existingClients } = await supabase
      .from("clients")
      .select("id, pib")
      .not("pib", "is", null);

    const pibMap = new Map(
      existingClients?.map(c => [c.pib?.replace(/\s/g, ""), c.id]) || []
    );

    // Determine status for each row
    const preview: PreviewRow[] = rows.map(row => {
      const normalizedPib = row.pib?.replace(/\s/g, "");

      // Validation
      if (!row.naziv || (!row.email && !normalizedPib)) {
        return { ...row, status: "SKIP" as const };
      }

      if (row.pib && !validatePib(row.pib)) {
        return {
          ...row,
          status: "ERROR" as const,
          error: "Nevažeći PIB (mora biti 9 cifara)",
        };
      }

      if (row.email && !validateEmail(row.email)) {
        return {
          ...row,
          status: "ERROR" as const,
          error: "Nevažeći email format",
        };
      }

      if (row.notification_email && !validateEmail(row.notification_email)) {
        return {
          ...row,
          status: "ERROR" as const,
          error: "Nevažeći email za obaveštenja",
        };
      }

      // Check if exists
      if (normalizedPib && pibMap.has(normalizedPib)) {
        return {
          ...row,
          status: "UPDATE" as const,
          existingId: pibMap.get(normalizedPib),
        };
      }

      return { ...row, status: "NOVO" as const };
    });

    setPreviewData(preview);
    setImportResult(null);
    e.target.value = ""; // Reset input
  };

  const handleImport = async () => {
    setIsProcessing(true);
    const result: ImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    try {
      for (let i = 0; i < previewData.length; i++) {
        const row = previewData[i];

        if (row.status === "SKIP") {
          result.skipped++;
          continue;
        }

        if (row.status === "ERROR") {
          result.errors.push({ row: i + 1, message: row.error || "Nepoznata greška" });
          continue;
        }

        const clientData = {
          name: row.naziv,
          pib: row.pib?.replace(/\s/g, "") || null,
          maticni_broj: row.maticni_broj || null,
          adresa: row.adresa || null,
          grad: row.grad || null,
          postanski_broj: row.postanski_broj || null,
          drzava: row.drzava || "Srbija",
          kontakt_osoba: row.kontakt_osoba || null,
          telefon: row.telefon || null,
          email: row.email || null,
          notification_email: row.notification_email || null,
          rok_placanja_dana: row.rok_placanja_dana ? parseInt(row.rok_placanja_dana) : 0,
          rabat_procenat: row.rabat_procenat ? parseFloat(row.rabat_procenat) : 0,
          napomena: row.napomena || null,
        };

        try {
          if (row.status === "UPDATE" && row.existingId) {
            const { error } = await supabase
              .from("clients")
              .update(clientData)
              .eq("id", row.existingId);

            if (error) throw error;
            result.updated++;
          } else {
            const { error } = await supabase
              .from("clients")
              .insert(clientData);

            if (error) throw error;
            result.created++;
          }
        } catch (error: any) {
          result.errors.push({
            row: i + 1,
            message: error.message || "Greška pri upisu",
          });
        }
      }

      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["clients"] });

      toast({
        title: "Import završen",
        description: `Kreirano: ${result.created}, Ažurirano: ${result.updated}, Preskočeno: ${result.skipped}`,
      });
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: PreviewRow["status"]) => {
    switch (status) {
      case "NOVO":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />NOVO</Badge>;
      case "UPDATE":
        return <Badge className="bg-blue-500"><FileEdit className="w-3 h-3 mr-1" />UPDATE</Badge>;
      case "SKIP":
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />SKIP</Badge>;
      case "ERROR":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />ERROR</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import klijenata iz CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <FileDown className="h-4 w-4" />
            <AlertDescription>
              CSV kolone: naziv, pib, maticni_broj, adresa, grad, postanski_broj, drzava,
              kontakt_osoba, telefon, email, notification_email, rok_placanja_dana,
              rabat_procenat, napomena. Maksimalno 500 redova.
            </AlertDescription>
          </Alert>

          <div>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>

          {previewData.length > 0 && !importResult && (
            <>
              <div className="border rounded-md max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Naziv</TableHead>
                      <TableHead>PIB</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Grad</TableHead>
                      <TableHead>Greška</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{getStatusBadge(row.status)}</TableCell>
                        <TableCell>{row.naziv}</TableCell>
                        <TableCell>{row.pib || "-"}</TableCell>
                        <TableCell>{row.email || "-"}</TableCell>
                        <TableCell>{row.grad || "-"}</TableCell>
                        <TableCell className="text-destructive">{row.error || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Novo: {previewData.filter(r => r.status === "NOVO").length} |
                  Update: {previewData.filter(r => r.status === "UPDATE").length} |
                  Skip: {previewData.filter(r => r.status === "SKIP").length} |
                  Greške: {previewData.filter(r => r.status === "ERROR").length}
                </div>
                <Button onClick={handleImport} disabled={isProcessing}>
                  {isProcessing ? "Upisujem..." : "Upiši u bazu"}
                </Button>
              </div>
            </>
          )}

          {importResult && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Import rezultat:</div>
                  <div>Kreirano: {importResult.created}</div>
                  <div>Ažurirano: {importResult.updated}</div>
                  <div>Preskočeno: {importResult.skipped}</div>
                </AlertDescription>
              </Alert>

              {importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-2">Greške ({importResult.errors.length}):</div>
                    {importResult.errors.map((err, idx) => (
                      <div key={idx} className="text-sm">
                        Red {err.row}: {err.message}
                      </div>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={() => { setPreviewData([]); setImportResult(null); }}>
                Novi import
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
