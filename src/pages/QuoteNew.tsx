import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronsUpDown, Building2, UserPlus, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCreateQuote } from "@/hooks/useQuotesPro";
import { useClients } from "@/hooks/useClients";
import { QuickAddClientDialog } from "@/components/clients/QuickAddClientDialog";

export default function QuoteNew() {
  const navigate = useNavigate();
  const createQuote = useCreateQuote();
  const { data: clients } = useClients();
  const queryClient = useQueryClient();

  const [clientOpen, setClientOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_id: "",
    job_name: "",
    payment_terms: "",
    delivery_days: "",
    notes: "",
    internal_notes: "",
    valid_days: "14",
    default_markup_percent: "300",
  });

  const selectedClient = clients?.find((c) => c.id === formData.client_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id) {
      toast.error("Izaberite klijenta");
      return;
    }
    try {
      const result: any = await createQuote.mutateAsync({
        client_id: formData.client_id,
        job_name: formData.job_name.trim() || undefined,
        payment_terms: formData.payment_terms || undefined,
        delivery_days: formData.delivery_days ? Number(formData.delivery_days) : undefined,
        notes: formData.notes || undefined,
        internal_notes: formData.internal_notes || undefined,
        valid_days: Number(formData.valid_days) || 14,
        default_markup_percent: Number(formData.default_markup_percent) || 300,
      });
      navigate(`/quotes/${result.id}`);
    } catch {
      /* handled in hook */
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Nova ponuda" />
      <div className="container mx-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Nova ponuda</h1>
              <p className="text-muted-foreground">Kreirajte novu ponudu za klijenta</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Izbor klijenta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Klijent *</Label>
                  <div className="flex gap-2">
                    <Popover open={clientOpen} onOpenChange={setClientOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={clientOpen}
                          className="flex-1 justify-between"
                        >
                          {selectedClient ? selectedClient.name : "Izaberite klijenta..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Pretraži klijente..." />
                          <CommandList>
                            <CommandEmpty>Nema rezultata.</CommandEmpty>
                            <CommandGroup>
                              {clients?.map((client) => (
                                <CommandItem
                                  key={client.id}
                                  value={client.name}
                                  onSelect={() => {
                                    setFormData((prev) => ({ ...prev, client_id: client.id }));
                                    setClientOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.client_id === client.id ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span>{client.name}</span>
                                      {client.is_vip && (
                                        <Badge className="text-[10px] py-0">VIP</Badge>
                                      )}
                                    </div>
                                    {client.pib && (
                                      <div className="text-xs text-muted-foreground">
                                        PIB: {client.pib}
                                      </div>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setQuickAddOpen(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Brzo dodaj
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ako klijent još nije u bazi, brzo ga dodaj — kasnije dopuni podatke u Klijentima.
                  </p>
                </div>

                {selectedClient && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <span>{selectedClient.name}</span>
                        {selectedClient.is_vip && (
                          <Badge className="gap-1">
                            <Sparkles className="h-3 w-3" />
                            VIP
                          </Badge>
                        )}
                      </div>
                      {selectedClient.pib && (
                        <div className="text-muted-foreground">PIB: {selectedClient.pib}</div>
                      )}
                      {selectedClient.adresa && (
                        <div className="text-muted-foreground">
                          {selectedClient.adresa}
                          {selectedClient.grad && `, ${selectedClient.grad}`}
                        </div>
                      )}
                      {selectedClient.email && (
                        <div className="text-muted-foreground">{selectedClient.email}</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <Label htmlFor="job_name">Naziv posla</Label>
                  <Input
                    id="job_name"
                    value={formData.job_name}
                    onChange={(e) => setFormData((p) => ({ ...p, job_name: e.target.value }))}
                    placeholder="npr. Reklamne table — fasada 2026, Katalog proleće..."
                    maxLength={120}
                  />
                  <p className="text-xs text-muted-foreground">
                    Kratak opis posla za lakše prepoznavanje ponude u listi (opciono).
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Uslovi ponude</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="valid_days">Rok važenja (dana)</Label>
                    <Input
                      id="valid_days"
                      type="number"
                      min={1}
                      value={formData.valid_days}
                      onChange={(e) => setFormData((p) => ({ ...p, valid_days: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery_days">Rok isporuke (dana)</Label>
                    <Input
                      id="delivery_days"
                      type="number"
                      min={0}
                      value={formData.delivery_days}
                      onChange={(e) => setFormData((p) => ({ ...p, delivery_days: e.target.value }))}
                      placeholder="Opciono"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="markup">Podrazumevana marža (%)</Label>
                    <Input
                      id="markup"
                      type="number"
                      min={0}
                      value={formData.default_markup_percent}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, default_markup_percent: e.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Izlazna cena = (nabavna × površina + dorada) × (1 + marža/100). Možeš menjati po stavci.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Uslovi plaćanja</Label>
                  <Textarea
                    id="payment_terms"
                    value={formData.payment_terms}
                    onChange={(e) => setFormData((p) => ({ ...p, payment_terms: e.target.value }))}
                    placeholder="npr. Avansno plaćanje, Virman 15 dana..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Napomena za klijenta</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Napomena koja će biti prikazana na ponudi..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="internal_notes">Interna napomena</Label>
                  <Textarea
                    id="internal_notes"
                    value={formData.internal_notes}
                    onChange={(e) => setFormData((p) => ({ ...p, internal_notes: e.target.value }))}
                    placeholder="Interna napomena (nije vidljiva klijentu)..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/quotes")}
                className="flex-1"
              >
                Odustani
              </Button>
              <Button
                type="submit"
                disabled={!formData.client_id || createQuote.isPending}
                className="flex-1"
              >
                {createQuote.isPending ? "Kreiranje..." : "Kreiraj ponudu"}
              </Button>
            </div>
          </form>

          <QuickAddClientDialog
            open={quickAddOpen}
            onOpenChange={setQuickAddOpen}
            onCreated={async (newId) => {
              await queryClient.invalidateQueries({ queryKey: ["clients"] });
              setFormData((prev) => ({ ...prev, client_id: newId }));
            }}
          />
        </div>
      </div>
    </div>
  );
}
