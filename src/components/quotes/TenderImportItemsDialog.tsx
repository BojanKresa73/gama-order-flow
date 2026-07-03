import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { parseTenderText, type ParseTenderResult } from "@/lib/tenderImport";
import { useBulkInsertQuoteItemsPro } from "@/hooks/useQuotesPro";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  quoteId: string;
  startOrderIndex: number;
  onImported?: () => void;
}

export function TenderImportItemsDialog({
  open, onOpenChange, quoteId, startOrderIndex, onImported,
}: Props) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParseTenderResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const bulk = useBulkInsertQuoteItemsPro();

  async function handleParse() {
    if (!text.trim()) return toast.error("Nalepite tekst zahteva/tendera");
    setParsing(true);
    try {
      const res = await parseTenderText(text);
      setParsed(res);
      if (!res.items?.length) toast.warning("AI nije pronašao stavke.");
    } catch (e: any) {
      toast.error(e.message ?? "Greška pri parsiranju");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!parsed?.items?.length) return;
    const rows = parsed.items.map((it, i) => ({
      quote_id: quoteId,
      item_type: (it.item_type === "other" ? "razno" : it.item_type) as any,
      name: it.name,
      description: it.description ?? null,
      quantity: it.quantity ?? 1,
      width_mm: it.width_mm ?? null,
      height_mm: it.height_mm ?? null,
      material_id: it.material_id ?? null,
      material_name: it.material_name ?? null,
      unit_cost: 0,
      unit_price: Number(it.unit_price ?? 0),
      line_total: Number(it.unit_price ?? 0) * Number(it.quantity ?? 1),
      finishing_cost: 0,
      order_index: startOrderIndex + i,
    })) as any[];
    try {
      await bulk.mutateAsync({ quoteId, items: rows });
      toast.success(`Dodato ${rows.length} stavki`);
      setText(""); setParsed(null);
      onOpenChange(false);
      onImported?.();
    } catch (e: any) {
      toast.error(e.message ?? "Greška pri unosu");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" /> Uvezi zahtev (AI parser)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tekst zahteva / tendera / mejla</Label>
            <Textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nalepite tekst — AI izvlači stavke, dimenzije, količine, materijale…"
            />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleParse} disabled={parsing}>
              {parsing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Parsiraj (AI)
            </Button>
          </div>

          {parsed && (
            <Card>
              <div className="p-3 border-b font-medium">
                Prepoznate stavke ({parsed.items.length})
              </div>
              {parsed.items.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Ništa nije prepoznato.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naziv</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Dim (mm)</TableHead>
                      <TableHead className="text-right">Kol.</TableHead>
                      <TableHead>Materijal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.items.map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{it.name}</TableCell>
                        <TableCell>{it.item_type}</TableCell>
                        <TableCell>
                          {it.width_mm && it.height_mm ? `${it.width_mm}×${it.height_mm}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">{it.quantity}</TableCell>
                        <TableCell>{it.material_name ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
          <Button
            onClick={handleImport}
            disabled={!parsed?.items?.length || bulk.isPending}
          >
            {bulk.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Dodaj u ponudu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
