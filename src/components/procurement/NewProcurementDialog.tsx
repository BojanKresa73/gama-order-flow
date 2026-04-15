import { useState, useEffect } from "react";
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
  editOrder?: any | null;
}

interface OrderItem {
  id?: string;
  plate_format_id: string;
  quantity: number;
  price_per_m2: number;
}

export function NewProcurementDialog({
  open,
  onOpenChange,
  plateFormats,
  onSuccess,
  editOrder,
}: NewProcurementDialogProps) {
  const { toast } = useToast();
  const [supplierName, setSupplierName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedArrival, setExpectedArrival] = useState("");
  const [actualArrival, setActualArrival] = useState("");
  const [transportCost, setTransportCost] = useState<number>(0);
  const [otherCosts, setOtherCosts] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([
    { plate_format_id: "", quantity: 0, price_per_m2: 0 },
  ]);

  const isEditing = !!editOrder;

  useEffect(() => {
    if (editOrder && open) {
      setSupplierName(editOrder.supplier_name || "");
      setOrderDate(editOrder.order_date || new Date().toISOString().split("T")[0]);
      setExpectedArrival(editOrder.expected_arrival_date || "");
      setActualArrival(editOrder.actual_arrival_date || "");
      setTransportCost(editOrder.transport_cost || 0);
      setOtherCosts(editOrder.other_costs || 0);
      setNotes(editOrder.notes || "");
      const existingItems = (editOrder.procurement_order_items || []).map((item: any) => ({
        id: item.id,
        plate_format_id: item.plate_format_id || "",
        quantity: item.quantity || 0,
        price_per_m2: item.price_per_m2 || 0,
      }));
      setItems(existingItems.length > 0 ? existingItems : [{ plate_format_id: "", quantity: 0, price_per_m2: 0 }]);
    } else if (!editOrder && open) {
      resetForm();
    }
  }, [editOrder, open]);

  const resetForm = () => {
    setSupplierName("");
    setOrderDate(new Date().toISOString().split("T")[0]);
    setExpectedArrival("");
    setActualArrival("");
    setTransportCost(0);
    setOtherCosts(0);
    setNotes("");
    setItems([{ plate_format_id: "", quantity: 0, price_per_m2: 0 }]);
  };

  const parseDimensions = (formatName: string): { width: number; height: number } => {
    const match = formatName.match(/(\d+)[x×](\d+)/i);
    if (match) {
      let w = parseInt(match[1]);
      let h = parseInt(match[2]);
      if (w < 200 && h < 200) {
        w *= 10;
        h *= 10;
      }
      return { width: w, height: h };
    }
    return { width: 1000, height: 700 };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niste prijavljeni");

      if (!supplierName.trim()) throw new Error("Unesite naziv dobavljača");
      const validItems = items.filter((i) => i.plate_format_id && i.quantity > 0);
      if (validItems.length === 0) throw new Error("Dodajte bar jednu stavku");

      if (isEditing) {
        // Update order
        const { error: orderError } = await supabase
          .from("procurement_orders")
          .update({
            supplier_name: supplierName.trim(),
            order_date: orderDate,
            expected_arrival_date: expectedArrival || null,
            transport_cost: transportCost,
            other_costs: otherCosts,
            notes: notes.trim() || null,
          })
          .eq("id", editOrder.id);

        if (orderError) throw orderError;

        // Delete old items and re-insert
        const { error: deleteError } = await supabase
          .from("procurement_order_items")
          .delete()
          .eq("procurement_order_id", editOrder.id);

        if (deleteError) throw deleteError;

        const itemsToInsert = validItems.map((item) => {
          const format = plateFormats.find((f) => f.id === item.plate_format_id);
          const dims = parseDimensions(format?.format_name || "");
          return {
            procurement_order_id: editOrder.id,
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
      } else {
        // Create order
        const { data: order, error: orderError } = await supabase
          .from("procurement_orders")
          .insert({
            supplier_name: supplierName.trim(),
            order_date: orderDate,
            expected_arrival_date: expectedArrival || null,
            transport_cost: transportCost,
            other_costs: otherCosts,
            notes: notes.trim() || null,
            created_by: user.id,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        const itemsToInsert = validItems.map((item) => {
          const format = plateFormats.find((f) => f.id === item.plate_format_id);
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
      }
    },
    onSuccess: () => {
      toast({ title: isEditing ? "Narudžbina ažurirana" : "Narudžbina kreirana" });
      resetForm();
      onOpenChange(false);
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    },
  });

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

  const grandTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0) + transportCost + otherCosts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Izmeni narudžbinu" : "Nova narudžbina ploča"}</DialogTitle>
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
            <div>
              <Label>Ostali troškovi (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={otherCosts}
                onChange={(e) => setOtherCosts(parseFloat(e.target.value) || 0)}
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
                    <Label className="text-xs">$/m²</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.price_per_m2 || ""}
                      onChange={(e) => updateItem(index, "price_per_m2", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-2 text-right text-sm font-medium pb-2">
                    {calculateItemTotal(item).toFixed(2)} $
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
              <span>Ukupno (sa troškovima):</span>
              <span>{grandTotal.toFixed(2)} $</span>
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
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Čuvam..." : isEditing ? "Sačuvaj izmene" : "Sačuvaj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
