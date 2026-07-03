import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
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

  useEffect(() => {
    if (!quote || !signer) return;
    if (quote.client?.email) setTo((prev) => prev || quote.client!.email!);
    setSubject((prev) => prev || `Ponuda ${quote.quote_number}${quote.job_name ? " — " + quote.job_name : ""}`);
    setBody(
      (prev) => prev ||
      `Poštovani,\n\nU prilogu Vam dostavljamo ponudu ${quote.quote_number}.\nZa sva pitanja stojimo Vam na raspolaganju.\n\nSrdačan pozdrav,\n${signer.fullName}${signer.jobTitle ? "\n" + signer.jobTitle : ""}\nGama United`
    );
  }, [quote, signer]);

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

      // Mark quote as sent (trigger sets expires_at automatically)
      if (quote.status === "draft") {
        await update.mutateAsync({ id: quote.id, status: "sent" });
      }
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" /> Pošalji ponudu na e-mail
          </DialogTitle>
        </DialogHeader>
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
            <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="text-xs text-muted-foreground">
            PDF ponude će biti automatski priložen. Kopija ide na Vaš e-mail i u arhivu.
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
