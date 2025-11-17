import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { LocalFilmJobsTable, LocalFilmJob } from "@/components/film/LocalFilmJobsTable";
import { FilmJobsSummary } from "@/components/film/FilmJobsSummary";
import { LocalDigitalJobsTable, LocalDigitalJob } from "@/components/digital/LocalDigitalJobsTable";

import { useFilmSettings } from "@/hooks/useFilmSettings";
import { computeFilmJobClient } from "@/lib/filmCalculations";

const NewWorkOrder = () => {
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState<any[]>([]);
  const [plateFormats, setPlateFormats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderType, setOrderType] = useState<"ctp" | "digital" | "other" | "film">("ctp");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    client_id: searchParams.get("clientId") || "",
    notification_email: "",
    notes: "",
    // CTP fields
    trial_print: false,
    trial_sheets: 0,
    // Digital fields
    job_name: "",
    run_quantity: 0,
    pages: 0,
    print_format: "",
    binding: "",
    print_spec: "",
    paper_gsm_text: 0,
    paper_gsm_cover: 0,
    lamination: "",
    sheets_used: 0,
    clicks_count: 0,
    test_clicks: 0,
  });

  const [ctpItems, setCtpItems] = useState<Array<{ file_name: string; plate_format_id: string; quantity: number }>>([]);
  const [filmJobs, setFilmJobs] = useState<LocalFilmJob[]>([]);
  const [digitalJobs, setDigitalJobs] = useState<LocalDigitalJob[]>([]);
  
  const { data: filmSettings } = useFilmSettings();
  const [bulkFormat, setBulkFormat] = useState("");
  const [bulkQuantity, setBulkQuantity] = useState(4);

  useEffect(() => {
    checkAuth();
    fetchClients();
    fetchPlateFormats();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
    }
  };

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("*").order("name");
    setClients(data || []);
  };

  const fetchPlateFormats = async () => {
    const { data } = await supabase.from("plate_formats").select("*").order("format_name");
    setPlateFormats(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate client selection
    if (!formData.client_id) {
      toast({
        title: "Greška",
        description: "Molimo odaberite klijenta pre kreiranja naloga.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niste prijavljeni");

      // Map order type to type enum
      const typeMap: Record<string, 'CTP' | 'DIGITAL' | 'FILM' | 'OSTALO'> = {
        'ctp': 'CTP',
        'digital': 'DIGITAL',
        'film': 'FILM',
        'other': 'OSTALO',
      };

      // Prepare work order data for edge function
      const workOrderInput: any = {
        client_id: formData.client_id,
        type: typeMap[orderType] || 'CTP',
        order_type: orderType,
        kind: typeMap[orderType] || 'CTP',
        notes: formData.notes,
        job_name: formData.job_name,
        print_format: formData.print_format,
        binding: formData.binding,
        print_spec: formData.print_spec,
        lamination: formData.lamination,
        film_note: formData.notes,
      };

      // Call edge function to create work order with proper serial number
      const { data: response, error: orderError } = await supabase.functions.invoke(
        'create-work-order',
        {
          body: workOrderInput,
        }
      );

      if (orderError) throw orderError;
      if (!response?.success) throw new Error(response?.error || 'Failed to create work order');
      
      const workOrder = response.data;

      // Insert file entries
      if (ctpItems.length > 0) {
        const fileEntries = ctpItems.map(item => ({
          work_order_id: workOrder.id,
          filename: item.file_name,
          file_type: orderType === "ctp" ? "CTP" : orderType === "digital" ? "Digital" : "Other",
          plate_format_id: item.plate_format_id || null,
          quantity: item.quantity || null,
        }));

        const { data: insertedFiles, error: filesError } = await supabase
          .from("file_entries")
          .insert(fileEntries)
          .select();

        if (filesError) throw filesError;

        // Get default template for this order type
        const { data: template } = await supabase
          .from("checklist_templates")
          .select("id, checklist_template_items(*)")
          .eq("order_type", orderType)
          .eq("is_default", true)
          .single();

        if (template) {
          // Create checklist for this work order
          const { data: checklist, error: checklistError } = await supabase
            .from("work_order_checklists")
            .insert({
              work_order_id: workOrder.id,
              template_id: template.id,
            })
            .select()
            .single();

          if (checklistError) throw checklistError;

          // Create checklist items
          const checklistItems = [];
          for (const templateItem of template.checklist_template_items) {
            if (templateItem.is_per_file) {
              // Create one item per file
              for (const file of insertedFiles || []) {
                checklistItems.push({
                  checklist_id: checklist.id,
                  file_entry_id: file.id,
                  title: templateItem.title,
                  is_required: templateItem.is_required,
                  due_at: templateItem.sla_hours 
                    ? new Date(Date.now() + templateItem.sla_hours * 60 * 60 * 1000).toISOString()
                    : null,
                });
              }
            } else {
              // Create one item for the whole order
              checklistItems.push({
                checklist_id: checklist.id,
                file_entry_id: null,
                title: templateItem.title,
                is_required: templateItem.is_required,
                due_at: templateItem.sla_hours 
                  ? new Date(Date.now() + templateItem.sla_hours * 60 * 60 * 1000).toISOString()
                  : null,
              });
            }
          }

          if (checklistItems.length > 0) {
            const { error: itemsError } = await supabase
              .from("work_order_checklist_items")
              .insert(checklistItems);

            if (itemsError) throw itemsError;
          }
        }
      }

      // Insert CTP items (legacy compatibility)
      if (orderType === "ctp" && ctpItems.length > 0) {
        const items = ctpItems
          .filter(item => item.file_name && item.plate_format_id)
          .map(item => ({
            work_order_id: workOrder.id,
            file_name: item.file_name,
            plate_format_id: item.plate_format_id,
            quantity: item.quantity,
          }));

        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from("work_order_items")
            .insert(items);

          if (itemsError) throw itemsError;
        }
      }

      // Insert film jobs
      if (orderType === "film" && filmJobs.length > 0) {
        const jobs = filmJobs.map(job => ({
          work_order_id: workOrder.id,
          ...job,
        }));

        const { error: jobsError } = await supabase
          .from("film_jobs")
          .insert(jobs);

        if (jobsError) throw jobsError;
      }

      toast({
        title: "Uspeh",
        description: `Radni nalog ${workOrder.order_number} je kreiran`,
      });

      navigate("/work-orders");
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeCtpItem = (index: number) => {
    setCtpItems(ctpItems.filter((_, i) => i !== index));
  };

  const updateCtpItem = (index: number, field: string, value: any) => {
    const updated = [...ctpItems];
    updated[index] = { ...updated[index], [field]: value };
    setCtpItems(updated);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/work-orders")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Novi radni nalog</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate("/clients")}>
              Klijenti
            </Button>
            <Button variant="outline" onClick={() => navigate("/inventory")}>
              Inventory
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Osnovni podaci</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="client">Klijent *</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => {
                    const selectedClient = clients.find(c => c.id === value);
                    setFormData({ 
                      ...formData, 
                      client_id: value,
                      notification_email: selectedClient?.notification_email || ""
                    });
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite klijenta" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                        {client.pib && ` — ${client.pib}`}
                        {client.grad && ` — ${client.grad}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.notification_email && (
                <div className="space-y-2">
                  <Label htmlFor="notification_email">Email primaoca otpremnice</Label>
                  <Input
                    id="notification_email"
                    type="email"
                    value={formData.notification_email}
                    onChange={(e) => setFormData({ ...formData, notification_email: e.target.value })}
                  />
                </div>
              )}

              <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="ctp">CTP</TabsTrigger>
                  <TabsTrigger value="digital">Digital</TabsTrigger>
                  <TabsTrigger value="film">Film</TabsTrigger>
                  <TabsTrigger value="other">Ostalo</TabsTrigger>
                </TabsList>

                <TabsContent value="ctp" className="space-y-4 mt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="trial_print"
                      checked={formData.trial_print}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, trial_print: checked as boolean })
                      }
                    />
                    <Label htmlFor="trial_print">Probna štampa</Label>
                  </div>

                  {formData.trial_print && (
                    <div className="space-y-2">
                      <Label htmlFor="trial_sheets">Broj probnih tabaka</Label>
                      <Input
                        id="trial_sheets"
                        type="number"
                        value={formData.trial_sheets}
                        onChange={(e) => setFormData({ ...formData, trial_sheets: parseInt(e.target.value) })}
                      />
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Fajlovi</Label>
                      <Input
                        type="file"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const newItems = files.map(file => ({
                            file_name: file.name,
                            plate_format_id: "",
                            quantity: 4
                          }));
                          setCtpItems([...ctpItems, ...newItems]);
                        }}
                        className="hidden"
                        id="file-upload-ctp"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => document.getElementById('file-upload-ctp')?.click()}
                      >
                        Dodaj fajlove
                      </Button>
                    </div>

                    {ctpItems.length > 0 && (
                      <div className="space-y-4">
                        <div className="p-4 border rounded-lg bg-muted/50">
                          <Label className="text-sm font-semibold mb-3 block">Masovno dodeljivanje</Label>
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-5">
                              <Select
                                value={bulkFormat}
                                onValueChange={setBulkFormat}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Odaberi format" />
                                </SelectTrigger>
                                <SelectContent>
                                  {plateFormats.map((format) => (
                                    <SelectItem key={format.id} value={format.id}>
                                      {format.format_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-3">
                              <Input
                                type="number"
                                placeholder="Količina"
                                value={bulkQuantity}
                                onChange={(e) => setBulkQuantity(parseInt(e.target.value) || 4)}
                                min="1"
                              />
                            </div>
                            <div className="col-span-4">
                              <Button
                                type="button"
                                variant="secondary"
                                className="w-full"
                                onClick={() => {
                                  if (bulkFormat) {
                                    setCtpItems(ctpItems.map(item => ({
                                      ...item,
                                      plate_format_id: bulkFormat,
                                      quantity: bulkQuantity
                                    })));
                                    toast({
                                      title: "Uspeh",
                                      description: "Format i količina dodeljeni svim fajlovima",
                                    });
                                  }
                                }}
                              >
                                Primeni na sve
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {ctpItems.map((item, index) => (
                          <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 border rounded">
                            <div className="col-span-5">
                              <p className="text-sm truncate" title={item.file_name}>
                                {item.file_name || "Naziv fajla"}
                              </p>
                            </div>
                            <div className="col-span-4">
                              <Select
                                value={item.plate_format_id}
                                onValueChange={(value) => updateCtpItem(index, "plate_format_id", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Format" />
                                </SelectTrigger>
                                <SelectContent>
                                  {plateFormats.map((format) => (
                                    <SelectItem key={format.id} value={format.id}>
                                      {format.format_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                placeholder="Količina"
                                value={item.quantity}
                                onChange={(e) => updateCtpItem(index, "quantity", parseInt(e.target.value))}
                                min="1"
                              />
                            </div>
                            <div className="col-span-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeCtpItem(index)}
                              >
                                ✕
                              </Button>
                            </div>
                          </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="digital" className="space-y-4 mt-4">
                  <div className="space-y-6">
                    {/* Job Header */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
                      <div className="space-y-2">
                        <Label htmlFor="job_name">Naziv posla</Label>
                        <Input
                          id="job_name"
                          value={formData.job_name}
                          onChange={(e) => setFormData({ ...formData, job_name: e.target.value })}
                          placeholder="Naziv posla"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="binding">Povez</Label>
                        <Select
                          value={formData.binding}
                          onValueChange={(value) => setFormData({ ...formData, binding: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Odaberi povez" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bez_poveza">Bez poveza</SelectItem>
                            <SelectItem value="binder">Binder</SelectItem>
                            <SelectItem value="klamovanje">Klamovanje</SelectItem>
                            <SelectItem value="spirala">Spirala</SelectItem>
                            <SelectItem value="perfect">Perfect</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="print_spec">Štampa</Label>
                        <Select
                          value={formData.print_spec}
                          onValueChange={(value) => setFormData({ ...formData, print_spec: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Odaberi tip" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4/4">4/4</SelectItem>
                            <SelectItem value="4/1">4/1</SelectItem>
                            <SelectItem value="4/0">4/0</SelectItem>
                            <SelectItem value="1/1">1/1</SelectItem>
                            <SelectItem value="1/0">1/0</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="paper_gsm_text">Papir (gsm)</Label>
                        <Input
                          id="paper_gsm_text"
                          type="number"
                          value={formData.paper_gsm_text || ''}
                          onChange={(e) => setFormData({ ...formData, paper_gsm_text: parseInt(e.target.value) || 0 })}
                          placeholder="80"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="paper_gsm_cover">Korice (gsm)</Label>
                        <Input
                          id="paper_gsm_cover"
                          type="number"
                          value={formData.paper_gsm_cover || ''}
                          onChange={(e) => setFormData({ ...formData, paper_gsm_cover: parseInt(e.target.value) || 0 })}
                          placeholder="350"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lamination">Plastifikacija</Label>
                        <div className="flex gap-2">
                          <Select
                            value={formData.lamination}
                            onValueChange={(value) => setFormData({ ...formData, lamination: value })}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Tip" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Bez</SelectItem>
                              <SelectItem value="1/0">1/0</SelectItem>
                              <SelectItem value="1/1">1/1</SelectItem>
                            </SelectContent>
                          </Select>
                          {formData.lamination !== 'none' && formData.lamination && (
                            <Select
                              value={formData.print_format || ''}
                              onValueChange={(value) => setFormData({ ...formData, print_format: value })}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue placeholder="Finish" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mat">Mat</SelectItem>
                                <SelectItem value="sjaj">Sjaj</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor="notes_digital">Napomena</Label>
                        <Textarea
                          id="notes_digital"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Dodatne napomene..."
                          rows={2}
                        />
                      </div>
                    </div>

                    {/* Digital Jobs Table */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Stavke digitale</h3>
                      <LocalDigitalJobsTable
                        jobs={digitalJobs}
                        onChange={setDigitalJobs}
                        printSides={formData.print_spec || "4/4"}
                        clientRabatProcenat={clients.find(c => c.id === formData.client_id)?.rabat_procenat || 0}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="other" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Fajlovi</Label>
                      <Input
                        type="file"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const newItems = files.map(file => ({
                            file_name: file.name,
                            plate_format_id: "",
                            quantity: 1
                          }));
                          setCtpItems([...ctpItems, ...newItems]);
                        }}
                        className="hidden"
                        id="file-upload-other"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => document.getElementById('file-upload-other')?.click()}
                      >
                        Dodaj fajlove
                      </Button>
                    </div>

                    {ctpItems.length > 0 && (
                      <div className="space-y-2">
                        {ctpItems.map((item, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 border rounded">
                            <p className="text-sm flex-1 truncate" title={item.file_name}>
                              {item.file_name || "Naziv fajla"}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCtpItem(index)}
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Dodajte napomene za ostale usluge.
                  </p>
                </TabsContent>

                <TabsContent value="film" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    {filmSettings && filmJobs.length > 0 && (
                      <FilmJobsSummary
                        totalMeters={filmJobs.reduce((sum, job) => {
                          const result = computeFilmJobClient(job, filmSettings);
                          return sum + (('error' in result) ? 0 : result.computed_total_m);
                        }, 0)}
                        clientDiscount={
                          clients.find(c => c.id === formData.client_id)?.rabat_procenat || 0
                        }
                      />
                    )}

                    <LocalFilmJobsTable jobs={filmJobs} onChange={setFilmJobs} />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label htmlFor="notes">Napomene</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="Dodatne informacije..."
                />
              </div>

              <div className="flex gap-4 justify-end">
                <Button type="button" variant="outline" onClick={() => navigate("/work-orders")}>
                  Otkaži
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Kreiranje..." : "Kreiraj nalog"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
};

export default NewWorkOrder;