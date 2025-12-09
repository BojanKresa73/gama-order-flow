import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (invoiceNumber: string) => void;
  isLoading?: boolean;
}

export const InvoiceDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: InvoiceDialogProps) => {
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const handleConfirm = () => {
    onConfirm(invoiceNumber.trim());
    setInvoiceNumber("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Označi kao fakturisano</DialogTitle>
          <DialogDescription>
            Unesite broj fakture za ovaj nalog. Ovo polje je opcionalno.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="invoice_number">Broj fakture</Label>
            <Input
              id="invoice_number"
              placeholder="npr. FAK-2024-001"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Odustani
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Čuvanje..." : "Potvrdi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};