import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";
import { PriceListEntry } from "./PriceListDigitalTable";

interface PriceListFormProps {
  entry?: PriceListEntry;
  onSuccess: () => void;
  onCancel: () => void;
  existingBreakQtys: number[];
}

export const PriceListForm = ({
  entry,
  onSuccess,
  onCancel,
  existingBreakQtys,
}: PriceListFormProps) => {
  const { toast } = useToast();
  const [breakQty, setBreakQty] = useState(entry?.break_qty?.toString() || "");
  const [pricePerSheet, setPricePerSheet] = useState(
    entry?.price_per_sheet?.toString() || ""
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const qty = parseInt(breakQty);
      const price = parseFloat(pricePerSheet);

      if (isNaN(qty) || qty <= 0) {
        throw new Error("Količina mora biti veća od 0");
      }

      if (isNaN(price) || price <= 0) {
        throw new Error("Cena mora biti veća od 0");
      }

      if (existingBreakQtys.includes(qty)) {
        throw new Error("Količina već postoji u cenovniku");
      }

      if (entry) {
        const { error } = await supabase
          .from("price_list_digital" as any)
          .update({ break_qty: qty, price_per_sheet: price })
          .eq("id", entry.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("price_list_digital" as any)
          .insert({ break_qty: qty, price_per_sheet: price });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: entry ? "Stavka ažurirana" : "Stavka dodana" });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex gap-2 p-4 bg-muted/50">
      <Input
        type="number"
        placeholder="Količina"
        value={breakQty}
        onChange={(e) => setBreakQty(e.target.value)}
        className="w-40"
        min="1"
        autoFocus
      />
      <Input
        type="number"
        placeholder="Cena po tabaku"
        value={pricePerSheet}
        onChange={(e) => setPricePerSheet(e.target.value)}
        className="w-40"
        min="0.01"
        step="0.01"
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        <Check className="h-4 w-4 text-green-600" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onCancel}>
        <X className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
};
