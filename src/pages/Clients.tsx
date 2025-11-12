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
  const [newClient, setNewClient] = useState({
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
    rok_placanja_dana: 0,
    rabat_procenat: 0,
    napomena: "",
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
    if (client.pib && !/^\d{9}$/.test(client.pib.trim())) {
      errors.pib = "PIB mora sadržati tačno 9 cifara";
    }

    // Email validation (if provided)
    if (client.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email.trim())) {
      errors.email = "Neispravan email format";
    }

    // Notification email validation (if provided)
    if (client.notification_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.notification_email.trim())) {
      errors.notification_email = "Neispravan email format";
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
      const clientData = {
        ...newClient,
        pib: newClient.pib.trim() || null,
        maticni_broj: newClient.maticni_broj.trim() || null,
        adresa: newClient.adresa.trim() || null,
        grad: newClient.grad.trim() || null,
        postanski_broj: newClient.postanski_broj.trim() || null,
        kontakt_osoba: newClient.kontakt_osoba.trim() || null,
        telefon: newClient.telefon.trim() || null,
        email: newClient.email.trim() || null,
        notification_email: newClient.notification_email.trim() || null,
        napomena: newClient.napomena.trim() || null,
      };

      const { error } = await supabase
        .from("clients")
        .insert([clientData]);

      if (error) throw error;

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
        rok_placanja_dana: 0,
        rabat_procenat: 0,
        napomena: "",
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
      const clientData = {
        name: editingClient.name,
        pib: editingClient.pib?.trim() || null,
        maticni_broj: editingClient.maticni_broj?.trim() || null,
        adresa: editingClient.adresa?.trim() || null,
        grad: editingClient.grad?.trim() || null,
        postanski_broj: editingClient.postanski_broj?.trim() || null,
        drzava: editingClient.drzava || "Srbija",
        kontakt_osoba: editingClient.kontakt_osoba?.trim() || null,
        telefon: editingClient.telefon?.trim() || null,
        email: editingClient.email?.trim() || null,
        notification_email: editingClient.notification_email?.trim() || null,
        rok_placanja_dana: editingClient.rok_placanja_dana || 0,
        rabat_procenat: editingClient.rabat_procenat || 0,
        napomena: editingClient.napomena?.trim() || null,
      };

      const { error } = await supabase
        .from("clients")
        .update(clientData)
        .eq("id", editingClient.id);

      if (error) throw error;

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
                    onChange={(e) => setNewClient({ ...newClient, pib: e.target.value })}
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
                  <Label htmlFor="notification_email">Email za obaveštenja</Label>
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
                onChange={(e) => setEditingClient({ ...editingClient, pib: e.target.value })}
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
              <Label htmlFor="edit-notification-email">Email za obaveštenja</Label>
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