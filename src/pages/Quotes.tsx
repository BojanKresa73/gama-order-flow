import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { sr } from "date-fns/locale";
import {
  Plus, Search, FileText, Send, CheckCircle, XCircle, Clock,
  Filter, Trash2, Copy, AlertTriangle, Archive, Wand2, Wrench,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { QuoteQuickFilters } from "@/components/quotes/QuoteQuickFilters";
import {
  useQuotes,
  useDeleteQuote,
  useDuplicateQuote,
  type QuoteStatus,
  type QuoteFilters,
  type QuoteQuickFilter,
} from "@/hooks/useQuotesPro";
import { useClients } from "@/hooks/useClients";
import { TenderImportDialog } from "@/components/quotes-pro/TenderImportDialog";

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

const fmtEur = (n: number | null | undefined) =>
  new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(n ?? 0));

export default function Quotes() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<QuoteFilters>({
    search: "",
    status: "all",
    quickFilter: "all",
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tenderOpen, setTenderOpen] = useState(false);

  const { data: quotes, isLoading } = useQuotes(filters);
  const { data: clients } = useClients();
  const deleteQuote = useDeleteQuote();
  const duplicateQuote = useDuplicateQuote();

  const stats = {
    total: quotes?.length || 0,
    draft: quotes?.filter((q) => q.status === "draft").length || 0,
    sent: quotes?.filter((q) => q.status === "sent").length || 0,
    totalValue: quotes?.reduce(
      (sum, q) => sum + (q.status === "accepted" ? Number(q.final_price) : 0),
      0,
    ) || 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Ponude" />
      <div className="mx-auto max-w-[1600px] p-3 md:p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ponude</h1>
            <p className="text-muted-foreground">
              Upravljanje ponudama i kalkulacijama
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/quotes-legacy")} className="gap-2" title="Stari alati: brzi kalkulator, paste, PDF uvoz">
              <Wrench className="h-4 w-4" />
              Legacy alati
            </Button>
            <Button variant="outline" onClick={() => setTenderOpen(true)} className="gap-2">
              <Wand2 className="h-4 w-4" />
              Uvezi tender (AI)
            </Button>
            <Button onClick={() => navigate("/quotes/new")} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova ponuda
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ukupno ponuda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Nacrti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{stats.draft}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Čekaju odgovor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{stats.sent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Vrednost prihvaćenih
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">
                {fmtEur(stats.totalValue)} EUR
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick filters */}
        <QuoteQuickFilters
          value={(filters.quickFilter ?? "all") as QuoteQuickFilter}
          onChange={(k) => setFilters((p) => ({ ...p, quickFilter: k }))}
        />

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Pretraži po broju, klijentu..."
                  value={filters.search ?? ""}
                  onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={filters.status || "all"}
                  onValueChange={(v) => setFilters((p) => ({ ...p, status: v as QuoteStatus | "all" }))}
                >
                  <SelectTrigger className="w-[160px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Svi statusi</SelectItem>
                    <SelectItem value="draft">Nacrt</SelectItem>
                    <SelectItem value="sent">Poslata</SelectItem>
                    <SelectItem value="accepted">Prihvaćena</SelectItem>
                    <SelectItem value="rejected">Odbijena</SelectItem>
                    <SelectItem value="expired">Istekla</SelectItem>
                    <SelectItem value="superseded">Zamenjena</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.clientId || "all"}
                  onValueChange={(v) => setFilters((p) => ({ ...p, clientId: v === "all" ? undefined : v }))}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Klijent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Svi klijenti</SelectItem>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Broj ponude</TableHead>
                  <TableHead>Klijent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Iznos</TableHead>
                  <TableHead>Kreirao</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Ističe</TableHead>
                  <TableHead className="w-[110px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (quotes?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileText className="h-8 w-8" />
                        <p>Nema ponuda</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate("/quotes/new")}
                        >
                          Kreiraj prvu ponudu
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  quotes!.map((quote) => {
                    const info = statusConfig[quote.status];
                    const Icon = info.icon;
                    return (
                      <TableRow
                        key={quote.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/quotes/${quote.id}`)}
                      >
                        <TableCell className="font-mono font-medium">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span>{quote.quote_number}</span>
                              {quote.revision_number > 1 && (
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                  v{quote.revision_number}
                                </Badge>
                              )}
                            </div>
                            {quote.job_name && (
                              <span className="font-sans text-xs font-normal text-muted-foreground line-clamp-1">
                                {quote.job_name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{quote.client?.name ?? "—"}</div>
                            {quote.client?.pib && (
                              <div className="text-xs text-muted-foreground">
                                PIB: {quote.client.pib}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={info.variant} className="gap-1">
                            <Icon className="h-3 w-3" />
                            {info.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {fmtEur(quote.final_price ?? quote.total_price)} EUR
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {quote.creator?.full_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(quote.created_at), "dd.MM.yyyy", { locale: sr })}
                        </TableCell>
                        <TableCell>
                          {quote.expires_at ? (() => {
                            const days = differenceInDays(new Date(quote.expires_at), new Date());
                            const expired = days < 0;
                            const soon = !expired && days <= 3 && quote.status === "sent";
                            return (
                              <div className="flex items-center gap-1.5">
                                <span className={expired ? "text-destructive" : "text-muted-foreground"}>
                                  {format(new Date(quote.expires_at), "dd.MM.yyyy", { locale: sr })}
                                </span>
                                {soon && (
                                  <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1 h-5 px-1.5 text-[10px]">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    {days === 0 ? "danas" : `${days}d`}
                                  </Badge>
                                )}
                              </div>
                            );
                          })() : "—"}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Dupliraj ponudu"
                              onClick={() =>
                                duplicateQuote.mutate(
                                  { quoteId: quote.id, asNewVersion: false },
                                  { onSuccess: (newId) => navigate(`/quotes/${newId}`) },
                                )
                              }
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Obriši ponudu"
                              onClick={() => setDeleteId(quote.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obriši ponudu?</AlertDialogTitle>
            <AlertDialogDescription>
              Ova akcija se ne može poništiti. Ponuda i sve njene stavke biće trajno obrisane.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteId) {
                  await deleteQuote.mutateAsync(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {tenderOpen && (
        <TenderImportDialog
          open={tenderOpen}
          onOpenChange={setTenderOpen}
          onImported={(id) => {
            setTenderOpen(false);
            navigate(`/quotes/${id}`);
          }}
        />
      )}
    </div>
  );
}
