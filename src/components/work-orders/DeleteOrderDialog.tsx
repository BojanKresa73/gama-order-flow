import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DeleteOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  onSuccess: () => void;
}

export function DeleteOrderDialog({ open, onOpenChange, order, onSuccess }: DeleteOrderDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!order) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-work-order', {
        body: {
          work_order_id: order.id
        }
      });

      if (error) throw error;

      const result = data as { ok: boolean; error?: string };
      
      if (!result?.ok) {
        throw new Error(result?.error || "Greška pri brisanju naloga");
      }

      toast({
        title: "Uspeh",
        description: "Radni nalog je obrisan.",
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Obriši radni nalog</AlertDialogTitle>
          <AlertDialogDescription>
            Da li ste sigurni da želite da obrišete nalog{" "}
            <strong>{order?.display_order_number || order?.order_number}</strong>?
            Ova akcija se ne može poništiti.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Otkaži</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? "Brišem..." : "Obriši"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
