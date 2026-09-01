import { useNavigate } from "react-router-dom";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, Lock, AlertTriangle, Trash2, Pencil, Send, FileCheck } from "lucide-react";
import { displayOrderNumber } from "@/lib/orderLabel";

interface WorkOrderTableRowProps {
  order: any;
  isSuper: boolean;
  isAdmin: boolean;
  exportSelected: boolean;
  closeSelected: boolean;
  onToggleExport: (id: string) => void;
  onToggleClose: (id: string, isOpen: boolean) => void;
  onCloseOrder: (order: any, e: React.MouseEvent) => void;
  onInvalidate: (order: any) => void;
  onDelete: (order: any) => void;
}

const getOrderTypeLabel = (type: string) => {
  switch (type) {
    case "ctp": return "CTP";
    case "digital": return "Digital";
    case "film": return "Filmovanje";
    case "other": return "Ostalo";
    default: return type;
  }
};

const getStatusBadge = (status: string, invalidatedAt?: string, deletedAt?: string) => {
  if (deletedAt) return <Badge variant="destructive">Obrisan</Badge>;
  if (invalidatedAt) return <Badge variant="outline" className="border-destructive/50 text-destructive">Nevažeći</Badge>;
  return status === "open" ? <Badge variant="default">Otvoren</Badge> : <Badge variant="secondary">Zatvoren</Badge>;
};

const getOrderQuantity = (order: any) => {
  if (order.order_type === 'ctp') {
    const total = (order.file_entries || []).reduce((s: number, e: any) => s + (e.quantity || 0), 0);
    return total > 0 ? `${total} ploča` : '-';
  }
  if (order.order_type === 'film') {
    const total = (order.film_jobs || []).reduce((s: number, j: any) => s + (j.computed_total_m || 0), 0);
    return total > 0 ? `${total.toFixed(2)} m` : '-';
  }
  return '-';
};

const getClosedByDisplay = (order: any) => {
  if (order.status !== 'closed') return '-';
  if (order._closedByMix) return 'Mix';
  if (order._closedByName) return order._closedByName;
  return '-';
};

const getEmailStatusBadge = (emailStatus: any) => {
  if (!emailStatus) return null;
  if (emailStatus.status === "sent") return <span title="Email poslat">📧 poslato</span>;
  if (emailStatus.status === "error") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-destructive cursor-help">📧 greška</span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{emailStatus.error_msg || "Greška pri slanju"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return null;
};

export const WorkOrderTableRow = ({
  order,
  isSuper,
  isAdmin,
  exportSelected,
  closeSelected,
  onToggleExport,
  onToggleClose,
  onCloseOrder,
  onInvalidate,
  onDelete,
}: WorkOrderTableRowProps) => {
  const navigate = useNavigate();

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => navigate(`/work-orders/${order.id}`)}
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={exportSelected}
          onCheckedChange={() => onToggleExport(order.id)}
          title="Odaberi za izvoz"
        />
      </TableCell>
      {(isSuper || isAdmin) && (
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={closeSelected}
            onCheckedChange={() => onToggleClose(order.id, order.status === 'open')}
            disabled={order.status === 'closed'}
            title="Odaberi za zatvaranje"
          />
        </TableCell>
      )}
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span>{displayOrderNumber(order)}</span>
          {order.invoiced_at && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <FileCheck className="h-4 w-4 text-primary" />
                </TooltipTrigger>
                <TooltipContent>
                  Fakturisano: {order.invoice_number || 'Da'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {order.notes && (
          <span
            className="text-xs text-muted-foreground block mt-0.5 max-w-[260px] truncate font-normal"
            title={order.notes}
          >
            {order.notes}
          </span>
        )}
        {order.invalid_reason && (
          <span className="text-xs text-destructive block mt-1">
            Razlog: {order.invalid_reason}
          </span>
        )}

      </TableCell>
      <TableCell>{order.clients?.name}</TableCell>
      <TableCell>{getOrderTypeLabel(order.order_type)}</TableCell>
      <TableCell className="text-right font-medium">{getOrderQuantity(order)}</TableCell>
      <TableCell>{getStatusBadge(order.status, order.invalidated_at, order.deleted_at)}</TableCell>
      <TableCell>{order.profiles?.full_name || '-'}</TableCell>
      <TableCell>{getClosedByDisplay(order)}</TableCell>
      <TableCell>{new Date(order.created_at).toLocaleDateString('sr-RS')}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); window.open(`/work-orders/${order.id}/print`, '_blank'); }}>
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Prikaz</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/work-orders/${order.id}/delivery-note`); }}>
                  <Send className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Otpremnica</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {order.status === 'open' && !order.invalidated_at && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/work-orders/${order.id}/edit`); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Izmeni</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {(isAdmin || isSuper) && !order.invalidated_at && !order.deleted_at && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onInvalidate(order); }}>
                    <AlertTriangle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Nevažeći</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isSuper && !order.deleted_at && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(order); }} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Obriši</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
      {(isSuper || isAdmin) && (
        <TableCell className="text-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-block">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={order.status === 'closed' || order.invalidated_at}
                    onClick={(e) => onCloseOrder(order, e)}
                  >
                    {order.status === 'closed' && <Lock className="h-4 w-4 mr-2" />}
                    {order.invalidated_at && <AlertTriangle className="h-4 w-4 mr-2" />}
                    Zatvori
                  </Button>
                </div>
              </TooltipTrigger>
              {(order.status === 'closed' || order.invalidated_at) && (
                <TooltipContent>
                  <p>{order.status === 'closed' ? 'Nalog je već zatvoren' : 'Nalog je nevažeći'}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </TableCell>
      )}
    </TableRow>
  );
};

export { getOrderTypeLabel, getOrderQuantity };
