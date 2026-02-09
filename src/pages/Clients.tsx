import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useClients, Client } from "@/hooks/useClients";
import { ClientsTable } from "@/components/clients/ClientsTable";
import { ClientsFilters, ClientFilters } from "@/components/clients/ClientsFilters";
import { ClientsCsvImport } from "@/components/clients/ClientsCsvImport";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Clients = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState<{
    name: string;
    pib: string;
    maticni_broj: string;
    adresa: string;
    grad: string;
    postanski_broj: string;
    drzava: string;
    kontakt_osoba: string;
    telefon: string;
    email: string;
    notification_email: string;
    notification_email_2: string;
    notification_email_3: string;
    rok_placanja_dana: number;
    rabat_procenat: number;
    napomena: string;
    is_vip: boolean;
    is_blocked: boolean;
    segment: "novi" | "redovan" | "premium";
  }>({
    name: "",
    pib: "",
    maticni_broj: "",
    adresa: "",
    grad: "",
    postanski_broj: "",
    drzava: "Srbija",
    kontakt_osoba: "",
    telefon: "",
    email: "",
    notification_email: "",
    notification_email_2: "",
    notification_email_3: "",
    rok_placanja_dana: 0,
    rabat_procenat: 0,
    napomena: "",
    is_vip: false,
    is_blocked: false,
    segment: "novi",
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<ClientFilters>({
    search: "",
    grad: "",
    pibFilter: "all",
    rokPlacanjaMin: 0,
    rokPlacanjaMax: 120,
    rabatMin: 0,
    rabatMax: 100,
    onlyVip: false,
    onlyBlocked: false,
    segment: "all",
    followUpDate: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: clients = [], isLoading, refetch } = useClients(filters);

  // Get distinct cities for filter dropdown
  const cities = useMemo(() => {
    const allClients = clients || [];
    const uniqueCities = new Set(
      allClients
        .map((c) => c.grad)
        .filter((city): city is string => !!city)
    );
    return Array.from(uniqueCities).sort();
  }, [clients]);

  const validateClient = (client: any) => {
    const errors: Record<string, string> = {};

    // Name is required
    if (!client.name?.trim()) {
      errors.name = "Naziv je obavezan";
    }

    // PIB validation: 9 digits (only if provided)
    if (client.pib && client.pib.trim()) {
      const pibDigits = client.pib.replace(/\s/g, '');
      if (!/^\d{9}$/.test(pibDigits)) {
        errors.pib = "PIB mora biti tačno 9 cifara";
      }
    }

    // Email validation (if provided)
    if (client.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email.trim())) {
      errors.email = "Neispravan email format";
    }

    // Notification email validation (if provided)
    if (client.notification_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.notification_email.trim())) {
      errors.notification_email = "Neispravan email format";
    }

    // Notification email 2 validation (if provided)
    if (client.notification_email_2 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.notification_email_2.trim())) {
      errors.notification_email_2 = "Neispravan email format";
    }

    // Notification email 3 validation (if provided)
    if (client.notification_email_3 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.notification_email_3.trim())) {
      errors.notification_email_3 = "Neispravan email format";
    }

    // Rabat validation: 0-100
    if (client.rabat_procenat < 0 || client.rabat_procenat > 100) {
      errors.rabat_procenat = "Rabat mora biti između 0 i 100%";
    }

    // Rok placanja validation: 0-120
    if (client.rok_placanja_dana < 0 || client.rok_placanja_dana > 120) {
      errors.rok_placanja_dana = "Rok plaćanja mora biti između 0 i 120 dana";
    }

    return errors;
  };

  const handleCreateClient = async () => {
    const errors = validateClient(newClient);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast({
        title: "Greška",
        description: "Molimo popravite označena polja",
        variant: "destructive",
      });
      return;
    }

    try {
      // Normalize PIB before saving
      const normalizedPib = newClient.pib?.trim().replace(/\s/g, '') || null;
      
      const clientData = {
        ...newClient,
        pib: normalizedPib,
        maticni_broj: newClient.maticni_broj.trim() || null,
        adresa: newClient.adresa.trim() || null,
        grad: newClient.grad.trim() || null,
        postanski_broj: newClient.postanski_broj.trim() || null,
        kontakt_osoba: newClient.kontakt_osoba.trim() || null,
        telefon: newClient.telefon.trim() || null,
        email: newClient.email.trim() || null,
        notification_email: newClient.notification_email.trim() || null,
        notification_email_2: newClient.notification_email_2.trim() || null,
        notification_email_3: newClient.notification_email_3.trim() || null,
        napomena: newClient.napomena.trim() || null,
      };

      const { error } = await supabase
        .from("clients")
        .insert([clientData]);

      if (error) {
        // Check for unique constraint violation
        if (error.code === '23505' && error.message.includes('idx_clients_pib')) {
          toast({
            title: "Greška",
            description: "PIB već postoji kod drugog klijenta",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Uspeh",
        description: "Klijent je uspešno kreiran",
      });

      setDialogOpen(false);
      setNewClient({
        name: "",
        pib: "",
        maticni_broj: "",
        adresa: "",
        grad: "",
        postanski_broj: "",
        drzava: "Srbija",
        kontakt_osoba: "",
        telefon: "",
        email: "",
        notification_email: "",
        notification_email_2: "",
        notification_email_3: "",
        rok_placanja_dana: 0,
        rabat_procenat: 0,
        napomena: "",
        is_vip: false,
        is_blocked: false,
        segment: "novi",
      });
      setValidationErrors({});
      refetch();
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditClient = async () => {
    if (!editingClient) return;

    const errors = validateClient(editingClient);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast({
        title: "Greška",
        description: "Molimo popravite označena polja",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Normalize PIB before saving
      const normalizedPib = editingClient.pib?.trim().replace(/\s/g, '') || null;
      
      const clientData = {
        name: editingClient.name,
        pib: normalizedPib,
        maticni_broj: editingClient.maticni_broj?.trim() || null,
        adresa: editingClient.adresa?.trim() || null,
        grad: editingClient.grad?.trim() || null,
        postanski_broj: editingClient.postanski_broj?.trim() || null,
        drzava: editingClient.drzava || "Srbija",
        kontakt_osoba: editingClient.kontakt_osoba?.trim() || null,
        telefon: editingClient.telefon?.trim() || null,
        email: editingClient.email?.trim() || null,
        notification_email: editingClient.notification_email?.trim() || null,
        notification_email_2: editingClient.notification_email_2?.trim() || null,
        notification_email_3: editingClient.notification_email_3?.trim() || null,
        rok_placanja_dana: editingClient.rok_placanja_dana || 0,
        rabat_procenat: editingClient.rabat_procenat || 0,
        napomena: editingClient.napomena?.trim() || null,
      };

      const { error } = await supabase
        .from("clients")
        .update(clientData)
        .eq("id", editingClient.id);

      if (error) {
        // Check for unique constraint violation
        if (error.code === '23505' && error.message.includes('idx_clients_pib')) {
          toast({
            title: "Greška",
            description: "PIB već postoji kod drugog klijenta",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Uspeh",
        description: "Klijent je uspešno ažuriran",
      });

      setEditingClient(null);
      setValidationErrors({});
      refetch();
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (client: Client) => {
    setEditingClient({ ...client });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Učitavanje...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Klijenti</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/checklist")}>
              Checklist
            </Button>
            <ClientsCsvImport />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novi klijent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Kreiranje klijenta</DialogTitle>
                <DialogDescription>Dodajte novog klijenta u sistem</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label htmlFor="name">Naziv *</Label>
                  <Input
                    id="name"
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    placeholder="Naziv klijenta"
                    className={validationErrors.name ? "border-destructive" : ""}
                  />
                  {validationErrors.name && (
                    <p className="text-sm text-destructive">{validationErrors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pib">PIB</Label>
                  <Input
                    id="pib"
                    value={newClient.pib}
                    onChange={(e) => {
                      // Allow only digits, max 9 characters
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 9);
                      setNewClient({ ...newClient, pib: digitsOnly });
                      setValidationErrors((prev) => ({ ...prev, pib: "" }));
                    }}
                    placeholder="123456789"
                    maxLength={9}
                    className={validationErrors.pib ? "border-destructive" : ""}
                  />
                  {validationErrors.pib && (
                    <p className="text-sm text-destructive">{validationErrors.pib}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maticni_broj">Matični broj</Label>
                  <Input
                    id="maticni_broj"
                    value={newClient.maticni_broj}
                    onChange={(e) => setNewClient({ ...newClient, maticni_broj: e.target.value })}
                    placeholder="12345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adresa">Adresa</Label>
                  <Input
                    id="adresa"
                    value={newClient.adresa}
                    onChange={(e) => setNewClient({ ...newClient, adresa: e.target.value })}
                    placeholder="Ulica i broj"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="grad">Grad</Label>
                    <Input
                      id="grad"
                      value={newClient.grad}
                      onChange={(e) => setNewClient({ ...newClient, grad: e.target.value })}
                      placeholder="Beograd"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postanski_broj">Poštanski broj</Label>
                    <Input
                      id="postanski_broj"
                      value={newClient.postanski_broj}
                      onChange={(e) => setNewClient({ ...newClient, postanski_broj: e.target.value })}
                      placeholder="11000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drzava">Država</Label>
                  <Input
                    id="drzava"
                    value={newClient.drzava}
                    onChange={(e) => setNewClient({ ...newClient, drzava: e.target.value })}
                    placeholder="Srbija"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kontakt_osoba">Kontakt osoba</Label>
                  <Input
                    id="kontakt_osoba"
                    value={newClient.kontakt_osoba}
                    onChange={(e) => setNewClient({ ...newClient, kontakt_osoba: e.target.value })}
                    placeholder="Ime i prezime"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefon">Telefon</Label>
                  <Input
                    id="telefon"
                    value={newClient.telefon}
                    onChange={(e) => setNewClient({ ...newClient, telefon: e.target.value })}
                    placeholder="+381 11 1234 567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="email@primer.com"
                    className={validationErrors.email ? "border-destructive" : ""}
                  />
                  {validationErrors.email && (
                    <p className="text-sm text-destructive">{validationErrors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notification_email">Email za obaveštenja 1</Label>
                  <Input
                    id="notification_email"
                    type="email"
                    value={newClient.notification_email}
                    onChange={(e) => setNewClient({ ...newClient, notification_email: e.target.value })}
                    placeholder="obavestenje@primer.rs"
                    className={validationErrors.notification_email ? "border-destructive" : ""}
                  />
                  {validationErrors.notification_email && (
                    <p className="text-sm text-destructive">{validationErrors.notification_email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notification_email_2">Email za obaveštenja 2</Label>
                  <Input
                    id="notification_email_2"
                    type="email"
                    value={newClient.notification_email_2}
                    onChange={(e) => setNewClient({ ...newClient, notification_email_2: e.target.value })}
                    placeholder="drugi.mail@primer.rs"
                    className={validationErrors.notification_email_2 ? "border-destructive" : ""}
                  />
                  {validationErrors.notification_email_2 && (
                    <p className="text-sm text-destructive">{validationErrors.notification_email_2}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notification_email_3">Email za obaveštenja 3</Label>
                  <Input
                    id="notification_email_3"
                    type="email"
                    value={newClient.notification_email_3}
                    onChange={(e) => setNewClient({ ...newClient, notification_email_3: e.target.value })}
                    placeholder="treci.mail@primer.rs"
                    className={validationErrors.notification_email_3 ? "border-destructive" : ""}
                  />
                  {validationErrors.notification_email_3 && (
                    <p className="text-sm text-destructive">{validationErrors.notification_email_3}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rok_placanja_dana">Rok plaćanja (dana)</Label>
                    <Input
                      id="rok_placanja_dana"
                      type="number"
                      min="0"
                      max="120"
                      value={newClient.rok_placanja_dana}
                      onChange={(e) => setNewClient({ ...newClient, rok_placanja_dana: parseInt(e.target.value) || 0 })}
                      className={validationErrors.rok_placanja_dana ? "border-destructive" : ""}
                    />
                    {validationErrors.rok_placanja_dana && (
                      <p className="text-sm text-destructive">{validationErrors.rok_placanja_dana}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rabat_procenat">Rabat (%)</Label>
                    <Input
                      id="rabat_procenat"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={newClient.rabat_procenat}
                      onChange={(e) => setNewClient({ ...newClient, rabat_procenat: parseFloat(e.target.value) || 0 })}
                      className={validationErrors.rabat_procenat ? "border-destructive" : ""}
                    />
                    {validationErrors.rabat_procenat && (
                      <p className="text-sm text-destructive">{validationErrors.rabat_procenat}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="napomena">Napomena</Label>
                  <Input
                    id="napomena"
                    value={newClient.napomena}
                    onChange={(e) => setNewClient({ ...newClient, napomena: e.target.value })}
                    placeholder="Dodatne napomene..."
                  />
                </div>

                {/* New status fields */}
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium text-sm">Status i segment</h4>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_vip"
                      checked={newClient.is_vip}
                      onCheckedChange={(checked) => setNewClient({ ...newClient, is_vip: checked })}
                    />
                    <Label htmlFor="is_vip" className="cursor-pointer">VIP klijent</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_blocked"
                      checked={newClient.is_blocked}
                      onCheckedChange={(checked) => setNewClient({ ...newClient, is_blocked: checked })}
                    />
                    <Label htmlFor="is_blocked" className="cursor-pointer">Blokiran</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="segment">Segment</Label>
                    <Select
                      value={newClient.segment}
                      onValueChange={(value: "novi" | "redovan" | "premium") =>
                        setNewClient({ ...newClient, segment: value })
                      }
                    >
                      <SelectTrigger id="segment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="novi">Novi</SelectItem>
                        <SelectItem value="redovan">Redovan</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Otkaži
                </Button>
                <Button onClick={handleCreateClient}>Kreiraj</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <ClientsFilters cities={cities} onFiltersChange={setFilters} />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Svi klijenti
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nema klijenata. Dodajte prvog klijenta.</p>
                </div>
              ) : (
                <ClientsTable clients={clients} onEdit={openEditDialog} />
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Edit Client Dialog */}
      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Izmena klijenta</DialogTitle>
            <DialogDescription>Izmenite podatke o klijentu</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Naziv *</Label>
              <Input
                id="edit-name"
                value={editingClient?.name || ""}
                onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                placeholder="Naziv klijenta"
                className={validationErrors.name ? "border-destructive" : ""}
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">{validationErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pib">PIB</Label>
              <Input
                id="edit-pib"
                value={editingClient?.pib || ""}
                onChange={(e) => {
                  // Allow only digits, max 9 characters
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 9);
                  setEditingClient({ ...editingClient, pib: digitsOnly });
                  setValidationErrors((prev) => ({ ...prev, pib: "" }));
                }}
                placeholder="123456789"
                maxLength={9}
                className={validationErrors.pib ? "border-destructive" : ""}
              />
              {validationErrors.pib && (
                <p className="text-sm text-destructive">{validationErrors.pib}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-maticni-broj">Matični broj</Label>
              <Input
                id="edit-maticni-broj"
                value={editingClient?.maticni_broj || ""}
                onChange={(e) => setEditingClient({ ...editingClient, maticni_broj: e.target.value })}
                placeholder="12345678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-adresa">Adresa</Label>
              <Input
                id="edit-adresa"
                value={editingClient?.adresa || ""}
                onChange={(e) => setEditingClient({ ...editingClient, adresa: e.target.value })}
                placeholder="Ulica i broj"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-grad">Grad</Label>
                <Input
                  id="edit-grad"
                  value={editingClient?.grad || ""}
                  onChange={(e) => setEditingClient({ ...editingClient, grad: e.target.value })}
                  placeholder="Beograd"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-postanski-broj">Poštanski broj</Label>
                <Input
                  id="edit-postanski-broj"
                  value={editingClient?.postanski_broj || ""}
                  onChange={(e) => setEditingClient({ ...editingClient, postanski_broj: e.target.value })}
                  placeholder="11000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-drzava">Država</Label>
              <Input
                id="edit-drzava"
                value={editingClient?.drzava || "Srbija"}
                onChange={(e) => setEditingClient({ ...editingClient, drzava: e.target.value })}
                placeholder="Srbija"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-kontakt-osoba">Kontakt osoba</Label>
              <Input
                id="edit-kontakt-osoba"
                value={editingClient?.kontakt_osoba || ""}
                onChange={(e) => setEditingClient({ ...editingClient, kontakt_osoba: e.target.value })}
                placeholder="Ime i prezime"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-telefon">Telefon</Label>
              <Input
                id="edit-telefon"
                value={editingClient?.telefon || ""}
                onChange={(e) => setEditingClient({ ...editingClient, telefon: e.target.value })}
                placeholder="+381 11 1234 567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editingClient?.email || ""}
                onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                placeholder="email@primer.com"
                className={validationErrors.email ? "border-destructive" : ""}
              />
              {validationErrors.email && (
                <p className="text-sm text-destructive">{validationErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notification-email">Email za obaveštenja 1</Label>
              <Input
                id="edit-notification-email"
                type="email"
                value={editingClient?.notification_email || ""}
                onChange={(e) => setEditingClient({ ...editingClient, notification_email: e.target.value })}
                placeholder="obavestenje@primer.rs"
                className={validationErrors.notification_email ? "border-destructive" : ""}
              />
              {validationErrors.notification_email && (
                <p className="text-sm text-destructive">{validationErrors.notification_email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notification-email-2">Email za obaveštenja 2</Label>
              <Input
                id="edit-notification-email-2"
                type="email"
                value={editingClient?.notification_email_2 || ""}
                onChange={(e) => setEditingClient({ ...editingClient, notification_email_2: e.target.value })}
                placeholder="drugi.mail@primer.rs"
                className={validationErrors.notification_email_2 ? "border-destructive" : ""}
              />
              {validationErrors.notification_email_2 && (
                <p className="text-sm text-destructive">{validationErrors.notification_email_2}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notification-email-3">Email za obaveštenja 3</Label>
              <Input
                id="edit-notification-email-3"
                type="email"
                value={editingClient?.notification_email_3 || ""}
                onChange={(e) => setEditingClient({ ...editingClient, notification_email_3: e.target.value })}
                placeholder="treci.mail@primer.rs"
                className={validationErrors.notification_email_3 ? "border-destructive" : ""}
              />
              {validationErrors.notification_email_3 && (
                <p className="text-sm text-destructive">{validationErrors.notification_email_3}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-rok-placanja">Rok plaćanja (dana)</Label>
                <Input
                  id="edit-rok-placanja"
                  type="number"
                  min="0"
                  max="120"
                  value={editingClient?.rok_placanja_dana || 0}
                  onChange={(e) => setEditingClient({ ...editingClient, rok_placanja_dana: parseInt(e.target.value) || 0 })}
                  className={validationErrors.rok_placanja_dana ? "border-destructive" : ""}
                />
                {validationErrors.rok_placanja_dana && (
                  <p className="text-sm text-destructive">{validationErrors.rok_placanja_dana}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-rabat">Rabat (%)</Label>
                <Input
                  id="edit-rabat"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={editingClient?.rabat_procenat || 0}
                  onChange={(e) => setEditingClient({ ...editingClient, rabat_procenat: parseFloat(e.target.value) || 0 })}
                  className={validationErrors.rabat_procenat ? "border-destructive" : ""}
                />
                {validationErrors.rabat_procenat && (
                  <p className="text-sm text-destructive">{validationErrors.rabat_procenat}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-napomena">Napomena</Label>
              <Input
                id="edit-napomena"
                value={editingClient?.napomena || ""}
                onChange={(e) => setEditingClient({ ...editingClient, napomena: e.target.value })}
                placeholder="Dodatne napomene..."
              />
            </div>

            {/* Status fields in edit form */}
            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium text-sm">Status i segment</h4>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-is_vip"
                  checked={editingClient?.is_vip || false}
                  onCheckedChange={(checked) => setEditingClient({ ...editingClient!, is_vip: checked })}
                />
                <Label htmlFor="edit-is_vip" className="cursor-pointer">VIP klijent</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-is_blocked"
                  checked={editingClient?.is_blocked || false}
                  onCheckedChange={(checked) => setEditingClient({ ...editingClient!, is_blocked: checked })}
                />
                <Label htmlFor="edit-is_blocked" className="cursor-pointer">Blokiran</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-segment">Segment</Label>
                <Select
                  value={editingClient?.segment || "novi"}
                  onValueChange={(value: "novi" | "redovan" | "premium") =>
                    setEditingClient({ ...editingClient!, segment: value })
                  }
                >
                  <SelectTrigger id="edit-segment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="novi">Novi</SelectItem>
                    <SelectItem value="redovan">Redovan</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* CRM fields */}
            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium text-sm">CRM</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-last-activity">Poslednja aktivnost</Label>
                  <Input
                    id="edit-last-activity"
                    type="date"
                    value={editingClient?.last_activity_at?.split('T')[0] || ""}
                    onChange={(e) => setEditingClient({ 
                      ...editingClient!, 
                      last_activity_at: e.target.value ? new Date(e.target.value).toISOString() : null 
                    })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-last-contacted">Poslednji kontakt</Label>
                  <Input
                    id="edit-last-contacted"
                    type="date"
                    value={editingClient?.last_contacted_at?.split('T')[0] || ""}
                    onChange={(e) => setEditingClient({ 
                      ...editingClient!, 
                      last_contacted_at: e.target.value ? new Date(e.target.value).toISOString() : null 
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-next-followup">Sledeći follow-up</Label>
                <Input
                  id="edit-next-followup"
                  type="date"
                  value={editingClient?.next_follow_up_at?.split('T')[0] || ""}
                  onChange={(e) => setEditingClient({ 
                    ...editingClient!, 
                    next_follow_up_at: e.target.value ? new Date(e.target.value).toISOString() : null 
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-owner-id">Vlasnik (User ID)</Label>
                <Input
                  id="edit-owner-id"
                  value={editingClient?.owner_user_id || ""}
                  onChange={(e) => setEditingClient({ 
                    ...editingClient!, 
                    owner_user_id: e.target.value || null 
                  })}
                  placeholder="UUID korisnika"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingClient(null)}>
              Otkaži
            </Button>
            <Button onClick={handleEditClient}>Sačuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;