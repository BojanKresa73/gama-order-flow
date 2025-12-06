import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Maximize2, Square } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LargeFormatJob {
  id: string;
  file_name: string;
  width_mm: number;
  height_mm: number;
  qty: number;
  note: string;
}

const ROLL_WIDTHS = [
  { value: "1370", label: "1370 mm" },
  { value: "1520", label: "1520 mm" },
  { value: "1600", label: "1600 mm" },
];

const ROLL_MATERIALS = [
  { value: "self_adhesive_matte", label: "Samolepljiva mat" },
  { value: "self_adhesive_glossy", label: "Samolepljiva sjajna" },
  { value: "cut_vinyl", label: "CUT folija (ne štampa se)" },
  { value: "tarpaulin", label: "Cerada" },
  { value: "mesh_banner", label: "Mesh platno" },
  { value: "other", label: "Ostalo" },
];

const RIGID_MATERIALS = [
  { value: "forex", label: "Forex (PVC pena)" },
  { value: "dibond", label: "Dibond (aluminijum)" },
  { value: "plexiglass", label: "Pleksiglas" },
  { value: "cardboard", label: "Karton" },
  { value: "wood", label: "Drvo/MDF" },
  { value: "other", label: "Ostalo" },
];

const LAMINATION_TYPES = [
  { value: "none", label: "Bez laminacije" },
  { value: "matte", label: "Mat laminacija" },
  { value: "glossy", label: "Sjajna laminacija" },
];

const LargeFormatNew = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const clientsQuery = useClients();
  const clients = clientsQuery.data || [];
  
  const initialType = searchParams.get("type") === "rigid" ? "rigid" : "roll";
  const [formatType, setFormatType] = useState<"roll" | "rigid">(initialType);
  const [clientId, setClientId] = useState("");
  const [jobName, setJobName] = useState("");
  const [notes, setNotes] = useState("");
  
  // Roll specific
  const [rollWidth, setRollWidth] = useState("1600");
  const [rollMaterial, setRollMaterial] = useState("self_adhesive_matte");
  const [weldEdges, setWeldEdges] = useState(false);
  const [addGrummets, setAddGrummets] = useState(false);
  const [grummetSpacing, setGrummetSpacing] = useState(50);
  
  // Rigid specific
  const [rigidMaterial, setRigidMaterial] = useState("forex");
  const [sheetWidth, setSheetWidth] = useState(2050);
  const [sheetHeight, setSheetHeight] = useState(3050);
  const [cncCut, setCncCut] = useState(false);
  const [markerMargin, setMarkerMargin] = useState(2);
  
  // Common
  const [laminationType, setLaminationType] = useState("none");
  const [jobs, setJobs] = useState<LargeFormatJob[]>([
    { id: crypto.randomUUID(), file_name: "", width_mm: 1000, height_mm: 1000, qty: 1, note: "" }
  ]);
  
  const [saving, setSaving] = useState(false);

  const addJob = () => {
    setJobs([...jobs, { 
      id: crypto.randomUUID(), 
      file_name: "", 
      width_mm: 1000, 
      height_mm: 1000, 
      qty: 1, 
      note: "" 
    }]);
  };

  const removeJob = (id: string) => {
    if (jobs.length > 1) {
      setJobs(jobs.filter(j => j.id !== id));
    }
  };

  const updateJob = (id: string, field: keyof LargeFormatJob, value: any) => {
    setJobs(jobs.map(j => j.id === id ? { ...j, [field]: value } : j));
  };

  const calculateTotalArea = () => {
    return jobs.reduce((sum, job) => {
      const area = (job.width_mm / 1000) * (job.height_mm / 1000) * job.qty;
      return sum + area;
    }, 0);
  };

  const handleSubmit = async () => {
    if (!clientId) {
      toast({ title: "Greška", description: "Izaberite klijenta", variant: "destructive" });
      return;
    }

    if (jobs.some(j => !j.file_name.trim())) {
      toast({ title: "Greška", description: "Unesite naziv fajla za sve stavke", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niste prijavljeni");

      const kind = formatType === "roll" ? "ROLNA" : "PLOCA";
      
      // Create work order first
      const { data: workOrder, error: woError } = await supabase
        .from("work_orders")
        .insert({
          client_id: clientId,
          order_type: "large_format",
          kind: kind,
          order_number: `${kind}-TEMP`,
          job_name: jobName,
          notes: notes,
          created_by: user.id,
          status: "open",
        })
        .select()
        .single();

      if (woError) throw woError;

      // Create large format order
      const { data: lfOrder, error: lfError } = await supabase
        .from("large_format_orders" as any)
        .insert({
          work_order_id: workOrder.id,
          format_type: formatType,
          roll_width_mm: formatType === "roll" ? parseInt(rollWidth) : null,
          roll_material: formatType === "roll" ? rollMaterial : null,
          rigid_material: formatType === "rigid" ? rigidMaterial : null,
          sheet_width_mm: formatType === "rigid" ? sheetWidth : null,
          sheet_height_mm: formatType === "rigid" ? sheetHeight : null,
          lamination_type: laminationType === "none" ? null : laminationType,
          total_area_m2: calculateTotalArea(),
          weld_edges: formatType === "roll" ? weldEdges : false,
          add_grommets: formatType === "roll" ? addGrummets : false,
          grommet_spacing_cm: formatType === "roll" && addGrummets ? grummetSpacing : null,
          cnc_cut: formatType === "rigid" ? cncCut : false,
          marker_margin_cm: formatType === "rigid" && cncCut ? markerMargin : null,
        })
        .select()
        .single();

      if (lfError) throw lfError;

      // Create jobs
      const jobsToInsert = jobs.map((job, index) => ({
        large_format_order_id: (lfOrder as any).id,
        file_name: job.file_name,
        width_mm: job.width_mm,
        height_mm: job.height_mm,
        qty: job.qty,
        note: job.note || null,
        area_m2: (job.width_mm / 1000) * (job.height_mm / 1000) * job.qty,
        order_index: index,
      }));

      const { error: jobsError } = await supabase
        .from("large_format_jobs" as any)
        .insert(jobsToInsert);

      if (jobsError) throw jobsError;

      toast({ title: "Uspešno", description: "Radni nalog je kreiran" });
      navigate("/work-orders");
    } catch (error: any) {
      console.error("Error creating large format order:", error);
      toast({ 
        title: "Greška", 
        description: error.message || "Greška prilikom kreiranja naloga", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  const showWeldOptions = formatType === "roll" && 
    (rollMaterial === "tarpaulin" || rollMaterial === "mesh_banner");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Novi nalog - Veliki format</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <Tabs value={formatType} onValueChange={(v) => setFormatType(v as "roll" | "rigid")} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="roll" className="flex items-center gap-2">
              <Maximize2 className="h-4 w-4" />
              Rolna
            </TabsTrigger>
            <TabsTrigger value="rigid" className="flex items-center gap-2">
              <Square className="h-4 w-4" />
              Ploča
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Osnovni podaci</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Klijent *</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Izaberite klijenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Naziv posla</Label>
                  <Input 
                    value={jobName} 
                    onChange={(e) => setJobName(e.target.value)}
                    placeholder="npr. Bilbord Coca-Cola"
                  />
                </div>
              </div>
              <div>
                <Label>Napomena</Label>
                <Textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Dodatne informacije..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Material & Settings */}
          <Card>
            <CardHeader>
              <CardTitle>
                {formatType === "roll" ? "Materijal i podešavanja rolne" : "Materijal i podešavanja ploče"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {formatType === "roll" ? (
                <>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label>Širina rolne</Label>
                      <Select value={rollWidth} onValueChange={setRollWidth}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLL_WIDTHS.map((w) => (
                            <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Materijal</Label>
                      <Select value={rollMaterial} onValueChange={setRollMaterial}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLL_MATERIALS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Laminacija</Label>
                      <Select value={laminationType} onValueChange={setLaminationType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LAMINATION_TYPES.map((l) => (
                            <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {showWeldOptions && (
                    <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Switch checked={weldEdges} onCheckedChange={setWeldEdges} />
                        <Label>Varenje ivica (5cm preklop)</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={addGrummets} onCheckedChange={setAddGrummets} />
                        <Label>Ringlice</Label>
                      </div>
                      {addGrummets && (
                        <div>
                          <Label>Razmak ringlica (cm)</Label>
                          <Input 
                            type="number" 
                            value={grummetSpacing} 
                            onChange={(e) => setGrummetSpacing(parseInt(e.target.value) || 50)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div>
                      <Label>Materijal</Label>
                      <Select value={rigidMaterial} onValueChange={setRigidMaterial}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RIGID_MATERIALS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Širina table (mm)</Label>
                      <Input 
                        type="number" 
                        value={sheetWidth} 
                        onChange={(e) => setSheetWidth(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>Visina table (mm)</Label>
                      <Input 
                        type="number" 
                        value={sheetHeight} 
                        onChange={(e) => setSheetHeight(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>Laminacija</Label>
                      <Select value={laminationType} onValueChange={setLaminationType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LAMINATION_TYPES.map((l) => (
                            <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Switch checked={cncCut} onCheckedChange={setCncCut} />
                      <Label>CNC sečenje sa markerima</Label>
                    </div>
                    {cncCut && (
                      <div>
                        <Label>Margina markera (cm)</Label>
                        <Input 
                          type="number" 
                          value={markerMargin} 
                          onChange={(e) => setMarkerMargin(parseInt(e.target.value) || 2)}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Files/Jobs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Stavke za štampu</CardTitle>
              <Button variant="outline" size="sm" onClick={addJob}>
                <Plus className="h-4 w-4 mr-1" /> Dodaj stavku
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {jobs.map((job, index) => (
                  <div key={job.id} className="grid md:grid-cols-6 gap-3 p-4 bg-muted/50 rounded-lg">
                    <div className="md:col-span-2">
                      <Label>Naziv fajla *</Label>
                      <Input 
                        value={job.file_name} 
                        onChange={(e) => updateJob(job.id, "file_name", e.target.value)}
                        placeholder="npr. billboard_main.pdf"
                      />
                    </div>
                    <div>
                      <Label>Širina (mm)</Label>
                      <Input 
                        type="number"
                        value={job.width_mm} 
                        onChange={(e) => updateJob(job.id, "width_mm", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>Visina (mm)</Label>
                      <Input 
                        type="number"
                        value={job.height_mm} 
                        onChange={(e) => updateJob(job.id, "height_mm", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>Količina</Label>
                      <Input 
                        type="number"
                        value={job.qty} 
                        onChange={(e) => updateJob(job.id, "qty", parseInt(e.target.value) || 1)}
                        min={1}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeJob(job.id)}
                        disabled={jobs.length === 1}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="md:col-span-6">
                      <Label>Napomena</Label>
                      <Input 
                        value={job.note} 
                        onChange={(e) => updateJob(job.id, "note", e.target.value)}
                        placeholder="Posebna dorada, napomene..."
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-6 pt-4 border-t">
                <div className="flex items-center justify-between text-lg">
                  <span className="font-medium">Ukupna površina:</span>
                  <span className="font-bold text-primary">
                    {calculateTotalArea().toFixed(2)} m²
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {jobs.length} stavki, {jobs.reduce((s, j) => s + j.qty, 0)} komada ukupno
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Odustani
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Čuvanje..." : "Sačuvaj nalog"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LargeFormatNew;
