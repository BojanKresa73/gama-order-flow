import { useEffect, useState } from "react";
import { Eye, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { pdfToBase64 } from "@/lib/quotePdf";
import { generateQuoteProPdf } from "@/lib/quoteProPdf";
import { useSignerProfile } from "@/hooks/useSignerProfile";
import { useQuotePro, useUpdateQuotePro } from "@/hooks/useQuotesPro";

interface Props {
  quoteId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function SendQuoteProDialog({ quoteId, open, onOpenChange }: Props) {
  const { data: quote } = useQuotePro(quoteId);
  const { data: signer } = useSignerProfile();
  const update = useUpdateQuotePro();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => {
    if (!quote || !signer) return;
    if (quote.client?.email) setTo((prev) => prev || quote.client!.email!);
    setSubject((prev) => prev || `Ponuda ${quote.quote_number}${quote.job_name ? " — " + quote.job_name : ""}`);
    setBody(
      (prev) => prev ||
      `Poštovani,\n\nU prilogu Vam dostavljamo ponudu ${quote.quote_number}.\nZa sva pitanja stojimo Vam na raspolaganju.\n\nSrdačan pozdrav,\n${signer.fullName}${signer.jobTitle ? "\n" + signer.jobTitle : ""}\nGama United`
    );
  }, [quote, signer]);

  // Cleanup preview URL when dialog closes
  useEffect(() => {
    if (!open && previewUrl) {
      setPreviewUrl(null);
    }
  }, [open, previewUrl]);

  async function handlePreview() {
    if (!quote || !signer) return;
    setPreviewBusy(true);
    try {
      const pdf = await generateQuoteProPdf(quote, quote.items ?? [], signer);
      // Use data: URL (base64) instead of blob: — blob URLs are often blocked
      // by ad blockers (ERR_BLOCKED_BY_CLIENT) inside embedded previews.
      const base64 = pdfToBase64(pdf);
      setPreviewUrl(`data:application/pdf;base64,${base64}`);
    } catch (e: any) {
      toast.error(e.message ?? "Greška pri generisanju PDF-a");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleSend() {
    if (!quote || !signer) return;
    if (!to.trim()) { toast.error("Unesite e-mail primaoca"); return; }
    setSending(true);
    try {
      const pdf = await generateQuoteProPdf(quote, quote.items ?? [], signer);
      const pdfBase64 = pdfToBase64(pdf);
      const filename = `Ponuda-${quote.quote_number}.pdf`;

      const { error } = await supabase.functions.invoke("send-quote-pro-email", {
        body: {
          to, subject,
          text: body,
          pdfBase64, filename,
          senderName: signer.fullName,
          senderEmail: signer.email,
        },
      });
      if (error) throw error;

      // Persist snapshot + recipient + sent_at; mark sent (trigger sets expires_at)
      const snapshot = {
        sent_at: new Date().toISOString(),
        to,
        subject,
        body,
        quote: {
          quote_number: quote.quote_number,
          job_name: quote.job_name,
          final_price: quote.final_price,
          total_price: quote.total_price,
          discount_percent: quote.discount_percent,
          valid_days: quote.valid_days,
        },
        items: (quote.items ?? []).map((it) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          custom_price: it.custom_price,
          line_total: it.line_total,
          item_type: it.item_type,
        })),
      };
      await update.mutateAsync({
        id: quote.id,
        status: quote.status === "draft" ? "sent" : quote.status,
        sent_at: new Date().toISOString(),
        sent_to_email: to,
        sent_snapshot: snapshot as any,
      } as any);
      toast.success("Ponuda poslata");
      onOpenChange(false);

    } catch (e: any) {
      toast.error(e.message ?? "Greška pri slanju");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" /> Pošalji ponudu na e-mail
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <Label>Za</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="klijent@primer.rs" />
            </div>
            <div>
              <Label>Naslov</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Poruka</Label>
              <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="text-xs text-muted-foreground">
              PDF ponude će biti automatski priložen. Kopija ide na Vaš e-mail i u arhivu.
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>PDF pregled</Label>
              <div className="flex gap-2">
                {previewUrl && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer">Otvori u novom tabu</a>
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handlePreview} disabled={previewBusy}>
                  {previewBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                  {previewUrl ? "Osveži" : "Prikaži PDF"}
                </Button>
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 h-[60vh] overflow-hidden">
              {previewUrl ? (
                <object data={previewUrl} type="application/pdf" className="w-full h-full">
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground text-center px-4">
                    Pregled nije moguć u ovom prozoru.{" "}
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="underline ml-1">
                      Otvori PDF u novom tabu
                    </a>
                  </div>
                </object>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground text-center px-4">
                  Klikni "Prikaži PDF" za pregled atačmenta pre slanja.
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Send className="w-4 h-4 mr-2" /> Pošalji
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
