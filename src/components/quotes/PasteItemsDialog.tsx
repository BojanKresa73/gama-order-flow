import { useMemo, useState } from "react";
import { ClipboardPaste, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useBulkInsertQuoteItemsPro } from "@/hooks/useQuotesPro";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  quoteId: string;
  startOrderIndex: number;
  onImported?: () => void;
}

interface ParsedRow {
  name: string;
  quantity: number;
  unit_price: number;
}

/** Parse pasted text: each line = "Naziv <tab|;|,|  > količina <sep> jed. cena (RSD)". */
function parseLines(text: string): ParsedRow[] {
  const num = (s: string) => {
    const n = Number(String(s ?? "").replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const out: ParsedRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // split by tab, semicolon, pipe, or 2+ spaces
    const parts = line.split(/\t+|\s*[|;]\s*|\s{2,}/).filter(Boolean);
    if (parts.length < 2) {
      out.push({ name: line, quantity: 1, unit_price: 0 });
      continue;
    }
    const name = parts[0];
    const qty = parts.length >= 3 ? num(parts[1]) : 1;
    const price = num(parts[parts.length - 1]);
    out.push({
      name,
      quantity: qty > 0 ? qty : 1,
      unit_price: price >= 0 ? price : 0,
    });
  }
  return out;
}

export function PasteItemsDialog({
  open, onOpenChange, quoteId, startOrderIndex, onImported,
}: Props) {
  const [text, setText] = useState("");
  const bulk = useBulkInsertQuoteItemsPro();
  const rows = useMemo(() => parseLines(text), [text]);

  async function handleImport() {
    if (!rows.length) return toast.error("Nema stavki za unos");
    const items = rows.map((r, i) => ({
      quote_id: quoteId,
      item_type: "razno" as any,
      name: r.name,
      description: null,
      quantity: r.quantity,
      unit_cost: 0,
      unit_price: r.unit_price,
      line_total: r.unit_price * r.quantity,
      finishing_cost: 0,
      order_index: startOrderIndex + i,
    })) as any[];
    try {
      await bulk.mutateAsync({ quoteId, items });
      toast.success(`Dodato ${items.length} stavki`);
      setText("");
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
            <ClipboardPaste className="w-5 h-5" /> Nalepi tekst — stavke
          </DialogTitle>
          <DialogDescription>
            Svaki red = jedna stavka. Kolone: <b>Naziv</b>, <b>količina</b>, <b>jed. cena (RSD)</b>.
            Separator: TAB, "|", ";", ili 2+ razmaka.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tekst</Label>
            <Textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Vizit karte\t500\t12\nRoll-up 85x200\t2\t3500\nBrošura A5\t100\t250"}
              className="font-mono text-sm"
            />
          </div>

          {rows.length > 0 && (
            <Card>
              <div className="p-3 border-b text-sm font-medium">
                Prepoznato: {rows.length} stavki
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naziv</TableHead>
                    <TableHead className="text-right">Kol.</TableHead>
                    <TableHead className="text-right">Jed. cena</TableHead>
                    <TableHead className="text-right">Ukupno</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.unit_price.toLocaleString("sr-RS")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(r.unit_price * r.quantity).toLocaleString("sr-RS")}
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
          <Button onClick={handleImport} disabled={!rows.length || bulk.isPending}>
            {bulk.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Dodaj u ponudu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
