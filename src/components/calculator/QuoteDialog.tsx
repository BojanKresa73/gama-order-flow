import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Download, Send, Save, Loader2, FileText, Check, ChevronsUpDown, UserPlus, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSignerProfile } from "@/hooks/useSignerProfile";
import { useClients, type Client } from "@/hooks/useClients";
import { generateQuotePdf, downloadPdf, pdfToBase64, type QuoteItemPdf } from "@/lib/quotePdf";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: QuoteItemPdf[];
  total: number;
}

type Mode = "existing" | "prospect";

export function QuoteDialog({ open, onOpenChange, items, total }: Props) {
  const { data: signer } = useSignerProfile();
  const { data: clients = [] } = useClients();

  const [mode, setMode] = useState<Mode>("existing");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [emailOverride, setEmailOverride] = useState("");

  const [prospectName, setProspectName] = useState("");

  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"" | "download" | "send" | "save" | "preview">("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Revoke preview blob URLs on change/unmount to avoid leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Clear preview whenever inputs change so user knows it's stale.
  useEffect(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedClient?.id, emailOverride, prospectName, notes, items, total]);

  const resolved = useMemo(() => {
    if (mode === "existing" && selectedClient) {
      const addrParts = [selectedClient.adresa, selectedClient.postanski_broj, selectedClient.grad].filter(Boolean);
      return {
        clientName: selectedClient.kontakt_osoba || selectedClient.name,
        clientCompany: selectedClient.name,
        clientEmail: (emailOverride.trim() || selectedClient.email || "").trim(),
        clientPib: selectedClient.pib || undefined,
        clientAddress: addrParts.length ? addrParts.join(", ") : undefined,
        ok: true,
      };
    }
    if (mode === "prospect" && prospectName.trim()) {
      return {
        clientName: prospectName.trim(),
        clientCompany: undefined,
        clientEmail: emailOverride.trim() || undefined,
        clientPib: undefined,
        clientAddress: undefined,
        ok: true,
      };
    }
    return { ok: false } as any;
  }, [mode, selectedClient, prospectName, emailOverride]);

  const canGenerate = resolved.ok && items.length > 0 && !!signer;

  const buildQuote = async () => {
    const { data: numData } = await (supabase as any).rpc("next_quote_number");
    const quoteNumber = (numData as string) || `PON-${new Date().getFullYear()}-DRAFT`;
    return {
      quoteNumber,
      date: new Date(),
      clientName: resolved.clientName,
      clientCompany: resolved.clientCompany,
      clientEmail: resolved.clientEmail || undefined,
      clientPib: resolved.clientPib,
      clientAddress: resolved.clientAddress,
      notes: notes.trim() || undefined,
      items,
      total,
      signer: signer!,
    };
  };

  const saveToDb = async (quoteNumber: string, sentAt: Date | null) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await (supabase as any).from("quick_calc_quotes").insert({
      user_id: auth.user.id,
      quote_number: quoteNumber,
      client_name: resolved.clientName,
      client_email: resolved.clientEmail || null,
      client_company: resolved.clientCompany || null,
      notes: notes.trim() || null,
      items: items as any,
      total_eur: total,
      signer_name: signer?.fullName ?? null,
      signer_email: signer?.email ?? null,
      signer_phone: signer?.phone ?? null,
      sent_at: sentAt?.toISOString() ?? null,
    });
  };

  const handleDownload = async () => {
    if (!canGenerate) { toast.error("Izaberi klijenta"); return; }
    setBusy("download");
    try {
      const quote = await buildQuote();
      const bytes = await generateQuotePdf(quote);
      downloadPdf(bytes, `${quote.quoteNumber}.pdf`);
      await saveToDb(quote.quoteNumber, null);
      toast.success(`Ponuda ${quote.quoteNumber} preuzeta i sačuvana`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Greška: " + (e?.message || "nepoznata"));
    } finally { setBusy(""); }
  };

  const handleSend = async () => {
    if (!canGenerate) { toast.error("Izaberi klijenta"); return; }
    if (!resolved.clientEmail) { toast.error("Nedostaje email klijenta"); return; }
    setBusy("send");
    try {
      const quote = await buildQuote();
      const bytes = await generateQuotePdf(quote);
      const base64 = pdfToBase64(bytes);
      const html = `
        <div style="font-family:Arial,sans-serif;color:#19213e">
          <p>Poštovani,</p>
          <p>U prilogu Vam šaljemo ponudu <strong>${quote.quoteNumber}</strong>.</p>
          <p>Za sva pitanja stojimo Vam na raspolaganju.</p>
          <p>Srdačan pozdrav,<br><strong>${signer?.fullName}</strong>${signer?.jobTitle ? "<br>" + signer.jobTitle : ""}<br>Gama United d.o.o.</p>
        </div>`;
      const { error } = await supabase.functions.invoke("send-quote-email", {
        body: {
          to: resolved.clientEmail,
          subject: `Ponuda ${quote.quoteNumber} — Gama United`,
          html,
          pdfBase64: base64,
          filename: `${quote.quoteNumber}.pdf`,
        },
      });
      if (error) throw error;
      await saveToDb(quote.quoteNumber, new Date());
      toast.success(`Ponuda ${quote.quoteNumber} poslata na ${resolved.clientEmail}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Slanje nije uspelo: " + (e?.message || "nepoznata"));
    } finally { setBusy(""); }
  };

  const handleSave = async () => {
    if (!canGenerate) { toast.error("Izaberi klijenta"); return; }
    setBusy("save");
    try {
      const quote = await buildQuote();
      await saveToDb(quote.quoteNumber, null);
      toast.success(`Ponuda ${quote.quoteNumber} sačuvana`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Greška: " + (e?.message || "nepoznata"));
    } finally { setBusy(""); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Nova ponuda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            Potpisnik: <strong className="text-foreground">{signer?.fullName || "…"}</strong>
            {signer?.jobTitle && <> · {signer.jobTitle}</>}
            <br />
            {signer?.email} {signer?.phone && <>· {signer.phone}</>}
            {(!signer?.phone || !signer?.jobTitle) && (
              <div className="text-amber-600 mt-1">
                Nedostaju podaci u profilu (telefon/pozicija). Ažuriraj u Podešavanjima profila.
              </div>
            )}
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="existing">Postojeći klijent</TabsTrigger>
              <TabsTrigger value="prospect">
                <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Potencijalni klijent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label>Klijent *</Label>
                <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate text-left">
                        {selectedClient ? selectedClient.name : "Izaberi klijenta…"}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pretraži klijente…" />
                      <CommandList>
                        <CommandEmpty>Nema rezultata.</CommandEmpty>
                        <CommandGroup>
                          {clients.slice(0, 300).map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.name} ${c.pib ?? ""} ${c.email ?? ""}`}
                              onSelect={() => {
                                setSelectedClient(c);
                                setEmailOverride("");
                                setClientPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedClient?.id === c.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{c.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {[c.pib && `PIB ${c.pib}`, c.grad, c.email].filter(Boolean).join(" · ")}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedClient && (
                  <div className="text-xs text-muted-foreground pt-1">
                    {[selectedClient.adresa, selectedClient.grad, selectedClient.pib && `PIB ${selectedClient.pib}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Email za slanje {selectedClient?.email && <span className="text-xs text-muted-foreground">(podrazumevano: {selectedClient.email})</span>}</Label>
                <Input
                  type="email"
                  value={emailOverride}
                  onChange={(e) => setEmailOverride(e.target.value)}
                  placeholder={selectedClient?.email || "kontakt@firma.rs"}
                />
              </div>
            </TabsContent>

            <TabsContent value="prospect" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label>Ime / naziv potencijalnog klijenta *</Label>
                <Input
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  placeholder="Petar Petrović ili Firma d.o.o."
                />
                <p className="text-xs text-muted-foreground">
                  Ponuda se ne vezuje za bazu klijenata. Kasnije, ako postane klijent, dodaj ga u bazu.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Email (opciono, za slanje)</Label>
                <Input
                  type="email"
                  value={emailOverride}
                  onChange={(e) => setEmailOverride(e.target.value)}
                  placeholder="kontakt@firma.rs"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-1.5">
            <Label>Napomena (opciono)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Rok isporuke, način plaćanja…" />
          </div>

          <div className="rounded-md border bg-primary/5 p-2 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">{items.length} stavki · Ukupno</span>
            <span className="font-bold text-primary">
              {new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2 }).format(total)} EUR
            </span>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={!!busy || !canGenerate}>
            {busy === "save" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Sačuvaj
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!!busy || !canGenerate}>
            {busy === "download" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Preuzmi PDF
          </Button>
          <Button size="sm" onClick={handleSend} disabled={!!busy || !canGenerate || !resolved.clientEmail}>
            {busy === "send" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Pošalji email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
