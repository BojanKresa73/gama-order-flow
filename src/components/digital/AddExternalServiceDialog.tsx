import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface ExternalServicePayload {
  external_note: string;
  external_price: number;
}

interface AddExternalServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ExternalServicePayload) => void;
  initial?: ExternalServicePayload | null;
}

export const AddExternalServiceDialog = ({
  open,
  onOpenChange,
  onSubmit,
  initial,
}: AddExternalServiceDialogProps) => {
  const [note, setNote] = useState("");
  const [price, setPrice] = useState<string>("");

  useEffect(() => {
    if (open) {
      setNote(initial?.external_note || "");
      setPrice(initial?.external_price ? String(initial.external_price) : "");
    }
  }, [open, initial]);

  const handleSubmit = () => {
    const parsed = parseFloat(price.replace(",", "."));
    if (!note.trim() || isNaN(parsed) || parsed < 0) return;
    onSubmit({ external_note: note.trim(), external_price: parsed });
    onOpenChange(false);
  };

  const isEdit = !!initial;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Izmeni eksternu uslugu" : "Dodaj eksternu uslugu"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ext-note">Napomena (opis usluge)</Label>
            <Textarea
              id="ext-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="npr. Bigovanje kod kooperanta, dostava, ..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ext-price">Cena (€)</Label>
            <Input
              id="ext-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button type="button" onClick={handleSubmit}>
            {isEdit ? "Sačuvaj" : "Dodaj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
