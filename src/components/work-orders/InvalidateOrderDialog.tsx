import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface InvalidateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  onSuccess: () => void;
}

export function InvalidateOrderDialog({ open, onOpenChange, order, onSuccess }: InvalidateOrderDialogProps) {
  const [reason, setReason] = useState("");
  const [isInvalidating, setIsInvalidating] = useState(false);
  const { toast } = useToast();

  const handleInvalidate = async () => {
    if (!order) return;

    setIsInvalidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('invalidate-work-order', {
        body: {
          work_order_id: order.id,
          reason: reason.trim() || undefined
        }
      });

      if (error) throw error;

      const result = data as { ok: boolean; error?: string };
      
      if (!result?.ok) {
        throw new Error(result?.error || "Greška pri proglašavanju naloga nevažećim");
      }

      toast({
        title: "Uspeh",
        description: "Radni nalog je proglašen nevažećim.",
      });

      onOpenChange(false);
      setReason("");
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsInvalidating(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Proglasi nalog nevažećim</AlertDialogTitle>
          <AlertDialogDescription>
            Da li ste sigurni da želite da proglasite nalog{" "}
            <strong>{order?.display_order_number || order?.order_number}</strong> nevažećim?
            Ova akcija se ne može poništiti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-2">
          <Label htmlFor="invalidate-reason">Razlog (opciono)</Label>
          <Textarea
            id="invalidate-reason"
            placeholder="Unesite razlog proglašavanja nevažećim..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isInvalidating}>Otkaži</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleInvalidate}
            disabled={isInvalidating}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isInvalidating ? "Proglašavam..." : "Proglasi nevažećim"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
