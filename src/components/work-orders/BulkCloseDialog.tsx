import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

interface BulkCloseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  closingNote: string;
  onClosingNoteChange: (note: string) => void;
  onConfirm: () => void;
  progress: number;
  total: number;
  results: { closed: number; alreadyClosed: number; errors: number } | null;
  onDismissResults: () => void;
}

export const BulkCloseDialog = ({
  open,
  onOpenChange,
  selectedCount,
  closingNote,
  onClosingNoteChange,
  onConfirm,
  progress,
  total,
  results,
  onDismissResults,
}: BulkCloseDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          Zatvori {selectedCount} {selectedCount === 1 ? 'nalog' : 'naloga'}?
        </AlertDialogTitle>
        <AlertDialogDescription>
          Po zatvaranju biće generisane i automatski poslate otpremnice klijentima.
        </AlertDialogDescription>
      </AlertDialogHeader>

      {total > 0 && !results && (
        <div className="space-y-2 py-4">
          <div className="flex justify-between text-sm">
            <span>Zatvaranje naloga...</span>
            <span>{progress} / {total}</span>
          </div>
          <Progress value={(progress / total) * 100} />
        </div>
      )}

      {results && (
        <div className="space-y-2 py-4">
          <div className="rounded-md bg-muted p-4 space-y-1">
            <p className="text-sm">✅ Zatvoreno: <strong>{results.closed}</strong></p>
            {results.alreadyClosed > 0 && (
              <p className="text-sm text-muted-foreground">ℹ️ Već zatvoreno: {results.alreadyClosed}</p>
            )}
            {results.errors > 0 && (
              <p className="text-sm text-destructive">❌ Greške: {results.errors}</p>
            )}
          </div>
        </div>
      )}

      {!results && (
        <div className="space-y-2 py-4">
          <Label htmlFor="bulk-closing-note">Napomena za zatvaranje (opciono)</Label>
          <Textarea
            id="bulk-closing-note"
            placeholder="Dodajte napomenu..."
            value={closingNote}
            onChange={(e) => onClosingNoteChange(e.target.value)}
            rows={3}
            disabled={total > 0}
          />
        </div>
      )}

      <AlertDialogFooter>
        {results ? (
          <AlertDialogCancel onClick={onDismissResults}>Zatvori</AlertDialogCancel>
        ) : (
          <>
            <AlertDialogCancel disabled={total > 0}>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm} disabled={total > 0}>
              {total > 0 ? "Zatvaranje..." : "Zatvori naloge"}
            </AlertDialogAction>
          </>
        )}
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
