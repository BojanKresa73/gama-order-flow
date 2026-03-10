import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Upload, Plus, Send, Mail, Users, BarChart3,
  Trash2, Edit, Search, Loader2, CheckCircle2, XCircle, Clock, Code, Sparkles, Package,
  Save, FolderOpen
} from "lucide-react";
import * as XLSX from "xlsx";
import NewsletterBuilder, { blocksToFullHtml, ThemePicker, EMAIL_THEMES, type EmailTheme, type Block } from "@/components/newsletter/NewsletterBuilder";

// ── Recipients Tab ──
function RecipientsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editRecipient, setEditRecipient] = useState<any>(null);
  const [form, setForm] = useState({ company_name: "", email: "", contact_person: "", city: "", phone: "", notes: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ["newsletter-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_recipients")
        .select("*")
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });

  const cities = [...new Set(recipients.map((r: any) => r.city).filter(Boolean))].sort();

  const filtered = recipients.filter((r: any) => {
    const matchSearch = !search || 
      r.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.contact_person?.toLowerCase().includes(search.toLowerCase());
    const matchCity = cityFilter === "all" || r.city === cityFilter;
    return matchSearch && matchCity;
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editRecipient) {
        const { error } = await supabase.from("newsletter_recipients").update(data).eq("id", editRecipient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("newsletter_recipients").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["newsletter-recipients"] });
      toast({ title: editRecipient ? "Primaoc ažuriran" : "Primaoc dodat" });
      setAddOpen(false);
      setEditRecipient(null);
      setForm({ company_name: "", email: "", contact_person: "", city: "", phone: "", notes: "" });
    },
    onError: (e: any) => toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("newsletter_recipients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["newsletter-recipients"] });
      toast({ title: "Primaoc obrisan" });
    },
  });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      
      // Try multiple read strategies
      let wb: XLSX.WorkBook | null = null;
      const readAttempts = [
        { type: "array" as const },
        { type: "buffer" as const },
        { raw: true, type: "array" as const },
      ];
      
      for (const opts of readAttempts) {
        try {
          wb = XLSX.read(data, opts);
          if (wb && wb.SheetNames.length > 0) break;
        } catch { /* try next */ }
      }
      
      if (!wb || wb.SheetNames.length === 0) {
        toast({ title: "Greška", description: "Ne mogu da pročitam Excel fajl", variant: "destructive" });
        return;
      }
      
      let rows: any[] = [];
      let debugInfo = "";
      
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        
        // Strategy 1: Raw array parsing
        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
        
        // Debug: show what we got
        console.log(`Sheet "${sheetName}": ${rawRows.length} raw rows`);
        if (rawRows.length > 0) {
          console.log("Row 0:", JSON.stringify(rawRows[0]));
          if (rawRows.length > 1) console.log("Row 1:", JSON.stringify(rawRows[1]));
          if (rawRows.length > 2) console.log("Row 2:", JSON.stringify(rawRows[2]));
        }
        
        // Find header row
        let headerIdx = -1;
        for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
          const row = rawRows[i];
          if (!Array.isArray(row) || row.length < 3) continue;
          const cellTexts = row.map(cell => String(cell || "").toLowerCase().trim());
          // Check for email-like column name
          if (cellTexts.some(s => /^e[\-\s]?mail$/i.test(s.trim()) || s === "mail")) {
            headerIdx = i;
            break;
          }
        }
        
        // Fallback: find row with known business columns
        if (headerIdx === -1) {
          for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
            const row = rawRows[i];
            if (!Array.isArray(row) || row.length < 3) continue;
            const cellTexts = row.map(cell => String(cell || "").toLowerCase().trim());
            const hasPIB = cellTexts.some(s => s === "pib");
            const hasMB = cellTexts.some(s => s === "mb");
            if (hasPIB || hasMB) {
              headerIdx = i;
              break;
            }
          }
        }
        
        // Last fallback: first row with 5+ non-empty cells
        if (headerIdx === -1) {
          headerIdx = rawRows.findIndex(row =>
            Array.isArray(row) && row.filter(cell => cell != null && String(cell).trim() !== "").length >= 5
          );
        }
        
        console.log(`Header detected at row: ${headerIdx}`);
        
        if (headerIdx >= 0 && headerIdx < rawRows.length - 1) {
          const headers = rawRows[headerIdx].map((h: any) => String(h || "").trim());
          console.log("Headers:", headers);
          debugInfo = headers.filter(h => h).join(", ");
          
          const sheetRows: any[] = [];
          for (let i = headerIdx + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!Array.isArray(row)) continue;
            const obj: any = {};
            headers.forEach((h: string, ci: number) => {
              if (h) obj[h] = row[ci] != null ? String(row[ci]).trim() : "";
            });
            if (Object.values(obj).some(v => v !== "" && v != null)) {
              sheetRows.push(obj);
            }
          }
          
          if (sheetRows.length > rows.length) {
            rows = sheetRows;
          }
        }
        
        // Strategy 2: Standard sheet_to_json
        if (rows.length === 0) {
          const parsed: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
          if (parsed.length > 0) {
            debugInfo = Object.keys(parsed[0]).join(", ");
            console.log(`Standard parse columns:`, debugInfo, "rows:", parsed.length);
            rows = parsed;
          }
        }
      }
      
      console.log("Total rows found:", rows.length);
      if (rows.length > 0) {
        console.log("First row keys:", Object.keys(rows[0]));
        console.log("First row:", rows[0]);
      }

    // Helper to find a value from multiple possible column names (case-insensitive)
    const findCol = (row: any, candidates: string[]): string | null => {
      for (const key of Object.keys(row)) {
        const lower = key.toLowerCase().replace(/[\s\-_]/g, '');
        for (const c of candidates) {
          if (lower === c.toLowerCase().replace(/[\s\-_]/g, '')) return row[key];
        }
      }
      return null;
    };

    const emailCandidates = ["email", "e-mail", "e mail", "mail", "emailadresa", "emailaddress", "eposta", "e-pošta", "Email", "E-mail"];
    const nameCandidates = ["company_name", "firma", "naziv", "name", "kompanija", "preduzece", "preduzeće", "nazivfirme", "naziv firme", "imefirme", "naziv produkcije", "nazivprodukcije"];
    const contactCandidates = ["contact_person", "kontakt", "kontaktosoba", "kontakt_osoba", "kontakt osoba", "osoba"];
    const cityCandidates = ["city", "grad", "mesto", "mesto/grad", "sediste", "sedište"];
    const phoneCandidates = ["phone", "telefon", "tel", "fon", "broj telefona"];
    const notesCandidates = ["notes", "napomena", "komentar", "beleška", "note", "zapisnik"];

    // Also try to find email by scanning cell values if column matching fails
    const findEmailInRow = (row: any): string | null => {
      // First try column name matching
      const byCol = findCol(row, emailCandidates);
      if (byCol) return String(byCol);
      // Fallback: scan all values for something that looks like an email
      for (const val of Object.values(row)) {
        if (val && typeof val === 'string' && val.includes('@') && val.includes('.')) {
          return val;
        }
      }
      return null;
    };

    const mapped = rows
      .filter((r) => {
        const email = findEmailInRow(r);
        return email && String(email).trim().includes("@");
      })
      .map((r) => ({
        company_name: findCol(r, nameCandidates) || "Nepoznato",
        email: String(findEmailInRow(r) || "").trim().toLowerCase(),
        contact_person: findCol(r, contactCandidates) || null,
        city: findCol(r, cityCandidates) || null,
        phone: findCol(r, phoneCandidates) ? String(findCol(r, phoneCandidates)) : null,
        notes: findCol(r, notesCandidates) || null,
      }));

    if (mapped.length === 0) {
      const availableCols = rows.length > 0 ? Object.keys(rows[0]).join(", ") : "nema kolona";
      const sampleValues = rows.length > 0 ? JSON.stringify(rows[0]).substring(0, 200) : "prazan fajl";
      console.error("Import failed. Rows:", rows.length, "Columns:", availableCols, "Sample:", sampleValues);
      toast({ 
        title: `Nema email adresa (${rows.length} redova pronađeno)`, 
        description: `Kolone: ${availableCols || "nema"}. Proveri Console (F12) za detalje.`, 
        variant: "destructive" 
      });
      return;
    }

    const { error } = await supabase.from("newsletter_recipients").upsert(mapped, { onConflict: "email" });
    if (error) {
      toast({ title: "Greška pri importu", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["newsletter-recipients"] });
      toast({ title: `Importovano ${mapped.length} primaoca` });
    }
    e.target.value = "";
    } catch (err: any) {
      console.error("Import error:", err);
      toast({ title: "Greška pri čitanju fajla", description: err.message, variant: "destructive" });
    }
  };

  const openEdit = (r: any) => {
    setEditRecipient(r);
    setForm({ company_name: r.company_name, email: r.email, contact_person: r.contact_person || "", city: r.city || "", phone: r.phone || "", notes: r.notes || "" });
    setAddOpen(true);
  };

  const openAdd = () => {
    setEditRecipient(null);
    setForm({ company_name: "", email: "", contact_person: "", city: "", phone: "", notes: "" });
    setAddOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraži..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Svi gradovi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Svi gradovi</SelectItem>
            {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" type="button" onClick={() => { console.log("Import button clicked"); fileInputRef.current?.click(); }}>
            <Upload className="h-4 w-4 mr-1" />Import Excel
          </Button>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Dodaj</Button>
      </div>

      <div className="text-sm text-muted-foreground">{filtered.length} primaoca {cityFilter !== "all" && `u gradu ${cityFilter}`}</div>

      <div className="rounded-lg border overflow-auto max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Firma</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="hidden md:table-cell">Kontakt</TableHead>
              <TableHead className="hidden md:table-cell">Grad</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nema primaoca</TableCell></TableRow>
            ) : filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.company_name}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell className="hidden md:table-cell">{r.contact_person}</TableCell>
                <TableCell className="hidden md:table-cell">{r.city}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editRecipient ? "Izmeni primaoca" : "Dodaj primaoca"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Firma *</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
            <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Kontakt osoba</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div><Label>Grad</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Napomena</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button
              disabled={!form.company_name || !form.email || saveMutation.isPending}
              onClick={() => saveMutation.mutate(form)}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editRecipient ? "Sačuvaj" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Compose Tab (redesigned) ──
function ComposeTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [sending, setSending] = useState(false);
  const [campaignMode, setCampaignMode] = useState<"template" | "custom">("custom");
  const [selectedTheme, setSelectedTheme] = useState<EmailTheme>(EMAIL_THEMES[0]);
  const [showRecipientList, setShowRecipientList] = useState(false);
  const [currentBlocks, setCurrentBlocks] = useState<Block[]>([]);
  const [draftName, setDraftName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const [initialBlocks, setInitialBlocks] = useState<Block[] | undefined>(undefined);
  const [builderKey, setBuilderKey] = useState(0);

  const { data: recipients = [] } = useQuery({
    queryKey: ["newsletter-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("newsletter_recipients").select("*").eq("is_active", true).order("company_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["newsletter-campaigns-count"],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data, error } = await supabase
        .from("newsletter_campaigns")
        .select("id")
        .gte("created_at", startOfMonth);
      if (error) throw error;
      return data;
    },
  });

  const { data: drafts = [], isLoading: draftsLoading } = useQuery({
    queryKey: ["newsletter-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_drafts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cities = [...new Set(recipients.map((r: any) => r.city).filter(Boolean))].sort();
  const filtered = recipients.filter((r: any) => cityFilter === "all" || r.city === cityFilter);
  const finalRecipients = selectAll ? filtered : filtered.filter((r: any) => selectedIds.has(r.id));

  const toggleRecipient = (id: string) => {
    setSelectAll(false);
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  // Re-emit HTML when theme changes
  useEffect(() => {
    if (htmlBody) {
      // We don't regenerate here because builder handles it via onHtmlChange
    }
  }, [selectedTheme]);

  const handleSaveDraft = async () => {
    if (!draftName.trim()) {
      toast({ title: "Unesite naziv drafta", variant: "destructive" });
      return;
    }
    setSavingDraft(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niste prijavljeni");
      
      const draftData = {
        user_id: user.id,
        name: draftName,
        subject,
        blocks: currentBlocks as any,
        theme_name: selectedTheme.name,
      };

      if (loadedDraftId) {
        const { error } = await supabase.from("newsletter_drafts").update(draftData).eq("id", loadedDraftId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("newsletter_drafts").insert(draftData).select().single();
        if (error) throw error;
        setLoadedDraftId(data.id);
      }

      qc.invalidateQueries({ queryKey: ["newsletter-drafts"] });
      toast({ title: loadedDraftId ? "Draft ažuriran" : "Draft sačuvan" });
      setShowSaveDialog(false);
    } catch (err: any) {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLoadDraft = (draft: any) => {
    setSubject(draft.subject || "");
    const themeName = draft.theme_name || "Standard";
    const theme = EMAIL_THEMES.find(t => t.name === themeName) || EMAIL_THEMES[0];
    setSelectedTheme(theme);
    setLoadedDraftId(draft.id);
    setDraftName(draft.name);
    setInitialBlocks(draft.blocks as Block[]);
    setBuilderKey(prev => prev + 1);
    setHtmlBody(blocksToFullHtml(draft.blocks as Block[], theme));
    setCurrentBlocks(draft.blocks as Block[]);
    setShowLoadDialog(false);
    toast({ title: `Draft "${draft.name}" učitan` });
  };

  const handleDeleteDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("newsletter_drafts").delete().eq("id", id);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["newsletter-drafts"] });
      if (loadedDraftId === id) setLoadedDraftId(null);
      toast({ title: "Draft obrisan" });
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !htmlBody.trim()) {
      toast({ title: "Unesite naslov i sadržaj", variant: "destructive" });
      return;
    }
    if (finalRecipients.length === 0) {
      toast({ title: "Nema izabranih primalaca", variant: "destructive" });
      return;
    }

    const confirmed = window.confirm(`Poslati newsletter na ${finalRecipients.length} adresa?`);
    if (!confirmed) return;

    setSending(true);
    try {
      const { data: campaign, error: campErr } = await supabase
        .from("newsletter_campaigns")
        .insert({ subject, html_body: htmlBody, total_recipients: finalRecipients.length })
        .select()
        .single();
      if (campErr) throw campErr;

      const sendRecords = finalRecipients.map((r: any) => ({
        campaign_id: campaign.id,
        recipient_id: r.id,
        recipient_email: r.email,
      }));
      const { error: sendsErr } = await supabase.from("newsletter_sends").insert(sendRecords);
      if (sendsErr) throw sendsErr;

      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: { campaign_id: campaign.id },
      });
      if (error) throw error;

      toast({
        title: "Newsletter poslat!",
        description: `Uspešno: ${data.sent}, Neuspešno: ${data.failed}`,
      });

      qc.invalidateQueries({ queryKey: ["newsletter-campaigns"] });
      qc.invalidateQueries({ queryKey: ["newsletter-campaigns-count"] });
      setSubject("");
      setHtmlBody("");
    } catch (err: any) {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Campaign counter */}
      <div className="text-sm text-muted-foreground">
        Kampanje ovog meseca: <span className="font-semibold text-foreground">{campaigns.length}/10</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Campaign creation - 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5" />
                Kreiraj kampanju
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode toggle */}
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  onClick={() => setCampaignMode("template")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium transition-colors ${
                    campaignMode === "template"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted/50"
                  }`}
                >
                  <Package className="h-4 w-4" />
                  Gotov paket
                </button>
                <button
                  onClick={() => setCampaignMode("custom")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium transition-colors ${
                    campaignMode === "custom"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted/50"
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Sopstvena kampanja
                </button>
              </div>

              {campaignMode === "custom" && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium text-primary">Sopstvena kampanja</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Kreirajte potpuno prilagođenu kampanju. Samo vi je vidite.</p>
                </div>
              )}

              {/* Subject */}
              <div>
                <Label className="text-sm font-medium">Subject emaila:</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Unesite subject..." className="mt-1" />
              </div>

              {/* Content */}
              {campaignMode === "custom" ? (
                <>
                  <div>
                    <Label className="text-sm font-medium">Sadržaj poruke:</Label>
                    <div className="mt-1">
                      <NewsletterBuilder
                        key={builderKey}
                        onHtmlChange={setHtmlBody}
                        theme={selectedTheme}
                        initialBlocks={initialBlocks}
                        onBlocksChange={setCurrentBlocks}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <Label className="text-sm font-medium">Sadržaj poruke:</Label>
                  <Textarea
                    value={htmlBody}
                    onChange={(e) => setHtmlBody(e.target.value)}
                    placeholder="Unesite tekst kampanje..."
                    className="mt-1 min-h-[200px]"
                  />
                </div>
              )}

              {/* Theme picker */}
              <ThemePicker selectedTheme={selectedTheme} onSelect={setSelectedTheme} />

              {/* Draft buttons */}
              {campaignMode === "custom" && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => {
                    if (!draftName && !loadedDraftId) setDraftName("");
                    setShowSaveDialog(true);
                  }}>
                    <Save className="h-4 w-4 mr-2" />
                    {loadedDraftId ? "Ažuriraj draft" : "Sačuvaj draft"}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setShowLoadDialog(true)}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Učitaj draft {drafts.length > 0 && `(${drafts.length})`}
                  </Button>
                </div>
              )}

              {loadedDraftId && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-1.5 flex items-center gap-1">
                  <FolderOpen className="h-3 w-3" />
                  Trenutni draft: <span className="font-medium">{draftName}</span>
                </div>
              )}

              {/* Send button */}
              <Button onClick={handleSend} disabled={sending || !subject || !htmlBody} className="w-full" size="lg">
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Pošalji ({finalRecipients.length})
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Recipients panel - 1 col */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Primaoci
                </CardTitle>
                <div className="flex gap-1">
                  <Badge variant={selectAll ? "default" : "outline"} className="cursor-pointer" onClick={() => { setSelectAll(true); setSelectedIds(new Set()); }}>
                    Svi ({filtered.length})
                  </Badge>
                  <Badge variant={!selectAll ? "default" : "outline"} className="cursor-pointer" onClick={() => setShowRecipientList(true)}>
                    Ručno
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectAll ? (
                <div className="text-center py-6">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium text-sm">Slanje svim klijentima</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Kampanja će biti poslata na <span className="font-semibold">{filtered.length}</span> email adresa
                    {cities.length > 0 && (
                      <> u gradovima: {cities.slice(0, 5).join(", ")}{cities.length > 5 ? `, +${cities.length - 5}` : ""}</>
                    )}
                  </p>
                  <button
                    onClick={() => { setSelectAll(false); setShowRecipientList(true); }}
                    className="text-xs text-primary hover:underline mt-3 inline-block"
                  >
                    ili izaberite ručno →
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Izabrano: <span className="font-semibold text-foreground">{selectedIds.size}</span> od {filtered.length}
                  </div>
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Svi gradovi" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Svi gradovi</SelectItem>
                      {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="rounded-lg border overflow-auto max-h-[350px]">
                    <Table>
                      <TableBody>
                        {filtered.map((r: any) => (
                          <TableRow key={r.id} className="cursor-pointer" onClick={() => toggleRecipient(r.id)}>
                            <TableCell className="w-[30px] py-2">
                              <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleRecipient(r.id)} />
                            </TableCell>
                            <TableCell className="font-medium py-2 text-xs">{r.company_name}</TableCell>
                            <TableCell className="py-2 text-xs text-muted-foreground">{r.city}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => { setSelectAll(true); setSelectedIds(new Set()); }}>
                    Resetuj na sve
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save Draft Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle><Save className="h-5 w-5 inline mr-2" />Sačuvaj draft</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Naziv drafta *</Label>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="npr. Praznik Mart 2026"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Čuva se: subject, svi blokovi sadržaja, i izabrana tema.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Otkaži</Button>
            <Button onClick={handleSaveDraft} disabled={savingDraft || !draftName.trim()}>
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {loadedDraftId ? "Ažuriraj" : "Sačuvaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Draft Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle><FolderOpen className="h-5 w-5 inline mr-2" />Učitaj draft</DialogTitle></DialogHeader>
          {draftsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : drafts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Nemate sačuvanih draftova</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {drafts.map((d: any) => (
                <div
                  key={d.id}
                  onClick={() => handleLoadDraft(d)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                    loadedDraftId === d.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{d.subject || "Bez subjecta"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(d.updated_at).toLocaleDateString("sr-Latn")} · {d.theme_name}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 ml-2"
                    onClick={(e) => handleDeleteDraft(d.id, e)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── History Tab ──
function HistoryTab() {
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["newsletter-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent": return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Poslat</Badge>;
      case "sending": return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Slanje...</Badge>;
      case "draft": return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="rounded-lg border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Naslov</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Poslato</TableHead>
            <TableHead className="text-right">Neuspelo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
          ) : campaigns.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nema poslatih newslettera</TableCell></TableRow>
          ) : campaigns.map((c: any) => (
            <TableRow key={c.id}>
              <TableCell>{new Date(c.created_at).toLocaleDateString("sr-Latn")}</TableCell>
              <TableCell className="font-medium">{c.subject}</TableCell>
              <TableCell>{statusBadge(c.status)}</TableCell>
              <TableCell className="text-right">{c.sent_count}/{c.total_recipients}</TableCell>
              <TableCell className="text-right">
                {c.failed_count > 0 ? <span className="text-destructive font-medium">{c.failed_count}</span> : "0"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Main Page ──
export default function AdminNewsletter() {
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-[1400px] mx-auto px-3 md:px-6 py-4 md:py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => nav("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Mail className="h-6 w-6" /> Newsletter
            </h1>
            <p className="text-sm text-muted-foreground">Pošaljite newsletter klijentima</p>
          </div>
        </div>

        <Tabs defaultValue="compose" className="space-y-4">
          <TabsList>
            <TabsTrigger value="compose" className="gap-1"><Send className="h-4 w-4" />Pošalji</TabsTrigger>
            <TabsTrigger value="recipients" className="gap-1"><Users className="h-4 w-4" />Primaoci</TabsTrigger>
            <TabsTrigger value="history" className="gap-1"><BarChart3 className="h-4 w-4" />Istorija</TabsTrigger>
          </TabsList>

          <TabsContent value="compose"><ComposeTab /></TabsContent>
          <TabsContent value="recipients"><Card><CardContent className="pt-6"><RecipientsTab /></CardContent></Card></TabsContent>
          <TabsContent value="history"><Card><CardContent className="pt-6"><HistoryTab /></CardContent></Card></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
