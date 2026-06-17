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
import { Switch } from "@/components/ui/switch";
import { AlertTriangle } from "lucide-react";

interface PlateFormat {
  id: string;
  format_name: string;
}

interface ClientPlatePricesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  hasMonoPricing: boolean;
  onMonoPricingChange: (enabled: boolean) => void;
}

export function ClientPlatePricesDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  hasMonoPricing,
  onMonoPricingChange,
}: ClientPlatePricesDialogProps) {
  const [plateFormats, setPlateFormats] = useState<PlateFormat[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [monoPrices, setMonoPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localMonoPricing, setLocalMonoPricing] = useState(hasMonoPricing);

  // Sync local state with prop
  useEffect(() => {
    setLocalMonoPricing(hasMonoPricing);
  }, [hasMonoPricing]);

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

      // Fetch existing prices for this client (sve verzije, biramo najnoviju po formatu)
      const { data: existingPrices, error: pricesError } = await supabase
        .from("client_plate_prices")
        .select("plate_format_id, price_eur, price_eur_mono, valid_from")
        .eq("client_id", clientId)
        .order("valid_from", { ascending: false });

      if (pricesError) throw pricesError;

      // Map existing prices to the states (najnoviji red po formatu)
      const priceMap: Record<string, number> = {};
      const monoMap: Record<string, number> = {};
      const seen = new Set<string>();
      (existingPrices || []).forEach((p) => {
        if (seen.has(p.plate_format_id)) return;
        seen.add(p.plate_format_id);
        priceMap[p.plate_format_id] = Number(p.price_eur);
        if (p.price_eur_mono !== null) {
          monoMap[p.plate_format_id] = Number(p.price_eur_mono);
        }
      });
      setPrices(priceMap);
      setMonoPrices(monoMap);
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

  const handleMonoPriceChange = (formatId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setMonoPrices((prev) => ({
      ...prev,
      [formatId]: numValue,
    }));
  };

  // Check if mono pricing is enabled but some formats with prices don't have mono prices
  const getMissingMonoPrices = () => {
    if (!localMonoPricing) return [];
    return plateFormats.filter(
      (format) => prices[format.id] > 0 && (!monoPrices[format.id] || monoPrices[format.id] <= 0)
    );
  };

  const handleSave = async () => {
    // Validate mono prices if enabled
    const missing = getMissingMonoPrices();
    if (missing.length > 0) {
      toast.error(`Nedostaju CB cene za: ${missing.map(f => f.format_name).join(", ")}`);
      return;
    }

    setSaving(true);
    try {
      // Update client's mono pricing flag
      if (localMonoPricing !== hasMonoPricing) {
        const { error: clientError } = await supabase
          .from("clients")
          .update({ has_mono_pricing: localMonoPricing })
          .eq("id", clientId);
        
        if (clientError) throw clientError;
        onMonoPricingChange(localMonoPricing);
      }

      // Delete existing prices for this client
      const { error: deleteError } = await supabase
        .from("client_plate_prices")
        .delete()
        .eq("client_id", clientId);

      if (deleteError) throw deleteError;

      // Insert new prices (only non-zero values for color, include mono if enabled)
      const insertData = Object.entries(prices)
        .filter(([_, price]) => price > 0)
        .map(([plate_format_id, price_eur]) => {
          const row: any = {
          client_id: clientId,
          plate_format_id,
          price_eur,
          };
          if (localMonoPricing && monoPrices[plate_format_id]) {
            row.price_eur_mono = monoPrices[plate_format_id];
          }
          return row;
        });

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

  const missingMonoPrices = getMissingMonoPrices();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cenovnik ploča (EUR)</DialogTitle>
          <DialogDescription>
            Cene ploča za klijenta: <strong>{clientName}</strong> (u EUR, konvertuje se u RSD po kursu NBS pri eksportu)
          </DialogDescription>
        </DialogHeader>

        {/* Mono pricing toggle */}
        <div className="flex items-center justify-between py-3 px-3 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Crno-bele ploče (CB)</Label>
            <p className="text-xs text-muted-foreground">
              Posebne cene za fajlove sa 1 pločom
            </p>
          </div>
          <Switch
            checked={localMonoPricing}
            onCheckedChange={setLocalMonoPricing}
          />
        </div>

        {/* Warning for missing mono prices */}
        {localMonoPricing && missingMonoPrices.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-xs">
              Nedostaju CB cene za: {missingMonoPrices.map(f => f.format_name).join(", ")}
            </p>
          </div>
        )}

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
              <div key={format.id} className="space-y-2">
                <Label className="text-sm font-medium">{format.format_name}</Label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-muted-foreground w-12">Kolor:</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prices[format.id] || ""}
                    onChange={(e) => handlePriceChange(format.id, e.target.value)}
                    placeholder="0.00"
                    className="text-right"
                  />
                  <span className="text-muted-foreground text-sm">EUR</span>
                  </div>
                  {localMonoPricing && (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs text-muted-foreground w-6">CB:</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={monoPrices[format.id] || ""}
                        onChange={(e) => handleMonoPriceChange(format.id, e.target.value)}
                        placeholder="0.00"
                        className="text-right"
                      />
                      <span className="text-muted-foreground text-sm">EUR</span>
                    </div>
                  )}
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
