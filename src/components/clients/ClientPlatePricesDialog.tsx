import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface PlateFormat {
  id: string;
  format_name: string;
}

interface ClientPlatePrice {
  id?: string;
  plate_format_id: string;
  price_rsd: number;
}

interface ClientPlatePricesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

export function ClientPlatePricesDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
}: ClientPlatePricesDialogProps) {
  const [plateFormats, setPlateFormats] = useState<PlateFormat[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && clientId) {
      fetchData();
    }
  }, [open, clientId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all plate formats
      const { data: formats, error: formatsError } = await supabase
        .from("plate_formats")
        .select("id, format_name")
        .order("format_name");

      if (formatsError) throw formatsError;
      setPlateFormats(formats || []);

      // Fetch existing prices for this client
      const { data: existingPrices, error: pricesError } = await supabase
        .from("client_plate_prices")
        .select("plate_format_id, price_rsd")
        .eq("client_id", clientId);

      if (pricesError) throw pricesError;

      // Map existing prices to the state
      const priceMap: Record<string, number> = {};
      (existingPrices || []).forEach((p) => {
        priceMap[p.plate_format_id] = Number(p.price_rsd);
      });
      setPrices(priceMap);
    } catch (error: any) {
      toast.error("Greška pri učitavanju: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (formatId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setPrices((prev) => ({
      ...prev,
      [formatId]: numValue,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing prices for this client
      const { error: deleteError } = await supabase
        .from("client_plate_prices")
        .delete()
        .eq("client_id", clientId);

      if (deleteError) throw deleteError;

      // Insert new prices (only non-zero values)
      const insertData = Object.entries(prices)
        .filter(([_, price]) => price > 0)
        .map(([plate_format_id, price_rsd]) => ({
          client_id: clientId,
          plate_format_id,
          price_rsd,
        }));

      if (insertData.length > 0) {
        const { error: insertError } = await supabase
          .from("client_plate_prices")
          .insert(insertData);

        if (insertError) throw insertError;
      }

      toast.success("Cenovnik sačuvan");
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Greška pri čuvanju: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cenovnik ploča</DialogTitle>
          <DialogDescription>
            Cene ploča za klijenta: <strong>{clientName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : plateFormats.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nema definisanih formata ploča
            </p>
          ) : (
            plateFormats.map((format) => (
              <div key={format.id} className="flex items-center gap-4">
                <Label className="w-32 shrink-0">{format.format_name}</Label>
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prices[format.id] || ""}
                    onChange={(e) => handlePriceChange(format.id, e.target.value)}
                    placeholder="0.00"
                    className="text-right"
                  />
                  <span className="text-muted-foreground text-sm">RSD</span>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? "Čuvanje..." : "Sačuvaj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
