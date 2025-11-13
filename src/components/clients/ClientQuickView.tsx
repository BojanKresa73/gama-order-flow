import { Client } from "@/hooks/useClients";
import { useClientStats } from "@/hooks/useClientStats";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Mail,
  Phone,
  MapPin,
  Building,
  FileText,
  Calendar,
  Printer,
  Monitor,
  Plus,
} from "lucide-react";

interface ClientQuickViewProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (client: Client) => void;
}

export const ClientQuickView = ({ client, open, onOpenChange, onEdit }: ClientQuickViewProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useClientStats(client?.id || "");

  if (!client) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Kopirano",
      description: `${label} je kopiran u clipboard`,
    });
  };

  const handleNewOrder = () => {
    navigate(`/new-work-order?clientId=${client.id}`);
    onOpenChange(false);
  };

  const getOrderTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ctp: "CTP",
      digital: "Digital",
      film: "Film",
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Building className="h-6 w-6" />
            {client.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Left Column - Client Data */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Podaci klijenta
            </h3>

            <div className="space-y-3">
              {/* PIB & Matični broj */}
              {(client.pib || client.maticni_broj) && (
                <div className="grid grid-cols-2 gap-4">
                  {client.pib && (
                    <div>
                      <p className="text-sm text-muted-foreground">PIB</p>
                      <p className="font-medium">{client.pib}</p>
                    </div>
                  )}
                  {client.maticni_broj && (
                    <div>
                      <p className="text-sm text-muted-foreground">Matični broj</p>
                      <p className="font-medium">{client.maticni_broj}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Address */}
              {(client.adresa || client.grad || client.postanski_broj || client.drzava) && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-sm text-muted-foreground">Adresa</p>
                    {client.adresa && <p className="font-medium">{client.adresa}</p>}
                    <p className="font-medium">
                      {[client.postanski_broj, client.grad].filter(Boolean).join(" ")}
                    </p>
                    {client.drzava && <p className="font-medium">{client.drzava}</p>}
                  </div>
                </div>
              )}

              {/* Contact */}
              {client.kontakt_osoba && (
                <div>
                  <p className="text-sm text-muted-foreground">Kontakt osoba</p>
                  <p className="font-medium">{client.kontakt_osoba}</p>
                </div>
              )}

              {client.telefon && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Telefon</p>
                    <p className="font-medium">{client.telefon}</p>
                  </div>
                </div>
              )}

              {/* Emails */}
              {client.email && (
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{client.email}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(client.email!, "Email")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {client.notification_email && (
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Email za obaveštenja</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{client.notification_email}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(client.notification_email!, "Email za obaveštenja")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* Payment & Discount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Rok plaćanja</p>
                  <Badge variant="outline">{client.rok_placanja_dana} dana</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rabat</p>
                  <Badge variant="secondary">{client.rabat_procenat}%</Badge>
                </div>
              </div>

              {/* Notes */}
              {client.napomena && (
                <div>
                  <p className="text-sm text-muted-foreground">Napomena</p>
                  <p className="font-medium whitespace-pre-wrap text-sm">{client.napomena}</p>
                </div>
              )}

              <Separator />

              {/* CRM Block */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">CRM</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChange(false);
                      onEdit(client);
                    }}
                  >
                    Uredi
                  </Button>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Poslednja aktivnost</p>
                    <p className="font-medium">
                      {client.last_activity_at 
                        ? new Date(client.last_activity_at).toLocaleDateString("sr-RS") 
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Poslednji kontakt</p>
                    <p className="font-medium">
                      {client.last_contacted_at 
                        ? new Date(client.last_contacted_at).toLocaleDateString("sr-RS") 
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sledeći follow-up</p>
                    <p className="font-medium">
                      {client.next_follow_up_at 
                        ? new Date(client.next_follow_up_at).toLocaleDateString("sr-RS") 
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vlasnik (ID)</p>
                    <p className="font-medium">{client.owner_user_id || "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Statistics */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Sažeci
            </h3>

            {isLoading ? (
              <div className="text-sm text-muted-foreground">Učitavanje statistike...</div>
            ) : stats ? (
              <div className="space-y-4">
                {/* Orders Summary */}
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Radni nalozi</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Ukupno:</span>
                      <Badge variant="outline">{stats.totalOrders}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Otvoreni:</span>
                      <Badge variant="default">{stats.openOrders}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Zatvoreni:</span>
                      <Badge variant="secondary">{stats.closedOrders}</Badge>
                    </div>
                  </div>
                </div>

                {/* Last Order */}
                {stats.lastOrder && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Poslednji nalog</p>
                    <div className="space-y-1">
                      <p className="font-medium">{stats.lastOrder.order_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(stats.lastOrder.created_at).toLocaleDateString("sr-RS")}
                      </p>
                      <Badge variant="outline">
                        {getOrderTypeLabel(stats.lastOrder.order_type)}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* CTP Stats */}
                {stats.topFormats.length > 0 && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <Printer className="h-4 w-4" />
                      CTP - Top formati
                    </p>
                    <div className="space-y-2">
                      {stats.topFormats.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="text-sm">{item.format}</span>
                          <Badge variant="secondary">{item.count} ploča</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Digital Stats */}
                {stats.totalClicksYTD > 0 && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      Digital (YTD)
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Ukupno klikova:</span>
                      <Badge variant="default">{stats.totalClicksYTD.toLocaleString()}</Badge>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Nema dostupnih podataka</div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex-1">
                  <Button 
                    onClick={handleNewOrder} 
                    className="w-full"
                    disabled={client.is_blocked}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Novi nalog za ovog klijenta
                  </Button>
                </div>
              </TooltipTrigger>
              {client.is_blocked && (
                <TooltipContent>
                  <p>Klijent je blokiran</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
};
