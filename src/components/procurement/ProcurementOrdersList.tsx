import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Edit2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ProcurementOrdersListProps {
  orders: any[];
  onUpdate: () => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ordered: { label: "Naručeno", variant: "secondary" },
  in_transit: { label: "Na brodu", variant: "default" },
  customs: { label: "Carina", variant: "outline" },
  arrived: { label: "Stiglo", variant: "default" },
  cancelled: { label: "Otkazano", variant: "destructive" },
};

export function ProcurementOrdersList({ orders, onUpdate }: ProcurementOrdersListProps) {
  const { toast } = useToast();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  // Fixed USD to EUR rate (Google: 1 USD ≈ 0.84 EUR)
  const usdToEur = 0.84;

  const toggleExpand = (orderId: string) => {
    const newSet = new Set(expandedOrders);
    if (newSet.has(orderId)) {
      newSet.delete(orderId);
    } else {
      newSet.add(orderId);
    }
    setExpandedOrders(newSet);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) => {
      const { error } = await supabase
        .from("procurement_orders")
        .update(values)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Uspešno ažurirano" });
      setEditingOrder(null);
      onUpdate();
    },
    onError: (error: any) => {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    },
  });

  const startEdit = (order: any) => {
    setEditingOrder(order.id);
    setEditValues({
      status: order.status,
      expected_arrival_date: order.expected_arrival_date || "",
      actual_arrival_date: order.actual_arrival_date || "",
      transport_cost: order.transport_cost || 0,
      other_costs: order.other_costs || 0,
    });
  };

  const saveEdit = () => {
    if (!editingOrder) return;
    
    // Convert empty date strings to null for proper database handling
    const valuesToSave = {
      status: editValues.status,
      expected_arrival_date: editValues.expected_arrival_date && editValues.expected_arrival_date.trim() !== "" ? editValues.expected_arrival_date.trim() : null,
      actual_arrival_date: editValues.actual_arrival_date && editValues.actual_arrival_date.trim() !== "" ? editValues.actual_arrival_date.trim() : null,
      transport_cost: editValues.transport_cost || 0,
      other_costs: editValues.other_costs || 0,
    };
    
    updateMutation.mutate({ id: editingOrder, values: valuesToSave });
  };

  const calculateOrderTotal = (order: any) => {
    const items = order.procurement_order_items || [];
    let itemsTotal = 0;
    items.forEach((item: any) => {
      const areaM2 = (item.width_mm * item.height_mm * item.quantity) / 1_000_000;
      itemsTotal += areaM2 * (item.price_per_m2 || 0);
    });
    return itemsTotal + (order.transport_cost || 0) + (order.other_costs || 0);
  };

  const calculateTotalPlates = (order: any) => {
    const items = order.procurement_order_items || [];
    return items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  };

  const calculateFinalPricePerM2 = (order: any) => {
    const items = order.procurement_order_items || [];
    const totalAreaM2 = items.reduce((sum: number, item: any) => {
      return sum + (item.width_mm * item.height_mm * item.quantity) / 1_000_000;
    }, 0);
    if (totalAreaM2 === 0) return null;
    const totalCost = calculateOrderTotal(order);
    return totalCost / totalAreaM2;
  };

  const calculateTransitDuration = (order: any) => {
    const startDate = new Date(order.order_date);
    const endDate = order.actual_arrival_date
      ? new Date(order.actual_arrival_date)
      : order.expected_arrival_date
        ? new Date(order.expected_arrival_date)
        : null;
    if (!endDate) return null;
    const diffMs = endDate.getTime() - startDate.getTime();
    const totalDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(totalDays / 30);
    const days = totalDays % 30;
    if (months > 0 && days > 0) return `${months} mes. ${days} dana`;
    if (months > 0) return `${months} mes.`;
    return `${totalDays} dana`;
  };

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nema narudžbina. Kreirajte novu klikom na "Nova narudžbina".
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card key={order.id}>
          <Collapsible open={expandedOrders.has(order.id)} onOpenChange={() => toggleExpand(order.id)}>
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {expandedOrders.has(order.id) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <div>
                    <CardTitle className="text-base">{order.supplier_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Naručeno: {format(new Date(order.order_date), "dd.MM.yyyy")}
                      {" · "}
                      {calculateTotalPlates(order)} ploča
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_LABELS[order.status]?.variant || "secondary"}>
                    {STATUS_LABELS[order.status]?.label || order.status}
                  </Badge>
                  {editingOrder === order.id ? (
                    <>
                      <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingOrder(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(order)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* Editable Fields */}
                {editingOrder === order.id ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <label className="text-sm text-muted-foreground">Status</label>
                      <Select
                        value={editValues.status}
                        onValueChange={(v) => setEditValues({ ...editValues, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ordered">Naručeno</SelectItem>
                          <SelectItem value="in_transit">Na brodu</SelectItem>
                          <SelectItem value="customs">Carina</SelectItem>
                          <SelectItem value="arrived">Stiglo</SelectItem>
                          <SelectItem value="cancelled">Otkazano</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Očekivani dolazak</label>
                      <Input
                        type="date"
                        value={editValues.expected_arrival_date}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setEditValues({ ...editValues, expected_arrival_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Stvarni dolazak</label>
                      <Input
                        type="date"
                        value={editValues.actual_arrival_date}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setEditValues({ ...editValues, actual_arrival_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Transport (€)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editValues.transport_cost}
                        onChange={(e) => setEditValues({ ...editValues, transport_cost: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Ostali troškovi (€)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editValues.other_costs}
                        onChange={(e) => setEditValues({ ...editValues, other_costs: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Očekivani dolazak:</span>
                      <p className="font-medium">
                        {order.expected_arrival_date
                          ? format(new Date(order.expected_arrival_date), "dd.MM.yyyy")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stvarni dolazak:</span>
                      <p className="font-medium">
                        {order.actual_arrival_date
                          ? format(new Date(order.actual_arrival_date), "dd.MM.yyyy")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Transport:</span>
                      <p className="font-medium">{order.transport_cost?.toFixed(2) || 0} €</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ostali troškovi:</span>
                      <p className="font-medium">{order.other_costs?.toFixed(2) || 0} €</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Krajnja cena/m²:</span>
                      <p className="font-bold text-primary">
                        {(() => {
                          const priceUsd = calculateFinalPricePerM2(order);
                          if (priceUsd == null) return "-";
                          const usdStr = priceUsd.toFixed(4).replace('.', ',');
                          const priceEur = priceUsd * usdToEur;
                          return `${usdStr} $ / ${priceEur.toFixed(4).replace('.', ',')} €`;
                        })()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Trajanje puta:</span>
                      <p className="font-medium">
                        {calculateTransitDuration(order) ?? "-"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Items Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Format</TableHead>
                      <TableHead className="text-right">Količina</TableHead>
                      <TableHead className="text-right">Cena/m²</TableHead>
                      <TableHead className="text-right">Ukupno $</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(order.procurement_order_items || []).map((item: any) => {
                      const areaM2 = (item.width_mm * item.height_mm * item.quantity) / 1_000_000;
                      const itemTotal = areaM2 * (item.price_per_m2 || 0);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.plate_formats?.format_name || `${item.width_mm}x${item.height_mm}`}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{item.price_per_m2?.toFixed(2)} $</TableCell>
                          <TableCell className="text-right">{itemTotal.toFixed(2)} $</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="font-bold bg-muted/30">
                      <TableCell colSpan={3}>UKUPNO (sa svim troškovima)</TableCell>
                      <TableCell className="text-right">{calculateOrderTotal(order).toFixed(2)} $</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {order.notes && (
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
                    <strong>Napomena:</strong> {order.notes}
                  </p>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
}
