import { useMemo, useState } from "react";
import { ClipboardPaste, Loader2, Package, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { parseTenderText, type ParseTenderResult, type ParsedTenderItem } from "@/lib/tenderImport";
import { useBulkInsertQuoteItemsPro } from "@/hooks/useQuotesPro";
import { parsedItemToProductDraft } from "@/lib/parsedItemToProductDraft";
import type { ProductDraft } from "@/lib/digitalProductPricing";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  quoteId: string;
  startOrderIndex: number;
  onImported?: () => void;
  /** Called when user clicks "Otvori u Digital proizvod" on a digital-classified row. */
  onDigitalDraft?: (draft: ProductDraft) => void;
}

export function PasteItemsDialog({
  open, onOpenChange, quoteId, startOrderIndex, onImported, onDigitalDraft,
}: Props) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParseTenderResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const bulk = useBulkInsertQuoteItemsPro();

  async function handleParse() {
    if (!text.trim()) return toast.error("Nalepite tekst");
    setParsing(true);
    try {
      const res = await parseTenderText(text);
      setParsed(res);
      if (!res.items?.length) toast.warning("AI nije prepoznao stavke.");
    } catch (e: any) {
      toast.error(e.message ?? "Greška pri parsiranju");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!parsed?.items?.length) return;
    const items = parsed.items.map((it, i) => ({
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
      ...(it.digital ?? {}),
    })) as any[];
    try {
      await bulk.mutateAsync({ quoteId, items });
      toast.success(`Dodato ${items.length} stavki`);
      setText(""); setParsed(null);
      onOpenChange(false);
      onImported?.();
    } catch (e: any) {
      toast.error(e.message ?? "Greška pri unosu");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5" /> Nalepi tekst — AI izvlači stavke
          </DialogTitle>
          <DialogDescription>
            Nalepi opis proizvoda (format, papir, štampa, dorada, tiraž). AI grupiše sve u jednu stavku sa punim opisom.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tekst</Label>
            <Textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Katalog umetničke izložbe, format 23x23 cm, obim korice + 8 strana, štampa 4/4, papir korice 250g mat, plastifikacija 1/0, tiraž 100..."
              className="text-sm"
            />
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleParse} disabled={parsing}>
              {parsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Parsiraj (AI)
            </Button>
          </div>

          {parsed && parsed.items.length > 0 && (
            <Card>
              <div className="p-3 border-b text-sm font-medium flex items-center justify-between">
                <span>Prepoznato: {parsed.items.length} stavki</span>
                {parsed.items.some((i) => i.item_type === "digital") && onDigitalDraft && (
                  <span className="text-xs text-muted-foreground">
                    Digital stavke možeš otvoriti u Digital proizvod kalkulatoru →
                  </span>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naziv</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead className="text-right">Kol.</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.items.map((it, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{it.name}</TableCell>
                      <TableCell>
                        <Badge variant={it.item_type === "digital" ? "default" : "secondary"} className="capitalize">
                          {it.item_type === "digital" ? "Digital" : it.item_type === "large_format" ? "Veliki format" : "Razno"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-pre-wrap text-muted-foreground max-w-md">
                        {it.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                      <TableCell className="text-right">
                        {it.item_type === "digital" && onDigitalDraft && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onDigitalDraft(parsedItemToProductDraft(it));
                              onOpenChange(false);
                            }}
                          >
                            <Package className="w-3.5 h-3.5 mr-1" /> Digital proizvod
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
          <Button onClick={handleImport} disabled={!parsed?.items?.length || bulk.isPending}>
            {bulk.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Dodaj kao razno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
