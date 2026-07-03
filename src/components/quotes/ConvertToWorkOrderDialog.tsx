import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { convertQuoteToWorkOrder } from "@/lib/convertQuoteToWorkOrder";
import type { Quote } from "@/hooks/useQuotesPro";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quote: Quote;
}

export function ConvertToWorkOrderDialog({ open, onOpenChange, quote }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const itemsCount = quote.items?.length || 0;
  const hasInstall = (quote.items || []).some((it: any) => Number(it.installation_cost || 0) > 0);
  const terrainCount = Number((quote as any).terrain_visits_count || 0);

  const handleConvert = async () => {
    setBusy(true);
    try {
      const workOrderId = await convertQuoteToWorkOrder(quote);
      await qc.invalidateQueries({ queryKey: ["quote-pro", quote.id] });
      await qc.invalidateQueries({ queryKey: ["quotes-pro"] });
      await qc.invalidateQueries({ queryKey: ["work-orders"] });
      toast.success("Radni nalog kreiran iz ponude");
      onOpenChange(false);
      navigate(`/work-orders/${workOrderId}`);
    } catch (e: any) {
      toast.error(e.message || "Greška pri konverziji");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Konvertuj ponudu u radni nalog?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Biće kreiran radni nalog tipa <strong>OSTALO</strong> sa specifikacijom
                svih stavki iz ponude. Status ponude će postati{" "}
                <strong>Prihvaćena</strong> i biće povezana sa nalogom.
              </p>
              <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                <div>• Stavki za prenos: <strong>{itemsCount}</strong></div>
                {hasInstall && <div>• Montaža — napomena o uključenoj montaži</div>}
                {terrainCount > 0 && <div>• Izlazak na teren ×{terrainCount}</div>}
              </div>
              <p className="text-xs text-muted-foreground">
                Cene se ne prenose u nalog — operater vidi samo tehnički opis (dimenzije,
                materijal, dorada).
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Odustani</AlertDialogCancel>
          <Button onClick={handleConvert} disabled={busy || itemsCount === 0}>
            {busy ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Konvertujem…</>
            ) : (
              "Konvertuj"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
