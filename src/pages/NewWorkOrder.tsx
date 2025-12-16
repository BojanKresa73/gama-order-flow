import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileUp } from "lucide-react";
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
import { AddCtpFilesModal } from "@/components/work-orders/AddCtpFilesModal";

const NewWorkOrder = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState<any[]>([]);
  const [plateFormats, setPlateFormats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(isEditMode);
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
    paper_text: "",
    paper_cover: "",
    lamination: "",
    sheets_used: 0,
    clicks_count: 0,
    test_clicks: 0,
    finishing: [] as string[],
  });

  // Use stable IDs for items
  const [ctpItems, setCtpItems] = useState<Array<{ 
    id?: string; 
    tempId?: string; 
    file_name: string; 
    plate_format_id: string; 
    quantity: number;
    __status?: 'unchanged' | 'created' | 'updated' | 'deleted';
  }>>([]);
  
  const [filmJobs, setFilmJobs] = useState<Array<LocalFilmJob & { 
    tempId?: string;
    __status?: 'unchanged' | 'created' | 'updated' | 'deleted';
  }>>([]);
  
  const [digitalJobs, setDigitalJobs] = useState<Array<LocalDigitalJob & {
    id?: string;
    tempId?: string;
    __status?: 'unchanged' | 'created' | 'updated' | 'deleted';
  }>>([]);
  
  const { data: filmSettings } = useFilmSettings();
  const [bulkFormat, setBulkFormat] = useState("");
  const [bulkQuantity, setBulkQuantity] = useState(4);
  const [showCtpFilesModal, setShowCtpFilesModal] = useState(false);
  const [showOtherFilesModal, setShowOtherFilesModal] = useState(false);

  // Handler for digital jobs changes in edit mode - preserves diff tracking
  const handleDigitalJobsChange = (newJobs: LocalDigitalJob[]) => {
    if (!isEditMode) {
      // In create mode, just set directly
      setDigitalJobs(newJobs as typeof digitalJobs);
      return;
    }

    // In edit mode, track deletions properly
    const existingIds = new Set(newJobs.filter(j => (j as any).id).map(j => (j as any).id));
    
    // Find items that were deleted (exist in old array but not in new)
    const deletedItems = digitalJobs.filter(j => j.id && !existingIds.has(j.id))
      .map(j => ({ ...j, __status: 'deleted' as const }));
    
    // Mark updated items
    const updatedJobs = newJobs.map(job => {
      const jobWithTracking = job as typeof digitalJobs[0];
      if (jobWithTracking.id && jobWithTracking.__status !== 'deleted') {
        // Existing item from DB - mark as updated
        return { ...jobWithTracking, __status: 'updated' as const };
      } else if (!jobWithTracking.id && !jobWithTracking.tempId) {
        // New item - assign tempId
        return { ...jobWithTracking, tempId: `temp-${Date.now()}-${Math.random()}`, __status: 'created' as const };
      }
      return jobWithTracking;
    });

    // Combine: keep deleted items (marked) + updated/new items
    setDigitalJobs([...updatedJobs, ...deletedItems] as typeof digitalJobs);
  };

  useEffect(() => {
    checkAuth();
    fetchClients();
    fetchPlateFormats();
    if (isEditMode && id) {
      loadExistingOrder(id);
    }
  }, [id, isEditMode]);

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

  const loadExistingOrder = async (orderId: string) => {
    try {
      setLoadingOrder(true);
      
      // Fetch work order
      const { data: order, error: orderError } = await supabase
        .from("work_orders")
        .select("*, clients(notification_email)")
        .eq("id", orderId)
        .is("deleted_at", null)
        .single();

      if (orderError) throw orderError;
      if (!order) throw new Error("Nalog nije pronađen");
      
      // Check if order is open
      if (order.status !== "open") {
        toast({
          title: "Greška",
          description: "Možete izmeniti samo otvorene naloge",
          variant: "destructive",
        });
        navigate(`/work-orders/${orderId}`);
        return;
      }

      // Set form data
      // Parse finishing options from print_format if it contains JSON array
      let finishingOptions: string[] = [];
      let printFormatValue = order.print_format || "";
      try {
        if (order.print_format?.startsWith('[')) {
          finishingOptions = JSON.parse(order.print_format);
          printFormatValue = "";
        }
      } catch {
        // print_format is plain text, not JSON
      }
      
      setFormData({
        client_id: order.client_id,
        notification_email: order.clients?.notification_email || "",
        notes: order.notes || "",
        trial_print: order.trial_print || false,
        trial_sheets: order.trial_sheets || 0,
        job_name: order.job_name || "",
        run_quantity: order.run_quantity || 0,
        pages: order.pages || 0,
        print_format: printFormatValue,
        binding: order.binding || "",
        print_spec: order.print_spec || "",
        paper_text: order.paper_gsm_text?.toString() || "",
        paper_cover: order.paper_gsm_cover?.toString() || "",
        lamination: order.lamination || "",
        sheets_used: order.sheets_used || 0,
        clicks_count: order.clicks_count || 0,
        test_clicks: order.test_clicks || 0,
        finishing: finishingOptions,
      });

      // Set order type
      const typeMap: Record<string, "ctp" | "digital" | "other" | "film"> = {
        ctp: "ctp",
        digital: "digital",
        film: "film",
        other: "other",
      };
      setOrderType(typeMap[order.order_type] || "ctp");

      // Load items based on order type
      if (order.order_type === "ctp") {
        const { data: items } = await supabase
          .from("file_entries")
          .select("*")
          .eq("work_order_id", orderId)
          .order("created_at");
        
        if (items && items.length > 0) {
          setCtpItems(items.map(item => ({
            id: item.id,
            file_name: item.filename,
            plate_format_id: item.plate_format_id || "",
            quantity: item.quantity || 0,
            __status: 'unchanged' as const,
          })));
        }
      } else if (order.order_type === "film") {
        const { data: items } = await supabase
          .from("film_jobs")
          .select("*")
          .eq("work_order_id", orderId)
          .order("created_at");
        
        if (items && items.length > 0) {
          setFilmJobs(items.map(item => ({
            id: item.id,
            file_name: item.file_name,
            width_mm: item.width_mm,
            height_mm: item.height_mm,
            quantity: item.qty,
            allow_rotate_90: item.allow_rotate_90,
            margin_mm: item.margin_mm,
            note: item.note || "",
            __status: 'unchanged' as const,
          })));
        }
      } else if (order.order_type === "digital") {
        const { data: items } = await supabase
          .from("digital_jobs")
          .select("*")
          .eq("work_order_id", orderId)
          .order("order_index");
        
        if (items && items.length > 0) {
          setDigitalJobs(items.map(item => ({
            id: item.id,
            name: item.name || "",
            file_name: item.file_name,
            finished_w_mm: item.finished_w_mm,
            finished_h_mm: item.finished_h_mm,
            obim: item.obim || 1,
            qty: item.qty,
            pages: item.pages,
            print_sides: item.print_sides,
            paper_type: item.paper_type || "",
            machine_sheet_format: item.machine_sheet_format || "488x330",
            is_test_print: item.is_test_print,
            computed_nup: item.computed_nup || undefined,
            computed_sheets_per_copy: item.computed_sheets_per_copy || undefined,
            computed_total_sheets: item.computed_total_sheets || undefined,
            computed_color_clicks: item.computed_color_clicks || undefined,
            computed_mono_clicks: item.computed_mono_clicks || undefined,
            computed_price_per_sheet: item.computed_price_per_sheet || undefined,
            computed_line_total: item.computed_line_total || undefined,
            cover_sheets: item.cover_sheets || undefined,
            lamination_sheets: item.lamination_sheets || undefined,
            __status: 'unchanged' as const,
          })));
        }
      }
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
      navigate("/work-orders");
    } finally {
      setLoadingOrder(false);
    }
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

    // Validate job_name for OSTALO orders
    if (orderType === "other" && !formData.job_name?.trim()) {
      toast({
        title: "Greška",
        description: "Molimo unesite naziv posla za nalog tipa Ostalo.",
        variant: "destructive",
      });
      return;
    }

    // Validate plate format selection for CTP items
    if (orderType === "ctp") {
      const missing = ctpItems.filter((it) => !it.plate_format_id);
      if (missing.length > 0) {
        toast({
          title: "Greška",
          description: "Molimo odaberite format ploče za sve fajlove pre kreiranja naloga.",
          variant: "destructive",
        });
        return;
      }
    }
    
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niste prijavljeni");

      // If in edit mode, call update edge function
      if (isEditMode && id) {
        // Prepare diff payload for update
        const itemsDiff: any = {};
        
        if (orderType === "ctp") {
          itemsDiff.created = ctpItems.filter(it => !it.id && it.__status !== 'deleted');
          itemsDiff.updated = ctpItems.filter(it => it.id && it.__status === 'updated');
          itemsDiff.deleted = ctpItems.filter(it => it.id && it.__status === 'deleted').map(it => it.id);
        } else if (orderType === "film") {
          itemsDiff.created = filmJobs.filter(it => !it.id && it.__status !== 'deleted');
          itemsDiff.updated = filmJobs.filter(it => it.id && it.__status === 'updated');
          itemsDiff.deleted = filmJobs.filter(it => it.id && it.__status === 'deleted').map(it => it.id);
        } else if (orderType === "digital") {
          itemsDiff.created = digitalJobs.filter(it => !it.id && it.__status !== 'deleted');
          itemsDiff.updated = digitalJobs.filter(it => it.id && it.__status === 'updated');
          itemsDiff.deleted = digitalJobs.filter(it => it.id && it.__status === 'deleted').map(it => it.id);
        }

        const { data: updateResponse, error: updateError } = await supabase.functions.invoke(
          'update-work-order',
          {
            body: {
              workOrderId: id,
              kind: orderType.toUpperCase(),
              header: {
                client_id: formData.client_id,
                notes: formData.notes,
                job_name: formData.job_name,
                run_quantity: formData.run_quantity,
                print_format: formData.finishing.length > 0 ? JSON.stringify(formData.finishing) : formData.print_format,
                binding: formData.binding,
                print_spec: formData.print_spec,
                lamination: formData.lamination,
                trial_print: formData.trial_print,
                trial_sheets: formData.trial_sheets,
              },
              items: itemsDiff,
            },
          }
        );

        if (updateError) throw new Error(updateError.message);
        if (!updateResponse?.ok) throw new Error(updateResponse?.error || 'Greška pri ažuriranju naloga');

        toast({
          title: "Uspeh",
          description: "Radni nalog je ažuriran",
        });

        navigate(`/work-orders/${id}`);
        setLoading(false);
        return;
      }

      // Map order type to type enum (for create mode)
      const typeMap: Record<string, 'CTP' | 'DIGITAL' | 'FILM' | 'OSTALO'> = {
        'ctp': 'CTP',
        'digital': 'DIGITAL',
        'film': 'FILM',
        'other': 'OSTALO',
      };

      // Handle film orders separately with dedicated edge function
      if (orderType === "film" && filmJobs.length > 0) {
        const { data: filmResponse, error: filmError } = await supabase.functions.invoke(
          'open-film-work-order',
          {
            body: {
              client_id: formData.client_id,
              client_email: formData.notification_email,
              order_type: 'film',
              note: formData.notes,
              items: filmJobs.map(job => ({
                file_name: job.file_name,
                width_mm: job.width_mm,
                height_mm: job.height_mm,
                quantity: job.quantity,
                note: job.note,
              })),
            },
          }
        );

        if (filmError) throw new Error(filmError.message);
        if (!filmResponse?.ok) throw new Error(filmResponse?.error || 'Greška pri kreiranju film naloga');

        // Show warning if fallback was used
        if (filmResponse.warn) {
          console.warn('Film calculation fallback:', filmResponse.warn);
        }

        toast({
          title: "Uspeh",
          description: `Film nalog ${filmResponse.order_number} je kreiran`,
        });

        navigate("/work-orders");
        setLoading(false);
        return;
      }

      // For non-film orders, use standard create-work-order flow
      // Prepare work order data for edge function
      const workOrderInput: any = {
        client_id: formData.client_id,
        type: typeMap[orderType] || 'CTP',
        order_type: orderType,
        kind: typeMap[orderType] || 'CTP',
        notes: formData.notes,
        job_name: formData.job_name,
        run_quantity: formData.run_quantity,
        print_format: formData.finishing.length > 0 ? JSON.stringify(formData.finishing) : formData.print_format,
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

      // Insert digital jobs for digital work orders
      if (orderType === "digital" && digitalJobs.length > 0) {
        const digitalItems = digitalJobs
          .filter(job => job.file_name || job.name)
          .map((job, index) => ({
            work_order_id: workOrder.id,
            name: job.name || null,
            file_name: job.file_name || job.name || '',
            finished_w_mm: job.finished_w_mm || 0,
            finished_h_mm: job.finished_h_mm || 0,
            pages: job.pages || 1,
            obim: job.obim || 1,
            qty: job.qty || 1,
            is_test_print: job.is_test_print || false,
            print_sides: job.print_sides || '4/4',
            paper_type: job.paper_type || null,
            machine_sheet_format: job.machine_sheet_format || '488x330',
            test_sheets: job.test_sheets || 0,
            include_test_in_clicks: job.include_test_in_clicks || false,
            finishing: job.finishing || null,
            order_index: index,
            // Include computed values
            computed_nup: job.computed_nup || null,
            computed_sheets_per_copy: job.computed_sheets_per_copy || null,
            computed_total_sheets: job.computed_total_sheets || null,
            computed_color_clicks: job.computed_color_clicks || null,
            computed_mono_clicks: job.computed_mono_clicks || null,
            computed_price_per_sheet: job.computed_price_per_sheet || null,
            computed_line_total: job.computed_line_total || null,
          }));

        if (digitalItems.length > 0) {
          const { error: digitalError } = await supabase
            .from("digital_jobs")
            .insert(digitalItems);

          if (digitalError) throw digitalError;
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
    const item = updated[index];
    updated[index] = { 
      ...item, 
      [field]: value,
      // Mark as updated if it already has an id (existing item from DB)
      __status: item.id ? 'updated' as const : item.__status,
    };
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
            <h1 className="text-2xl font-bold">{isEditMode ? "Izmeni radni nalog" : "Novi radni nalog"}</h1>
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
        {loadingOrder ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Učitavanje naloga...</p>
            </CardContent>
          </Card>
        ) : (
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
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowCtpFilesModal(true)}
                      >
                        <FileUp className="h-4 w-4 mr-2" />
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
                            <SelectItem value="sivenje">Šivenje</SelectItem>
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
                        <Label htmlFor="run_quantity">Tiraž proizvoda</Label>
                        <Input
                          id="run_quantity"
                          type="number"
                          value={formData.run_quantity || ''}
                          onChange={(e) => setFormData({ ...formData, run_quantity: parseInt(e.target.value) || 0 })}
                          placeholder="Broj komada"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="paper_text">Papir</Label>
                        <Input
                          id="paper_text"
                          value={formData.paper_text}
                          onChange={(e) => setFormData({ ...formData, paper_text: e.target.value })}
                          placeholder="npr. Kunzdruk 135g"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="paper_cover">Korice</Label>
                        <Input
                          id="paper_cover"
                          value={formData.paper_cover}
                          onChange={(e) => setFormData({ ...formData, paper_cover: e.target.value })}
                          placeholder="npr. Kunzdruk 350g"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lamination">Plastifikacija</Label>
                        <Select
                          value={formData.lamination}
                          onValueChange={(value) => setFormData({ ...formData, lamination: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Odaberi tip" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Bez plastifikacije</SelectItem>
                            <SelectItem value="1/0_mat">1/0 Mat</SelectItem>
                            <SelectItem value="1/1_mat">1/1 Mat</SelectItem>
                            <SelectItem value="1/0_sjaj">1/0 Sjaj</SelectItem>
                            <SelectItem value="1/1_sjaj">1/1 Sjaj</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Finishing Options */}
                      <div className="space-y-2 md:col-span-2">
                        <Label>Dorada</Label>
                        <div className="flex flex-wrap gap-3 p-3 border rounded-lg bg-background">
                          {[
                            { id: 'zlatotisak', label: 'Zlatotisak' },
                            { id: 'stancovanje', label: 'Štancovanje' },
                            { id: 'numeracija', label: 'Numeracija' },
                            { id: 'bigovanje', label: 'Bigovanje' },
                            { id: 'savijanje', label: 'Savijanje' },
                            { id: 'perforacija', label: 'Perforacija' },
                            { id: 'suvi_zig', label: 'Suvi žig' },
                            { id: 'uv_lak', label: 'UV Lak' },
                          ].map(option => (
                            <label key={option.id} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={formData.finishing.includes(option.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData({ ...formData, finishing: [...formData.finishing, option.id] });
                                  } else {
                                    setFormData({ ...formData, finishing: formData.finishing.filter(f => f !== option.id) });
                                  }
                                }}
                              />
                              <span className="text-sm">{option.label}</span>
                            </label>
                          ))}
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
                        jobs={digitalJobs.filter(j => j.__status !== 'deleted')}
                        onChange={handleDigitalJobsChange}
                        printSides={formData.print_spec || "4/4"}
                        clientRabatProcenat={clients.find(c => c.id === formData.client_id)?.rabat_procenat || 0}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="other" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    {/* Naziv posla field - REQUIRED */}
                    <div className="space-y-2 max-w-md">
                      <Label htmlFor="job_name_other">Naziv posla <span className="text-destructive">*</span></Label>
                      <Input
                        id="job_name_other"
                        value={formData.job_name || ''}
                        onChange={(e) => setFormData({ ...formData, job_name: e.target.value })}
                        placeholder="Unesite naziv posla..."
                        required
                      />
                    </div>

                    {/* Količina field */}
                    <div className="space-y-2 max-w-xs">
                      <Label htmlFor="run_quantity_other">Količina</Label>
                      <Input
                        id="run_quantity_other"
                        type="number"
                        min="1"
                        value={formData.run_quantity || ''}
                        onChange={(e) => setFormData({ ...formData, run_quantity: e.target.value ? parseInt(e.target.value) : undefined })}
                        placeholder="Unesite količinu..."
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Fajlovi (opciono)</Label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowOtherFilesModal(true)}
                      >
                        <FileUp className="h-4 w-4 mr-2" />
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
                    Unesite količinu i detalje u napomeni ispod.
                  </p>
                </TabsContent>

                <TabsContent value="film" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    {filmSettings && filmJobs.length > 0 && (
                      <FilmJobsSummary
                        totalMeters={filmJobs.reduce((sum, job) => {
                          return sum + (job.computed_total_m || 0);
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
                  {loading ? (isEditMode ? "Snimanje..." : "Kreiranje...") : (isEditMode ? "Snimi izmene" : "Kreiraj nalog")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
        )}
      </main>
      
      <AddCtpFilesModal
        open={showCtpFilesModal}
        onOpenChange={setShowCtpFilesModal}
        onAddFiles={(items) => setCtpItems([...ctpItems, ...items])}
        defaultQuantity={bulkQuantity}
        defaultFormatId={bulkFormat}
      />
      
      <AddCtpFilesModal
        open={showOtherFilesModal}
        onOpenChange={setShowOtherFilesModal}
        onAddFiles={(items) => setCtpItems([...ctpItems, ...items.map(i => ({ ...i, quantity: 1 }))])}
        defaultQuantity={1}
      />
    </div>
  );
};

export default NewWorkOrder;