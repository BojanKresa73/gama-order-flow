import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

interface DeliveryNotePreviewProps {
  workOrderId: string;
}

interface DeliveryNote {
  id: string;
  delivery_number: string;
  client_name: string;
  opened_at: string;
  closed_at: string;
  items: Array<{
    filename: string;
    quantity: number;
    file_type: string;
  }>;
  sent_at: string | null;
}

const DeliveryNotePreview = ({ workOrderId }: DeliveryNotePreviewProps) => {
  const [deliveryNote, setDeliveryNote] = useState<DeliveryNote | null>(null);
  const [workOrderNumber, setWorkOrderNumber] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeliveryNote();
  }, [workOrderId]);

  const fetchDeliveryNote = async () => {
    try {
      setLoading(true);

      // Fetch work order number
      const { data: workOrder } = await supabase
        .from("work_orders")
        .select("order_number")
        .eq("id", workOrderId)
        .single();

      if (workOrder) {
        setWorkOrderNumber(workOrder.order_number);
      }

      // Fetch delivery note
      const { data, error } = await supabase
        .from("delivery_notes")
        .select("*")
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error("Error fetching delivery note:", error);
        return;
      }

      if (data) {
        setDeliveryNote({
          ...data,
          items: data.items as Array<{
            filename: string;
            quantity: number;
            file_type: string;
          }>,
        });
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Učitavanje...</div>;
  }

  if (!deliveryNote) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Nema otpremnice za ovaj nalog
      </div>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader className="bg-muted/50">
        <CardTitle className="text-2xl text-center">
          Otpremnica - {deliveryNote.delivery_number}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Klijent</p>
            <p className="font-semibold">{deliveryNote.client_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Radni nalog</p>
            <p className="font-semibold">{workOrderNumber}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Datum otvaranja</p>
            <p className="font-semibold">
              {format(new Date(deliveryNote.opened_at), "dd.MM.yyyy")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Datum zatvaranja</p>
            <p className="font-semibold">
              {format(new Date(deliveryNote.closed_at), "dd.MM.yyyy")}
            </p>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-3">Stavke:</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-semibold">Naziv fajla</th>
                  <th className="text-left p-3 font-semibold">Količina</th>
                  <th className="text-left p-3 font-semibold">Tip</th>
                </tr>
              </thead>
              <tbody>
                {deliveryNote.items.map((item, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-3">{item.filename}</td>
                    <td className="p-3">{item.quantity || "-"}</td>
                    <td className="p-3">{item.file_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {deliveryNote.sent_at && (
          <div className="text-sm text-muted-foreground text-center pt-4 border-t">
            Poslato: {format(new Date(deliveryNote.sent_at), "dd.MM.yyyy HH:mm")}
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          Ova otpremnica je automatski generisana iz sistema za upravljanje radnim
          nalozima.
        </div>
      </CardContent>
    </Card>
  );
};

export default DeliveryNotePreview;
