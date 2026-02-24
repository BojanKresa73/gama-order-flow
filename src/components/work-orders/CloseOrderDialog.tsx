import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface CloseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber?: string;
  closingNote: string;
  onClosingNoteChange: (note: string) => void;
  onConfirm: () => void;
  isClosing: boolean;
}

export const CloseOrderDialog = ({
  open,
  onOpenChange,
  orderNumber,
  closingNote,
  onClosingNoteChange,
  onConfirm,
  isClosing,
}: CloseOrderDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Zatvori radni nalog {orderNumber}?</AlertDialogTitle>
        <AlertDialogDescription>
          Po zatvaranju biće generisana i automatski poslata otpremnica klijentu.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="space-y-2 py-4">
        <Label htmlFor="closing-note">Napomena za zatvaranje (opciono)</Label>
        <Textarea
          id="closing-note"
          placeholder="Dodajte napomenu..."
          value={closingNote}
          onChange={(e) => onClosingNoteChange(e.target.value)}
          rows={3}
        />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isClosing}>Otkaži</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} disabled={isClosing}>
          {isClosing ? "Zatvaranje..." : "Zatvori nalog"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
