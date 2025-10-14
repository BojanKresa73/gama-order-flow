import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const NewWorkOrder = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [plateFormats, setPlateFormats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderType, setOrderType] = useState<"ctp" | "digital" | "other">("ctp");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    client_id: "",
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

      // Generate order number
      const { data: orderNumberData } = await supabase.rpc("generate_order_number");
      
      const workOrderData: any = {
        order_number: orderNumberData,
        client_id: formData.client_id,
        order_type: orderType,
        created_by: user.id,
        notes: formData.notes,
      };

      if (orderType === "ctp") {
        workOrderData.trial_print = formData.trial_print;
        workOrderData.trial_sheets = formData.trial_sheets;
      } else if (orderType === "digital") {
        workOrderData.job_name = formData.job_name;
        workOrderData.run_quantity = formData.run_quantity;
        workOrderData.pages = formData.pages;
        workOrderData.print_format = formData.print_format;
        workOrderData.binding = formData.binding;
        workOrderData.print_spec = formData.print_spec;
        workOrderData.paper_gsm_text = formData.paper_gsm_text;
        workOrderData.paper_gsm_cover = formData.paper_gsm_cover;
        workOrderData.lamination = formData.lamination;
        workOrderData.sheets_used = formData.sheets_used;
        workOrderData.clicks_count = formData.clicks_count;
        workOrderData.test_clicks = formData.test_clicks;
      }

      const { data: workOrder, error: orderError } = await supabase
        .from("work_orders")
        .insert([workOrderData])
        .select()
        .single();

      if (orderError) throw orderError;

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
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/work-orders")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Novi radni nalog</h1>
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
                  onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite klijenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="ctp">CTP</TabsTrigger>
                  <TabsTrigger value="digital">Digital</TabsTrigger>
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
                        id="file-upload-digital"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => document.getElementById('file-upload-digital')?.click()}
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="job_name">Naziv posla</Label>
                      <Input
                        id="job_name"
                        value={formData.job_name}
                        onChange={(e) => setFormData({ ...formData, job_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="run_quantity">Tiraž</Label>
                      <Input
                        id="run_quantity"
                        type="number"
                        value={formData.run_quantity}
                        onChange={(e) => setFormData({ ...formData, run_quantity: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pages">Strane</Label>
                      <Input
                        id="pages"
                        type="number"
                        value={formData.pages}
                        onChange={(e) => setFormData({ ...formData, pages: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="print_format">Format</Label>
                      <Input
                        id="print_format"
                        value={formData.print_format}
                        onChange={(e) => setFormData({ ...formData, print_format: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="binding">Povez</Label>
                      <Input
                        id="binding"
                        value={formData.binding}
                        onChange={(e) => setFormData({ ...formData, binding: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="print_spec">Specifikacija</Label>
                      <Input
                        id="print_spec"
                        value={formData.print_spec}
                        onChange={(e) => setFormData({ ...formData, print_spec: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paper_gsm_text">Papir tekst (gsm)</Label>
                      <Input
                        id="paper_gsm_text"
                        type="number"
                        value={formData.paper_gsm_text}
                        onChange={(e) => setFormData({ ...formData, paper_gsm_text: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paper_gsm_cover">Papir korice (gsm)</Label>
                      <Input
                        id="paper_gsm_cover"
                        type="number"
                        value={formData.paper_gsm_cover}
                        onChange={(e) => setFormData({ ...formData, paper_gsm_cover: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lamination">Laminacija</Label>
                      <Input
                        id="lamination"
                        value={formData.lamination}
                        onChange={(e) => setFormData({ ...formData, lamination: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sheets_used">Utrošeni tabaci</Label>
                      <Input
                        id="sheets_used"
                        type="number"
                        value={formData.sheets_used}
                        onChange={(e) => setFormData({ ...formData, sheets_used: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clicks_count">Broj klikova</Label>
                      <Input
                        id="clicks_count"
                        type="number"
                        value={formData.clicks_count}
                        onChange={(e) => setFormData({ ...formData, clicks_count: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="test_clicks">Test klikovi</Label>
                      <Input
                        id="test_clicks"
                        type="number"
                        value={formData.test_clicks}
                        onChange={(e) => setFormData({ ...formData, test_clicks: parseInt(e.target.value) })}
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