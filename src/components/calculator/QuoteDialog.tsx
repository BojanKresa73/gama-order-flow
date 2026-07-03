import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, Send, Save, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSignerProfile } from "@/hooks/useSignerProfile";
import { generateQuotePdf, downloadPdf, pdfToBase64, type QuoteItemPdf } from "@/lib/quotePdf";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: QuoteItemPdf[];
  total: number;
}

export function QuoteDialog({ open, onOpenChange, items, total }: Props) {
  const { data: signer } = useSignerProfile();
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"" | "download" | "send" | "save">("");

  const canGenerate = clientName.trim().length > 0 && items.length > 0 && !!signer;

  const buildQuote = async () => {
    const { data: numData } = await (supabase as any).rpc("next_quote_number");
    const quoteNumber = (numData as string) || `PON-${new Date().getFullYear()}-DRAFT`;
    return {
      quoteNumber,
      date: new Date(),
      clientName: clientName.trim(),
      clientCompany: clientCompany.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
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
      client_name: clientName.trim(),
      client_email: clientEmail.trim() || null,
      client_company: clientCompany.trim() || null,
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
    if (!canGenerate) { toast.error("Unesi ime klijenta"); return; }
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
    if (!canGenerate) { toast.error("Unesi ime klijenta"); return; }
    if (!clientEmail.trim()) { toast.error("Unesi email klijenta"); return; }
    setBusy("send");
    try {
      const quote = await buildQuote();
      const bytes = await generateQuotePdf(quote);
      const base64 = pdfToBase64(bytes);
      const html = `
        <div style="font-family:Arial,sans-serif;color:#0b1937">
          <p>Poštovani,</p>
          <p>U prilogu Vam šaljemo ponudu <strong>${quote.quoteNumber}</strong>.</p>
          <p>Za sva pitanja stojimo Vam na raspolaganju.</p>
          <p>Srdačan pozdrav,<br><strong>${signer?.fullName}</strong>${signer?.jobTitle ? "<br>" + signer.jobTitle : ""}<br>Gama United d.o.o.</p>
        </div>`;
      const { error } = await supabase.functions.invoke("send-quote-email", {
        body: {
          to: clientEmail.trim(),
          subject: `Ponuda ${quote.quoteNumber} — Gama United`,
          html,
          pdfBase64: base64,
          filename: `${quote.quoteNumber}.pdf`,
        },
      });
      if (error) throw error;
      await saveToDb(quote.quoteNumber, new Date());
      toast.success(`Ponuda ${quote.quoteNumber} poslata na ${clientEmail}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Slanje nije uspelo: " + (e?.message || "nepoznata"));
    } finally { setBusy(""); }
  };

  const handleSave = async () => {
    if (!canGenerate) { toast.error("Unesi ime klijenta"); return; }
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

          <div className="space-y-1.5">
            <Label>Ime klijenta / kontakt osoba *</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Petar Petrović" />
          </div>
          <div className="space-y-1.5">
            <Label>Firma (opciono)</Label>
            <Input value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} placeholder="Klijent d.o.o." />
          </div>
          <div className="space-y-1.5">
            <Label>Email klijenta (za slanje)</Label>
            <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="kontakt@firma.rs" />
          </div>
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
          <Button size="sm" onClick={handleSend} disabled={!!busy || !canGenerate || !clientEmail.trim()}>
            {busy === "send" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Pošalji email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
