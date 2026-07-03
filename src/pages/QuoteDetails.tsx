import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import {
  ArrowLeft, Pencil, Trash2, Plus, FileText, Send, CheckCircle, XCircle,
  Clock, Archive, Copy, Download, GitBranch, Loader2, Eye, Users, Target,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useQuote, useUpdateQuote, useDeleteQuote, useDuplicateQuote,
  useAddQuoteItem, useUpdateQuoteItem, useDeleteQuoteItem, useRecalculateQuoteTotals,
  type QuoteStatus, type QuoteItemType,
} from "@/hooks/useQuotesPro";
import { QuoteProActivityPanel } from "@/components/quotes-pro/QuoteProActivityPanel";
import { SendQuoteProDialog } from "@/components/quotes-pro/SendQuoteProDialog";
import { QuoteItemsTable } from "@/components/quotes/QuoteItemsTable";
import { QuoteFloatingPriceSummary } from "@/components/quotes/QuoteFloatingPriceSummary";
import { QuoteActivityTimeline } from "@/components/quotes/QuoteActivityTimeline";
import { AddQuoteItemDialog } from "@/components/quotes/AddQuoteItemDialog";
import { ChangeClientDialog } from "@/components/quotes/ChangeClientDialog";
import { SetTargetPriceDialog } from "@/components/quotes/SetTargetPriceDialog";
import { QuoteCalculationWorkspace } from "@/components/quotes/QuoteCalculationWorkspace";
import { QuoteVersionHistory } from "@/components/quotes/QuoteVersionHistory";
import { QuoteCollaboratorsCard } from "@/components/quotes/QuoteCollaboratorsCard";

import { generateQuoteProPdf } from "@/lib/quoteProPdf";
import { useSignerProfile } from "@/hooks/useSignerProfile";

const statusConfig: Record<
  QuoteStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof FileText }
> = {
  draft:      { label: "Nacrt",      variant: "secondary",   icon: FileText },
  sent:       { label: "Poslata",    variant: "default",     icon: Send },
  accepted:   { label: "Prihvaćena", variant: "default",     icon: CheckCircle },
  rejected:   { label: "Odbijena",   variant: "destructive", icon: XCircle },
  expired:    { label: "Istekla",    variant: "outline",     icon: Clock },
  superseded: { label: "Zamenjena",  variant: "outline",     icon: Archive },
};

const ITEM_TYPES: { value: QuoteItemType; label: string }[] = [
  { value: "large_format", label: "Veliki format" },
  { value: "digital", label: "Digitalna štampa" },
  { value: "service", label: "Usluga" },
  { value: "razno", label: "Razno" },
];

const fmtEur = (n: number | null | undefined) =>
  new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(n ?? 0));

export default function QuoteDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quote, isLoading } = useQuote(id);
  const update = useUpdateQuote();
  const del = useDeleteQuote();
  const dup = useDuplicateQuote();
  const addItem = useAddQuoteItem();
  const updItem = useUpdateQuoteItem();
  const delItem = useDeleteQuoteItem();
  const recalc = useRecalculateQuoteTotals();
  const { data: signer } = useSignerProfile();

  const [sendOpen, setSendOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [changeClientOpen, setChangeClientOpen] = useState(false);
  const [targetPriceOpen, setTargetPriceOpen] = useState(false);
  const [editData, setEditData] = useState({
    notes: "",
    internal_notes: "",
    payment_terms: "",
    delivery_days: 0,
    discount_percent: 0,
  });

  useEffect(() => {
    if (quote) {
      setEditData({
        notes: quote.notes ?? "",
        internal_notes: quote.internal_notes ?? "",
        payment_terms: quote.payment_terms ?? "",
        delivery_days: quote.delivery_days ?? 0,
        discount_percent: Number(quote.discount_percent) || 0,
      });
    }
  }, [quote?.id]);

  async function handleSaveEdit() {
    if (!quote) return;
    const newFinal = Number(quote.total_price) * (1 - editData.discount_percent / 100);
    await update.mutateAsync({
      id: quote.id,
      notes: editData.notes || undefined,
      internal_notes: editData.internal_notes || undefined,
      payment_terms: editData.payment_terms || undefined,
      delivery_days: editData.delivery_days || undefined,
      discount_percent: editData.discount_percent,
      final_price: newFinal,
    });
    setIsEditing(false);
    toast.success("Ponuda sačuvana");
  }

  async function handleStatusChange(newStatus: QuoteStatus) {
    if (!quote) return;
    await update.mutateAsync({ id: quote.id, status: newStatus });
    toast.success("Status ažuriran");
  }

  async function handleDelete() {
    if (!quote) return;
    await del.mutateAsync(quote.id);
    navigate("/quotes");
  }

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

  function handleAddItem() {
    if (!quote) return;
    setAddItemOpen(true);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Ponuda" />
        <div className="mx-auto max-w-[1600px] p-3 md:p-4 lg:p-8 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-64 md:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Ponuda" />
        <div className="mx-auto max-w-[1600px] p-3 md:p-4 lg:p-8 flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Ponuda nije pronađena</h2>
          <Button variant="outline" onClick={() => navigate("/quotes")} className="mt-4">
            Nazad na listu
          </Button>
        </div>
      </div>
    );
  }

  const info = statusConfig[quote.status];
  const StatusIcon = info.icon;
  const canEdit = quote.status === "draft";
  const items = quote.items ?? [];

  const totalEur = Number(quote.total_price ?? 0);
  const discountEur = totalEur * Number(quote.discount_percent ?? 0) / 100;
  const finalEur = isEditing
    ? totalEur * (1 - editData.discount_percent / 100)
    : Number(quote.final_price ?? totalEur);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title={quote.quote_number} />
      <div className="mx-auto max-w-[1600px] p-3 md:p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{quote.quote_number}</h1>
                {quote.revision_number > 1 && (
                  <Badge variant="outline" className="gap-1">
                    <GitBranch className="h-3 w-3" />
                    v{quote.revision_number}
                  </Badge>
                )}
                <Badge variant={info.variant} className="gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {info.label}
                </Badge>
                {canEdit && (
                  <Select value={quote.status} onValueChange={(v) => handleStatusChange(v as QuoteStatus)}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(statusConfig) as QuoteStatus[])
                        .filter((s) => s !== "superseded")
                        .map((s) => (
                          <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {quote.job_name && (
                <div className="text-sm text-muted-foreground mt-1">{quote.job_name}</div>
              )}
              <p className="text-sm text-muted-foreground">
                {quote.client?.name} • Kreirao: {quote.creator?.full_name ?? "—"} •{" "}
                {format(new Date(quote.created_at), "dd.MM.yyyy HH:mm", { locale: sr })}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handlePreviewPdf} disabled={pdfBusy || items.length === 0} className="gap-2">
              {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              PDF pregled
            </Button>
            <Button variant="outline" onClick={() => setSendOpen(true)} className="gap-2">
              <Send className="h-4 w-4" />
              Pošalji
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                dup.mutate(
                  { quoteId: quote.id, asNewVersion: false },
                  { onSuccess: (newId) => navigate(`/quotes/${newId}`) },
                )
              }
              className="gap-2"
              title="Kreiraj nezavisnu kopiju u statusu Nacrt"
            >
              <Copy className="h-4 w-4" />
              Dupliraj
            </Button>
            {(quote.status === "sent" || quote.status === "rejected" || quote.status === "expired") && (
              <Button
                variant="outline"
                onClick={() =>
                  dup.mutate(
                    { quoteId: quote.id, asNewVersion: true },
                    { onSuccess: (newId) => navigate(`/quotes/${newId}`) },
                  )
                }
                className="gap-2"
                title="Kreiraj novu verziju (originalna se označava kao Zamenjena)"
              >
                <GitBranch className="h-4 w-4" />
                Nova verzija
              </Button>
            )}
            {canEdit && (
              <>
                <Button variant="outline" onClick={() => setChangeClientOpen(true)} className="gap-2">
                  <Users className="h-4 w-4" /> Klijent
                </Button>
                <Button variant="outline" onClick={() => setTargetPriceOpen(true)} className="gap-2">
                  <Target className="h-4 w-4" /> Ciljna cena
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing((v) => !v)}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  {isEditing ? "Otkaži" : "Izmeni"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Obriši ponudu?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Ova akcija se ne može poništiti. Ponuda i sve stavke biće trajno obrisane.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Odustani</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Obriši</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

        {/* Compact summary bar */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Suma stavki</div>
                <div className="text-sm font-semibold tabular-nums">{fmtEur(totalEur)} €</div>
              </div>

              {isEditing ? (
                <div className="rounded-md border bg-muted/30 px-3 py-1.5">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Popust %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-7 w-20 px-2"
                    value={editData.discount_percent}
                    onChange={(e) =>
                      setEditData((p) => ({ ...p, discount_percent: Number(e.target.value) }))
                    }
                  />
                </div>
              ) : (
                Number(quote.discount_percent) > 0 && (
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Popust {quote.discount_percent}%
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-destructive">
                      -{fmtEur(discountEur)} €
                    </div>
                  </div>
                )
              )}

              <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-primary/80">Ukupno</div>
                <div className="text-base font-bold tabular-nums text-primary">{fmtEur(finalEur)} €</div>
              </div>

              {quote.expires_at && (
                <div className="rounded-md border bg-muted/30 px-3 py-2 ml-auto">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Ističe</div>
                  <div className="text-sm font-semibold tabular-nums">
                    {format(new Date(quote.expires_at), "dd.MM.yyyy", { locale: sr })}
                  </div>
                </div>
              )}
            </div>

            {isEditing && (
              <div className="mt-3 flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Odustani</Button>
                <Button size="sm" onClick={handleSaveEdit}>Sačuvaj</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main grid: items + side panel */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Stavke ponude</CardTitle>
                {canEdit && (
                  <Button size="sm" onClick={handleAddItem}>
                    <Plus className="h-4 w-4 mr-1" /> Dodaj stavku
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <QuoteItemsTable
                  items={items}
                  quoteId={quote.id}
                  canEdit={canEdit}
                  onChange={handleItemChange}
                  onDelete={handleDeleteItem}
                />
              </CardContent>
            </Card>

            {/* Notes card */}
            {(quote.notes || quote.internal_notes || quote.payment_terms || isEditing) && (
              <Card>
                <CardHeader><CardTitle>Uslovi i napomene</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label>Uslovi plaćanja</Label>
                        <Textarea
                          rows={2}
                          value={editData.payment_terms}
                          onChange={(e) => setEditData((p) => ({ ...p, payment_terms: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Napomena za klijenta</Label>
                        <Textarea
                          rows={3}
                          value={editData.notes}
                          onChange={(e) => setEditData((p) => ({ ...p, notes: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Interna napomena</Label>
                        <Textarea
                          rows={2}
                          value={editData.internal_notes}
                          onChange={(e) => setEditData((p) => ({ ...p, internal_notes: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rok isporuke (dana)</Label>
                        <Input
                          type="number"
                          value={editData.delivery_days}
                          onChange={(e) => setEditData((p) => ({ ...p, delivery_days: Number(e.target.value) }))}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {quote.payment_terms && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Uslovi plaćanja</div>
                          <div className="text-sm whitespace-pre-wrap">{quote.payment_terms}</div>
                        </div>
                      )}
                      {quote.notes && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Napomena za klijenta</div>
                          <div className="text-sm whitespace-pre-wrap">{quote.notes}</div>
                        </div>
                      )}
                      {quote.internal_notes && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Interna napomena</div>
                          <div className="text-sm whitespace-pre-wrap text-muted-foreground">{quote.internal_notes}</div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Side panel */}
          <div className="space-y-6">
            <QuoteCalculationWorkspace
              quoteId={quote.id}
              items={items}
              defaultMarkupPercent={Number(quote.default_markup_percent ?? 300)}
            />
            <QuoteVersionHistory
              quoteId={quote.id}
              parentId={quote.parent_quote_id}
              currentRevision={quote.revision_number}
            />
            <QuoteCollaboratorsCard quoteId={quote.id} />
            <QuoteActivityTimeline quoteId={quote.id} />
            <QuoteProActivityPanel quoteId={quote.id} />
          </div>
        </div>
      </div>

      <QuoteFloatingPriceSummary quote={quote} />


      {sendOpen && (
        <SendQuoteProDialog quoteId={quote.id} open={sendOpen} onOpenChange={setSendOpen} />
      )}

      {addItemOpen && (
        <AddQuoteItemDialog
          open={addItemOpen}
          onOpenChange={setAddItemOpen}
          quoteId={quote.id}
          orderIndex={items.length}
        />
      )}

      {changeClientOpen && (
        <ChangeClientDialog
          open={changeClientOpen}
          onOpenChange={setChangeClientOpen}
          quoteId={quote.id}
          currentClientId={quote.client_id}
        />
      )}

      {targetPriceOpen && (
        <SetTargetPriceDialog
          open={targetPriceOpen}
          onOpenChange={setTargetPriceOpen}
          quoteId={quote.id}
          currentTarget={(quote as any).target_price_eur ?? null}
          currentFinal={finalEur}
        />
      )}
    </div>
  );
}
