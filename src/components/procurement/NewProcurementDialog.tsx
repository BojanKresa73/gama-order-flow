import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface NewProcurementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plateFormats: any[];
  onSuccess: () => void;
}

interface OrderItem {
  plate_format_id: string;
  quantity: number;
  price_per_m2: number;
}

export function NewProcurementDialog({
  open,
  onOpenChange,
  plateFormats,
  onSuccess,
}: NewProcurementDialogProps) {
  const { toast } = useToast();
  const [supplierName, setSupplierName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedArrival, setExpectedArrival] = useState("");
  const [transportCost, setTransportCost] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([
    { plate_format_id: "", quantity: 0, price_per_m2: 0 },
  ]);

  const resetForm = () => {
    setSupplierName("");
    setOrderDate(new Date().toISOString().split("T")[0]);
    setExpectedArrival("");
    setTransportCost(0);
    setNotes("");
    setItems([{ plate_format_id: "", quantity: 0, price_per_m2: 0 }]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niste prijavljeni");

      // Validate
      if (!supplierName.trim()) throw new Error("Unesite naziv dobavljača");
      const validItems = items.filter((i) => i.plate_format_id && i.quantity > 0);
      if (validItems.length === 0) throw new Error("Dodajte bar jednu stavku");

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("procurement_orders")
        .insert({
          supplier_name: supplierName.trim(),
          order_date: orderDate,
          expected_arrival_date: expectedArrival || null,
          transport_cost: transportCost,
          notes: notes.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Get format dimensions and insert items
      const itemsToInsert = validItems.map((item) => {
        const format = plateFormats.find((f) => f.id === item.plate_format_id);
        // Parse dimensions from format name (e.g., "70x100" -> 700x1000mm)
        const dims = parseDimensions(format?.format_name || "");
        return {
          procurement_order_id: order.id,
          plate_format_id: item.plate_format_id,
          quantity: item.quantity,
          price_per_m2: item.price_per_m2,
          width_mm: dims.width,
          height_mm: dims.height,
        };
      });

      const { error: itemsError } = await supabase
        .from("procurement_order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      toast({ title: "Narudžbina kreirana" });
      resetForm();
      onOpenChange(false);
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    },
  });

  const parseDimensions = (formatName: string): { width: number; height: number } => {
    // Try to parse "WxH" format (e.g., "70x100" or "650x500")
    const match = formatName.match(/(\d+)[x×](\d+)/i);
    if (match) {
      let w = parseInt(match[1]);
      let h = parseInt(match[2]);
      // If dimensions are small, assume cm and convert to mm
      if (w < 200 && h < 200) {
        w *= 10;
        h *= 10;
      }
      return { width: w, height: h };
    }
    // Default fallback
    return { width: 1000, height: 700 };
  };

  const addItem = () => {
    setItems([...items, { plate_format_id: "", quantity: 0, price_per_m2: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateItemTotal = (item: OrderItem): number => {
    const format = plateFormats.find((f) => f.id === item.plate_format_id);
    if (!format) return 0;
    const dims = parseDimensions(format.format_name);
    const areaM2 = (dims.width * dims.height * item.quantity) / 1_000_000;
    return areaM2 * item.price_per_m2;
  };

  const grandTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0) + transportCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova narudžbina ploča</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label>Dobavljač *</Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Naziv dobavljača"
              />
            </div>
            <div>
              <Label>Datum narudžbine</Label>
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Očekivani dolazak</Label>
              <Input
                type="date"
                value={expectedArrival}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setExpectedArrival(e.target.value)}
              />
            </div>
            <div>
              <Label>Transport (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={transportCost}
                onChange={(e) => setTransportCost(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <Label>Stavke</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Dodaj format
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Label className="text-xs">Format</Label>
                    <Select
                      value={item.plate_format_id}
                      onValueChange={(v) => updateItem(index, "plate_format_id", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Izaberi format" />
                      </SelectTrigger>
                      <SelectContent>
                        {plateFormats.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.format_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Količina</Label>
                    <Input
                      type="number"
                      value={item.quantity || ""}
                      onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">€/m²</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.price_per_m2 || ""}
                      onChange={(e) => updateItem(index, "price_per_m2", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-2 text-right text-sm font-medium pb-2">
                    {calculateItemTotal(item).toFixed(2)} €
                  </div>
                  <div className="col-span-1 pb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t text-lg font-bold">
              <span>Ukupno (sa transportom):</span>
              <span>{grandTotal.toFixed(2)} €</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Napomena</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dodatne informacije..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Čuvam..." : "Sačuvaj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
