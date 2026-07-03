import { useState } from "react";
import { toast } from "sonner";
import {
  Send, CheckCircle, XCircle, Undo2, FileOutput, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { type Quote, useUpdateQuotePro } from "@/hooks/useQuotesPro";
import { ConvertToWorkOrderDialog } from "./ConvertToWorkOrderDialog";

interface Props {
  quote: Quote;
  onOpenSend: () => void;
  onOpenWorkOrder?: (workOrderId: string) => void;
}

export function QuoteStatusActions({ quote, onOpenSend, onOpenWorkOrder }: Props) {
  const update = useUpdateQuotePro();
  const [convertOpen, setConvertOpen] = useState(false);

  const requireItems = () => {
    if (!quote.items || quote.items.length === 0) {
      toast.error("Dodajte barem jednu stavku"); return false;
    }
    return true;
  };

  const handleSend = () => {
    if (!requireItems()) return;
    if (!quote.client?.email) { toast.error("Klijent nema email adresu"); return; }
    onOpenSend();
  };

  const setStatus = async (status: Quote["status"], msg: string) => {
    await update.mutateAsync({ id: quote.id, status });
    toast.success(msg);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Akcije</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(quote.status === "draft" || quote.status === "sent") && (
            <Button className="w-full gap-2" onClick={handleSend}>
              <Send className="h-4 w-4" />
              {quote.status === "sent" ? "Pošalji ponovo" : "Pošalji ponudu"}
            </Button>
          )}

          {quote.status === "sent" && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="default" className="w-full gap-2">
                    <CheckCircle className="h-4 w-4" /> Prihvaćena
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Označi kao prihvaćenu?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Nakon prihvatanja možete konvertovati ponudu u radni nalog.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Odustani</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setStatus("accepted", "Ponuda prihvaćena")}>
                      Potvrdi
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full gap-2">
                    <XCircle className="h-4 w-4" /> Odbijena
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Označi kao odbijenu?</AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Odustani</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setStatus("rejected", "Ponuda odbijena")}>
                      Potvrdi
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setStatus("draft", "Ponuda vraćena u draft")}
              >
                <Undo2 className="h-4 w-4" /> Vrati u draft
              </Button>
            </>
          )}

          {quote.status === "accepted" && !quote.work_order_id && (
            <Button className="w-full gap-2" onClick={() => setConvertOpen(true)}>
              <FileOutput className="h-4 w-4" /> Konvertuj u radni nalog
            </Button>
          )}

          {quote.work_order_id && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => onOpenWorkOrder?.(quote.work_order_id!)}
            >
              <ExternalLink className="h-4 w-4" /> Otvori radni nalog
            </Button>
          )}
        </CardContent>
      </Card>

      {convertOpen && (
        <ConvertToWorkOrderDialog
          open={convertOpen}
          onOpenChange={setConvertOpen}
          quote={quote}
        />
      )}
    </>
  );
}
