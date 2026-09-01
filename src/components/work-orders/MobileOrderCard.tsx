import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Send, Pencil, Lock, CheckCircle2 } from "lucide-react";
import { displayOrderNumber } from "@/lib/orderLabel";

interface WorkOrder {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  created_at: string;
  invalidated_at?: string;
  deleted_at?: string;
  invalid_reason?: string;
  notes?: string | null;
  clients?: { name: string };
  profiles?: { full_name: string };
  _closedByName?: string;
  _closedByMix?: boolean;
  type?: string;
  serial?: number;
  year?: number;
}

interface MobileOrderCardProps {
  order: WorkOrder;
  onView: (id: string) => void;
  onDeliveryNote: (id: string) => void;
  onEdit?: (id: string) => void;
  onClose?: (order: WorkOrder) => void;
  canClose?: boolean;
}

export const MobileOrderCard = ({
  order,
  onView,
  onDeliveryNote,
  onEdit,
  onClose,
  canClose = false,
}: MobileOrderCardProps) => {
  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case "ctp": return "CTP";
      case "digital": return "Digital";
      case "other": return "Ostalo";
      case "film": return "Film";
      default: return type;
    }
  };

  const getOrderTypeBadgeColor = (type: string) => {
    switch (type) {
      case "ctp": return "bg-blue-100 text-blue-800 border-blue-200";
      case "digital": return "bg-purple-100 text-purple-800 border-purple-200";
      case "film": return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusBadge = () => {
    if (order.deleted_at) {
      return <Badge variant="destructive">Obrisan</Badge>;
    }
    if (order.invalidated_at) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">Nevažeći</Badge>;
    }
    return order.status === "open" ? (
      <Badge variant="default">Otvoren</Badge>
    ) : (
      <Badge variant="secondary">Zatvoren</Badge>
    );
  };

  const isOpen = order.status === "open" && !order.invalidated_at;
  const isClosed = order.status === "closed";

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-semibold text-base">{displayOrderNumber(order)}</p>
            {order.job_name && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {order.job_name}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">
              {order.clients?.name || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getOrderTypeBadgeColor(order.order_type)}>
              {getOrderTypeLabel(order.order_type)}
            </Badge>
            {getStatusBadge()}
          </div>
        </div>

        {/* Info Row */}
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
          <div>
            <span className="font-medium">Kreirao:</span>{" "}
            {order.profiles?.full_name || "—"}
          </div>
          <div>
            <span className="font-medium">Datum:</span>{" "}
            {new Date(order.created_at).toLocaleDateString("sr-RS")}
          </div>
        </div>

        {order.invalid_reason && (
          <p className="text-xs text-orange-600 mb-3">
            Razlog: {order.invalid_reason}
          </p>
        )}

        {/* Actions Row */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onView(order.id)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Prikaz
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onDeliveryNote(order.id)}
          >
            <Send className="h-4 w-4 mr-1" />
            Otpremnica
          </Button>

          {isOpen && onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(order.id)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}

          {canClose && onClose && (
            <Button
              variant="default"
              size="sm"
              disabled={isClosed || !!order.invalidated_at}
              onClick={() => onClose(order)}
            >
              {isClosed ? <Lock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
