import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Send, FileText, Copy, Eye } from "lucide-react";
import { generateQuoteProPdf } from "@/lib/quoteProPdf";
import { useSignerProfile } from "@/hooks/useSignerProfile";
import { SendQuoteProDialog } from "./SendQuoteProDialog";
import { QuoteProActivityPanel } from "./QuoteProActivityPanel";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useClients } from "@/hooks/useClients";
import {
  useQuotePro,
  useCreateQuotePro,
  useUpdateQuotePro,
  useAddQuoteItemPro,
  useUpdateQuoteItemPro,
  useDeleteQuoteItemPro,
  useRecalculateQuoteTotalsPro,
  useDuplicateQuotePro,
  type QuoteStatus,
  type QuoteItemType,
} from "@/hooks/useQuotesPro";

interface Props {
  quoteId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const fmtEur = (n: number | null | undefined) =>
  new Intl.NumberFormat("sr-RS", { style: "currency", currency: "EUR" }).format(Number(n ?? 0));

const STATUSES: { value: QuoteStatus; label: string }[] = [
  { value: "draft", label: "Nacrt" },
  { value: "sent", label: "Poslato" },
  { value: "accepted", label: "Prihvaćeno" },
  { value: "rejected", label: "Odbijeno" },
  { value: "expired", label: "Isteklo" },
];

const ITEM_TYPES: { value: QuoteItemType; label: string }[] = [
  { value: "large_format", label: "Veliki format" },
  { value: "digital", label: "Digitalna štampa" },
  { value: "service", label: "Usluga" },
  { value: "razno", label: "Razno" },
];

export function QuoteProEditor({ quoteId, open, onOpenChange }: Props) {
  const isNew = quoteId === null;
  const { data: quote, isLoading } = useQuotePro(quoteId ?? undefined);
  const { data: clients = [] } = useClients();

  const create = useCreateQuotePro();
  const update = useUpdateQuotePro();
  const addItem = useAddQuoteItemPro();
  const updItem = useUpdateQuoteItemPro();
  const delItem = useDeleteQuoteItemPro();
  const recalc = useRecalculateQuoteTotalsPro();
  const dup = useDuplicateQuotePro();
  const { data: signer } = useSignerProfile();
  const [sendOpen, setSendOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  async function handlePreviewPdf() {
    if (!quote || !signer) return;
    setPdfBusy(true);
    try {
      const bytes = await generateQuoteProPdf(quote, quote.items ?? [], signer);
      const blob = new Blob([bytes as unknown as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e: any) {
      toast.error(e.message ?? "Greška pri generisanju PDF-a");
    } finally {
      setPdfBusy(false);
    }
  }

  const [clientId, setClientId] = useState("");
  const [jobName, setJobName] = useState("");
  const [status, setStatus] = useState<QuoteStatus>("draft");
  const [validDays, setValidDays] = useState(14);
  const [discount, setDiscount] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryDays, setDeliveryDays] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (quote) {
      setClientId(quote.client_id);
      setJobName(quote.job_name ?? "");
      setStatus(quote.status);
      setValidDays(quote.valid_days ?? 14);
      setDiscount(Number(quote.discount_percent ?? 0));
      setPaymentTerms(quote.payment_terms ?? "");
      setDeliveryDays(quote.delivery_days ?? "");
      setNotes(quote.notes ?? "");
    } else if (isNew) {
      setClientId("");
      setJobName("");
      setStatus("draft");
      setValidDays(14);
      setDiscount(0);
      setPaymentTerms("");
      setDeliveryDays("");
      setNotes("");
    }
  }, [quote, isNew]);

  const items = quote?.items ?? [];

  async function handleSaveHeader() {
    if (!clientId) {
      toast.error("Izaberite klijenta");
      return;
    }
    try {
      if (isNew) {
        const created = await create.mutateAsync({
          client_id: clientId,
          job_name: jobName || undefined,
          valid_days: validDays,
          payment_terms: paymentTerms || undefined,
          delivery_days: deliveryDays === "" ? undefined : Number(deliveryDays),
          notes: notes || undefined,
        });
        toast.success("Ponuda kreirana");
        onOpenChange(false);
        // Re-open with real id via parent list refresh; simplest = close.
        return created;
      }
      await update.mutateAsync({
        id: quote!.id,
        client_id: clientId,
        job_name: jobName || null,
        status,
        valid_days: validDays,
        discount_percent: discount,
        payment_terms: paymentTerms || null,
        delivery_days: deliveryDays === "" ? null : Number(deliveryDays),
        notes: notes || null,
      });
      await recalc.mutateAsync(quote!.id);
      toast.success("Ponuda snimljena");
    } catch (e: any) {
      toast.error(e.message ?? "Greška");
    }
  }

  async function handleAddItem() {
    if (!quote) return;
    await addItem.mutateAsync({
      quote_id: quote.id,
      item_type: "large_format",
      name: "Nova stavka",
      description: null,
      quantity: 1,
      width_mm: null, height_mm: null, pages: null, print_sides: null,
      paper_type: null, paper_gsm: null, sheet_format: null,
      material_id: null, material_name: null, area_m2: null,
      service_id: null, service_name: null,
      unit_cost: 0, unit_price: 0, custom_price: null, line_total: 0,
      supplier_name: null, supplier_price: null, cost_per_m2: null,
      finishing_cost: 0, markup_percent: null, source_category: null,
      min_qty_per_order: null, yearly_qty: null,
      order_index: items.length,
    } as any);
    await recalc.mutateAsync(quote.id);
  }

  async function handleItemChange(itemId: string, patch: Record<string, any>) {
    if (!quote) return;
    await updItem.mutateAsync({ id: itemId, quote_id: quote.id, ...patch });
    await recalc.mutateAsync(quote.id);
  }

  async function handleDeleteItem(itemId: string) {
    if (!quote) return;
    if (!confirm("Obrisati stavku?")) return;
    await delItem.mutateAsync({ id: itemId, quote_id: quote.id });
    await recalc.mutateAsync(quote.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="w-5 h-5" />
            {isNew
              ? "Nova ponuda"
              : `Ponuda ${quote?.quote_number ?? ""}`}
            {quote && (
              <Badge variant="outline">
                v{quote.revision_number ?? 1}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label>Klijent *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Izaberite klijenta" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as QuoteStatus)} disabled={isNew}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Label>Naziv posla</Label>
                <Input value={jobName} onChange={(e) => setJobName(e.target.value)} />
              </div>
              <div>
                <Label>Rok važenja (dana)</Label>
                <Input type="number" value={validDays} onChange={(e) => setValidDays(Number(e.target.value))} />
              </div>
              <div>
                <Label>Popust (%)</Label>
                <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
              </div>
              <div>
                <Label>Rok isporuke (dana)</Label>
                <Input
                  type="number"
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
              <div className="md:col-span-3">
                <Label>Uslovi plaćanja</Label>
                <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <Label>Napomena za klijenta</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </Card>

            {quote && (
              <Card>
                <div className="flex items-center justify-between p-3 border-b">
                  <div className="font-medium">Stavke ponude</div>
                  <Button size="sm" variant="outline" onClick={handleAddItem}>
                    <Plus className="w-4 h-4 mr-1" /> Dodaj stavku
                  </Button>
                </div>
                {items.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Još nema stavki.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tip</TableHead>
                        <TableHead>Naziv</TableHead>
                        <TableHead>Dim (mm)</TableHead>
                        <TableHead className="w-20">Kol.</TableHead>
                        <TableHead className="w-28">Jed. cena</TableHead>
                        <TableHead className="w-32 text-right">Ukupno</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell>
                            <Select
                              value={it.item_type}
                              onValueChange={(v) => handleItemChange(it.id, { item_type: v })}
                            >
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ITEM_TYPES.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8"
                              defaultValue={it.name}
                              onBlur={(e) => e.target.value !== it.name && handleItemChange(it.id, { name: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Input
                                className="h-8 w-20"
                                type="number"
                                defaultValue={it.width_mm ?? ""}
                                placeholder="Š"
                                onBlur={(e) => handleItemChange(it.id, { width_mm: e.target.value === "" ? null : Number(e.target.value) })}
                              />
                              <Input
                                className="h-8 w-20"
                                type="number"
                                defaultValue={it.height_mm ?? ""}
                                placeholder="V"
                                onBlur={(e) => handleItemChange(it.id, { height_mm: e.target.value === "" ? null : Number(e.target.value) })}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 w-20"
                              type="number"
                              defaultValue={it.quantity}
                              onBlur={(e) => {
                                const qty = Number(e.target.value);
                                const total = qty * Number(it.unit_price ?? 0);
                                handleItemChange(it.id, { quantity: qty, line_total: total });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 w-28"
                              type="number"
                              step="0.01"
                              defaultValue={it.unit_price}
                              onBlur={(e) => {
                                const up = Number(e.target.value);
                                const total = up * Number(it.quantity ?? 0);
                                handleItemChange(it.id, { unit_price: up, line_total: total });
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {fmtEur(it.line_total)}
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteItem(it.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <div className="p-3 border-t flex justify-end gap-6 text-sm">
                  <div>Subtotal: <span className="font-mono">{fmtEur(quote.total_price)}</span></div>
                  <div>Popust: <span className="font-mono">{Number(quote.discount_percent ?? 0)}%</span></div>
                  <div className="font-semibold">
                    Ukupno: <span className="font-mono">{fmtEur(quote.final_price ?? quote.total_price)}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {quote && (
            <Button
              variant="outline"
              onClick={async () => {
                await dup.mutateAsync({ quoteId: quote.id, asNewVersion: true });
                onOpenChange(false);
              }}
            >
              <Copy className="w-4 h-4 mr-2" /> Nova verzija
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zatvori</Button>
          <Button onClick={handleSaveHeader} disabled={create.isPending || update.isPending}>
            {(create.isPending || update.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Sačuvaj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
