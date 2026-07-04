import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClients } from "@/hooks/useClients";
import {
  parseTenderText,
  createQuoteFromTender,
  type ParseTenderResult,
} from "@/lib/tenderQuickCreate";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: (quoteId: string) => void;
}

export function TenderImportDialog({ open, onOpenChange, onImported }: Props) {
  const [text, setText] = useState("");
  const [clientId, setClientId] = useState("");
  const [parsed, setParsed] = useState<ParseTenderResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data: clients = [] } = useClients();

  async function handleParse() {
    if (!text.trim()) {
      toast.error("Nalepite tekst tendera/mejla");
      return;
    }
    setParsing(true);
    try {
      const res = await parseTenderText(text);
      setParsed(res);
      if (!res.items?.length) toast.warning("AI nije pronašao stavke — proverite tekst.");
    } catch (e: any) {
      toast.error(e.message ?? "Greška pri parsiranju");
    } finally {
      setParsing(false);
    }
  }

  async function handleCreate() {
    if (!parsed) return;
    if (!clientId) {
      toast.error("Izaberite klijenta");
      return;
    }
    setCreating(true);
    try {
      const id = await createQuoteFromTender({ clientId, parsed });
      toast.success(`Kreirana ponuda sa ${parsed.items.length} stavki`);
      onImported(id);
    } catch (e: any) {
      toast.error(e.message ?? "Greška pri kreiranju ponude");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" /> Uvoz tendera (AI parser)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tekst tendera / mejla</Label>
            <Textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nalepite tekst poziva za ponudu ili mejla klijenta — AI će izvući stavke, dimenzije, količine, materijale…"
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
              <div className="p-3 border-b flex items-center justify-between">
                <div className="font-medium">Prepoznate stavke ({parsed.items.length})</div>
                {parsed.client_hint && (
                  <div className="text-xs text-muted-foreground">
                    Klijent iz teksta: <b>{parsed.client_hint}</b>
                  </div>
                )}
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
              <div className="p-3 border-t space-y-2">
                <Label>Klijent za ponudu *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Izaberite klijenta" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
          <Button
            onClick={handleCreate}
            disabled={!parsed || !parsed.items.length || !clientId || creating}
          >
            {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Kreiraj ponudu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
