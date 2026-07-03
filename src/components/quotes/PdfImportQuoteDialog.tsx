import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Download, Send, Save, Loader2, Eye, Check, ChevronsUpDown, UserPlus, Upload, FileText, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSignerProfile } from "@/hooks/useSignerProfile";
import { useClients, type Client } from "@/hooks/useClients";
import { generatePdfOverlayQuote } from "@/lib/pdfOverlayQuote";
import { downloadPdf, pdfToBase64 } from "@/lib/quotePdf";
import { PdfPreview } from "@/components/calculator/PdfPreview";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

type Mode = "existing" | "prospect";

export function PdfImportQuoteDialog({ open, onOpenChange, onSaved }: Props) {
  const { data: signer } = useSignerProfile();
  const { data: clients = [] } = useClients();

  const [mode, setMode] = useState<Mode>("existing");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [emailOverride, setEmailOverride] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [prospectCompany, setProspectCompany] = useState("");
  const [totalStr, setTotalStr] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"" | "download" | "send" | "save" | "preview">("");
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBuf, setPdfBuf] = useState<ArrayBuffer | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setPreviewBytes(null);
      setPdfFile(null);
      setPdfBuf(null);
    }
  }, [open]);

  useEffect(() => {
    setPreviewBytes(null);
  }, [mode, selectedClient?.id, emailOverride, prospectName, prospectCompany, totalStr, notes, pdfFile]);

  const resolved = useMemo(() => {
    if (mode === "existing" && selectedClient) {
      const addrParts = [selectedClient.adresa, selectedClient.postanski_broj, selectedClient.grad].filter(Boolean);
      return {
        ok: true,
        clientName: selectedClient.kontakt_osoba || selectedClient.name,
        clientCompany: selectedClient.name,
        clientEmail: (emailOverride.trim() || selectedClient.email || "").trim(),
        clientPib: selectedClient.pib || undefined,
        clientAddress: addrParts.length ? addrParts.join(", ") : undefined,
      };
    }
    if (mode === "prospect" && (prospectName.trim() || prospectCompany.trim())) {
      return {
        ok: true,
        clientName: prospectName.trim() || prospectCompany.trim(),
        clientCompany: prospectCompany.trim() || undefined,
        clientEmail: emailOverride.trim() || undefined,
        clientPib: undefined,
        clientAddress: undefined,
      };
    }
    return { ok: false } as any;
  }, [mode, selectedClient, prospectName, prospectCompany, emailOverride]);

  const canGenerate = resolved.ok && !!signer && !!pdfBuf;

  const parseTotal = (): number | null => {
    const cleaned = totalStr.replace(/\./g, "").replace(",", ".").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return isFinite(n) && n > 0 ? n : null;
  };

  const handlePickFile = async (f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Odaberi PDF fajl");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("PDF veći od 20MB");
      return;
    }
    try {
      const buf = await f.arrayBuffer();
      setPdfFile(f);
      setPdfBuf(buf);
    } catch (e: any) {
      toast.error("Ne mogu da učitam PDF: " + (e?.message || ""));
    }
  };

  const buildQuote = async () => {
    const { data: numData } = await (supabase as any).rpc("next_pasted_quote_number");
    const quoteNumber = (numData as string) || `PON-M-${new Date().getFullYear()}-DRAFT`;
    return {
      quoteNumber,
      date: new Date(),
      clientName: resolved.clientName,
      clientCompany: resolved.clientCompany,
      clientEmail: resolved.clientEmail || undefined,
      clientPib: resolved.clientPib,
      clientAddress: resolved.clientAddress,
      sourcePdf: pdfBuf!.slice(0),
      totalEur: parseTotal(),
      notes: notes.trim() || undefined,
      signer: signer!,
    };
  };

  const saveToDb = async (quoteNumber: string, sentAt: Date | null) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await (supabase as any).from("quick_calc_quotes").insert({
      user_id: auth.user.id,
      quote_number: quoteNumber,
      source: "pasted",
      client_name: resolved.clientName,
      client_email: resolved.clientEmail || null,
      client_company: resolved.clientCompany || null,
      client_pib: resolved.clientPib || null,
      client_address: resolved.clientAddress || null,
      notes: notes.trim() || null,
      body_html: `<p><em>Uvezen PDF: ${pdfFile?.name || ""}</em></p>`,
      items: [] as any,
      total_eur: parseTotal(),
      signer_name: signer?.fullName ?? null,
      signer_email: signer?.email ?? null,
      signer_phone: signer?.phone ?? null,
      signer_job_title: signer?.jobTitle ?? null,
      sent_at: sentAt?.toISOString() ?? null,
    });
    onSaved?.();
  };

  const handlePreview = async () => {
    if (!canGenerate) { toast.error("Izaberi klijenta i PDF"); return; }
    setBusy("preview");
    try {
      const q = await buildQuote();
      const bytes = await generatePdfOverlayQuote(q);
      setPreviewBytes(bytes);
    } catch (e: any) {
      toast.error("Pregled nije uspeo: " + (e?.message || ""));
    } finally { setBusy(""); }
  };

  const handleDownload = async () => {
    if (!canGenerate) { toast.error("Izaberi klijenta i PDF"); return; }
    setBusy("download");
    try {
      const q = await buildQuote();
      const bytes = await generatePdfOverlayQuote(q);
      downloadPdf(bytes, `${q.quoteNumber}.pdf`);
      await saveToDb(q.quoteNumber, null);
      toast.success(`Ponuda ${q.quoteNumber} preuzeta i sačuvana`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Greška: " + (e?.message || ""));
    } finally { setBusy(""); }
  };

  const handleSave = async () => {
    if (!canGenerate) { toast.error("Izaberi klijenta i PDF"); return; }
    setBusy("save");
    try {
      const q = await buildQuote();
      await saveToDb(q.quoteNumber, null);
      toast.success(`Ponuda ${q.quoteNumber} sačuvana`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Greška: " + (e?.message || ""));
    } finally { setBusy(""); }
  };

  const handleSend = async () => {
    if (!canGenerate) { toast.error("Izaberi klijenta i PDF"); return; }
    if (!resolved.clientEmail) { toast.error("Nedostaje email klijenta"); return; }
    setBusy("send");
    try {
      const q = await buildQuote();
      const bytes = await generatePdfOverlayQuote(q);
      const base64 = pdfToBase64(bytes);
      const html = `
        <div style="font-family:Arial,sans-serif;color:#19213e">
          <p>Poštovani,</p>
          <p>U prilogu Vam šaljemo ponudu <strong>${q.quoteNumber}</strong>.</p>
          <p>Za sva pitanja stojimo Vam na raspolaganju.</p>
          <p>Srdačan pozdrav,<br><strong>${signer?.fullName}</strong>${signer?.jobTitle ? "<br>" + signer.jobTitle : ""}<br>Gama United d.o.o.</p>
        </div>`;
      const { error } = await supabase.functions.invoke("send-quote-email", {
        body: {
          to: resolved.clientEmail,
          subject: `Ponuda ${q.quoteNumber} — Gama United`,
          html,
          pdfBase64: base64,
          filename: `${q.quoteNumber}.pdf`,
        },
      });
      if (error) throw error;
      await saveToDb(q.quoteNumber, new Date());
      toast.success(`Ponuda ${q.quoteNumber} poslata na ${resolved.clientEmail}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Slanje nije uspelo: " + (e?.message || ""));
    } finally { setBusy(""); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(previewBytes ? "max-w-6xl" : "max-w-3xl", "max-h-[92vh] overflow-y-auto")}>
        <DialogHeader>
          <DialogTitle>Nova ponuda — uvezi PDF na memorandum</DialogTitle>
        </DialogHeader>

        <div className={cn("gap-4", previewBytes ? "grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : "")}>
          <div className="space-y-3 min-w-0">
            <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
              Potpisnik: <strong className="text-foreground">{signer?.fullName || "…"}</strong>
              {signer?.jobTitle && <> · {signer.jobTitle}</>}
              <br />
              {signer?.email} {signer?.phone && <>· {signer.phone}</>}
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="existing">Postojeći klijent</TabsTrigger>
                <TabsTrigger value="prospect"><UserPlus className="h-3.5 w-3.5 mr-1.5" /> Potencijalni</TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label>Klijent *</Label>
                  <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        <span className="truncate text-left">{selectedClient ? selectedClient.name : "Izaberi klijenta…"}</span>
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
                                <Check className={cn("mr-2 h-4 w-4", selectedClient?.id === c.id ? "opacity-100" : "opacity-0")} />
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
                </div>
                <div className="space-y-1.5">
                  <Label>Email za slanje {selectedClient?.email && <span className="text-xs text-muted-foreground">(podrazumevano: {selectedClient.email})</span>}</Label>
                  <Input type="email" value={emailOverride} onChange={(e) => setEmailOverride(e.target.value)} placeholder={selectedClient?.email || "kontakt@firma.rs"} />
                </div>
              </TabsContent>

              <TabsContent value="prospect" className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Firma</Label>
                    <Input value={prospectCompany} onChange={(e) => setProspectCompany(e.target.value)} placeholder="Firma d.o.o." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kontakt osoba</Label>
                    <Input value={prospectName} onChange={(e) => setProspectName(e.target.value)} placeholder="Petar Petrović" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Email (za slanje)</Label>
                  <Input type="email" value={emailOverride} onChange={(e) => setEmailOverride(e.target.value)} placeholder="kontakt@firma.rs" />
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Iznos (EUR, opciono)</Label>
                <Input value={totalStr} onChange={(e) => setTotalStr(e.target.value)} placeholder="npr. 1.250,00" inputMode="decimal" />
              </div>
              <div className="space-y-1.5">
                <Label>Napomena</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Rok, plaćanje…" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>PDF dokument *</Label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
              />
              {pdfFile ? (
                <div className="flex items-center gap-2 border rounded-md p-2 bg-muted/30">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{pdfFile.name}</div>
                    <div className="text-xs text-muted-foreground">{(pdfFile.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setPdfFile(null); setPdfBuf(null); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> Izaberi PDF fajl
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Svaka strana PDF-a će biti postavljena na naš memorandum. Prva strana je automatski kreirana sa brojem ponude, klijentom i potpisom.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={handlePreview} disabled={!canGenerate || busy !== ""}>
                {busy === "preview" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                Pregled
              </Button>
              <Button variant="outline" onClick={handleSave} disabled={!canGenerate || busy !== ""}>
                {busy === "save" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Sačuvaj
              </Button>
              <Button variant="outline" onClick={handleDownload} disabled={!canGenerate || busy !== ""}>
                {busy === "download" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Preuzmi
              </Button>
              <Button onClick={handleSend} disabled={!canGenerate || busy !== "" || !resolved.clientEmail}>
                {busy === "send" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Pošalji
              </Button>
            </div>
          </div>

          {previewBytes && (
            <div className="min-w-0">
              <PdfPreview bytes={previewBytes} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
