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
    queryKey: ["newsletter-recipients", "all"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("newsletter_recipients")
          .select("*")
          .order("company_name")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        allData = allData.concat(data || []);
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return allData;
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
      const data = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(data), { type: "array", cellDates: true, dense: false });

      if (!wb || wb.SheetNames.length === 0) {
        toast({ title: "Greška", description: "Ne mogu da pročitam Excel fajl", variant: "destructive" });
        return;
      }

      let rows: Record<string, any>[] = [];

      for (const sheetName of wb.SheetNames) {
        if (rows.length > 0) break;
        const sheet = wb.Sheets[sheetName];
        if (!sheet) continue;

        // A) Fix !ref range — many exports have wrong range
        const allCells = Object.keys(sheet).filter(k => !k.startsWith('!'));
        if (allCells.length > 0) {
          let minR = Infinity, minC = Infinity, maxR = 0, maxC = 0;
          for (const cell of allCells) {
            const addr = XLSX.utils.decode_cell(cell);
            if (addr.r < minR) minR = addr.r;
            if (addr.c < minC) minC = addr.c;
            if (addr.r > maxR) maxR = addr.r;
            if (addr.c > maxC) maxC = addr.c;
          }
          sheet['!ref'] = XLSX.utils.encode_range({ s: { r: minR, c: minC }, e: { r: maxR, c: maxC } });
        }

        // B) Strategy 1: Standard (header in first row)
        rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "", raw: false });
        console.log(`Sheet "${sheetName}" strategy1: ${rows.length} rows`);
        if (rows.length > 0) {
          console.log("Strategy1 columns:", Object.keys(rows[0]));
        }

        // B) Strategy 2: If empty, scan first 10 rows for header
        if (rows.length === 0) {
          const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "", raw: false });
          console.log(`Sheet "${sheetName}" strategy2 rawRows: ${rawRows.length}`);
          for (let headerIdx = 0; headerIdx < Math.min(rawRows.length, 10); headerIdx++) {
            const headerRow = rawRows[headerIdx];
            if (!headerRow || headerRow.filter((c: any) => c && String(c).trim()).length < 3) continue;
            const headers = headerRow.map((h: any) => String(h || "").trim());
            console.log(`Trying header at row ${headerIdx}:`, headers);
            rows = rawRows.slice(headerIdx + 1)
              .filter((row: any[]) => row.some((c: any) => c != null && String(c).trim() !== ""))
              .map((row: any[]) => {
                const obj: Record<string, any> = {};
                headers.forEach((h: string, i: number) => { if (h) obj[h] = row[i] || ""; });
                return obj;
              });
            if (rows.length > 0) {
              console.log(`Found ${rows.length} rows with header at row ${headerIdx}`);
              break;
            }
          }
        }
      }

      console.log("Total rows found:", rows.length);
      if (rows.length > 0) {
        console.log("First row:", JSON.stringify(rows[0]));
      }

      // C) Flexible column finder — partial match
      const findCol = (row: Record<string, any>, keys: string[]): string => {
        for (const k of keys) {
          const found = Object.keys(row).find(col =>
            col.toLowerCase().trim() === k.toLowerCase() ||
            col.toLowerCase().trim().includes(k.toLowerCase())
          );
          if (found && row[found] != null && String(row[found]).trim())
            return String(row[found]).trim();
        }
        return "";
      };

      // Also scan all values for email pattern
      const findEmail = (row: Record<string, any>): string => {
        const byCol = findCol(row, ["email", "e-mail", "mail", "e mail", "eposta", "e-pošta"]);
        if (byCol && byCol.includes("@")) return byCol;
        for (const val of Object.values(row)) {
          if (val && typeof val === "string" && val.includes("@") && val.includes(".")) {
            return val.trim();
          }
        }
        return "";
      };

      const nameCandidates = ["naziv", "name", "firma", "kompanija", "preduzece", "preduzeće", "naziv firme", "naziv produkcije", "company"];
      const contactCandidates = ["kontakt", "kontakt osoba", "osoba", "contact"];
      const cityCandidates = ["grad", "city", "mesto", "sediste", "sedište"];
      const phoneCandidates = ["telefon", "phone", "tel", "fon"];
      const notesCandidates = ["napomena", "notes", "komentar", "beleška", "zapisnik"];

      const mapped = rows
        .map((r) => {
          const email = findEmail(r);
          const name = findCol(r, nameCandidates) || "Nepoznato";
          const pib = findCol(r, ["pib"]);
          const mb = findCol(r, ["mb", "matični broj", "maticni broj"]);

          // D) Placeholder email for rows without email
          const finalEmail = (email && email.includes("@"))
            ? email.toLowerCase()
            : pib ? `${pib}@placeholder.rs` : mb ? `${mb}@placeholder.rs` : "";

          if (!finalEmail) return null;

          return {
            company_name: name,
            email: finalEmail,
            contact_person: findCol(r, contactCandidates) || null,
            city: findCol(r, cityCandidates) || null,
            phone: findCol(r, phoneCandidates) || null,
            notes: findCol(r, notesCandidates) || null,
          };
        })
        .filter(Boolean) as any[];

      // Deduplicate by email — keep last occurrence
      const deduped = Object.values(
        mapped.reduce((acc: Record<string, any>, item: any) => {
          acc[item.email] = item;
          return acc;
        }, {})
      ) as any[];

      if (deduped.length === 0) {
        const availableCols = rows.length > 0 ? Object.keys(rows[0]).join(", ") : "nema kolona";
        console.error("Import failed. Rows:", rows.length, "Columns:", availableCols);
        toast({
          title: `Nema podataka za import (${rows.length} redova)`,
          description: `Kolone: ${availableCols || "nema"}. Proveri Console (F12).`,
          variant: "destructive",
        });
        return;
      }

      // E) Batch insert
      let totalInserted = 0;
      for (let i = 0; i < deduped.length; i += 50) {
        const batch = deduped.slice(i, i + 50);
        const { error } = await supabase.from("newsletter_recipients").upsert(batch, { onConflict: "email" });
        if (error) {
          toast({ title: "Greška pri importu", description: error.message, variant: "destructive" });
          return;
        }
        totalInserted += batch.length;
      }

      qc.invalidateQueries({ queryKey: ["newsletter-recipients"] });
      toast({ title: `Importovano ${totalInserted} primaoca` });
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
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>Firma</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="hidden md:table-cell">Kontakt</TableHead>
              <TableHead className="hidden md:table-cell">Grad</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nema primaoca</TableCell></TableRow>
            ) : filtered.map((r: any, idx: number) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
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
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const [sendProgress, setSendProgress] = useState<{ sent: number; failed: number; pending: number; total: number } | null>(null);
  const [campaignMode, setCampaignMode] = useState<"template" | "custom">("custom");
  const [selectedTheme, setSelectedTheme] = useState<EmailTheme>(EMAIL_THEMES[0]);
  const [showRecipientList, setShowRecipientList] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [currentBlocks, setCurrentBlocks] = useState<Block[]>([]);
  const [draftName, setDraftName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const [initialBlocks, setInitialBlocks] = useState<Block[] | undefined>(undefined);
  const [builderKey, setBuilderKey] = useState(0);

  // Poll progress while sending
  useEffect(() => {
    if (!sendingCampaignId) return;
    const poll = async () => {
      const { data } = await supabase
        .from("newsletter_sends")
        .select("status")
        .eq("campaign_id", sendingCampaignId);
      if (data) {
        const sent = data.filter((s: any) => s.status === "sent").length;
        const failed = data.filter((s: any) => s.status === "failed").length;
        const pending = data.filter((s: any) => s.status === "pending").length;
        setSendProgress({ sent, failed, pending, total: data.length });
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [sendingCampaignId]);

  const { data: recipients = [] } = useQuery({
    queryKey: ["newsletter-recipients", "active"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from("newsletter_recipients").select("*").eq("is_active", true).order("company_name").range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        allData = allData.concat(data || []);
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return allData;
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
    setSendProgress({ sent: 0, failed: 0, pending: finalRecipients.length, total: finalRecipients.length });
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
      // Batch insert in chunks of 500 to avoid Supabase row limit
      const CHUNK_SIZE = 500;
      for (let i = 0; i < sendRecords.length; i += CHUNK_SIZE) {
        const chunk = sendRecords.slice(i, i + CHUNK_SIZE);
        const { error: sendsErr } = await supabase.from("newsletter_sends").insert(chunk);
        if (sendsErr) throw sendsErr;
      }

      setSendingCampaignId(campaign.id);

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
      setSendingCampaignId(null);
      setSendProgress(null);
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

              {/* Live progress */}
              {sending && sendProgress && (
                <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Slanje u toku...
                    </span>
                    <span>{sendProgress.sent + sendProgress.failed} / {sendProgress.total}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: `${sendProgress.total > 0 ? ((sendProgress.sent + sendProgress.failed) / sendProgress.total * 100) : 0}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Poslato: {sendProgress.sent}</span>
                    <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" /> Neuspelo: {sendProgress.failed}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Preostalo: {sendProgress.pending}</span>
                  </div>
                </div>
              )}
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
                  <Input
                    placeholder="Pretraži klijenta..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="mb-2"
                  />
                  <div className="rounded-lg border overflow-auto max-h-[350px]">
                    <Table>
                      <TableBody>
                        {filtered
                          .filter((r: any) => {
                            if (!recipientSearch) return true;
                            const s = recipientSearch.toLowerCase();
                            return r.company_name?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.city?.toLowerCase().includes(s);
                          })
                          .map((r: any) => (
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

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

  // Get real-time counts from newsletter_sends for all campaigns
  const { data: sendCounts = [] } = useQuery({
    queryKey: ["newsletter-send-counts"],
    refetchInterval: 3000,
    queryFn: async () => {
      if (campaigns.length === 0) return [];
      const ids = campaigns.map((c: any) => c.id);
      // Paginate to get all sends (bypass 1000-row limit)
      let allData: any[] = [];
      const PAGE_SIZE = 1000;
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from("newsletter_sends")
          .select("campaign_id, status")
          .in("campaign_id", ids)
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      // Aggregate
      const map = new Map<string, { sent: number; failed: number; pending: number }>();
      for (const row of allData) {
        if (!map.has(row.campaign_id)) map.set(row.campaign_id, { sent: 0, failed: 0, pending: 0 });
        const entry = map.get(row.campaign_id)!;
        if (row.status === "sent") entry.sent++;
        else if (row.status === "failed") entry.failed++;
        else entry.pending++;
      }
      return Array.from(map.entries()).map(([id, counts]) => ({ campaign_id: id, ...counts }));
    },
    enabled: campaigns.length > 0,
  });

  const countsMap = new Map(sendCounts.map((c: any) => [c.campaign_id, c]));

  // Fetch sends for expanded campaign
  const { data: sends = [], isLoading: sendsLoading } = useQuery({
    queryKey: ["newsletter-sends", expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("newsletter_sends")
          .select("*")
          .eq("campaign_id", expandedId!)
          .order("sent_at", { ascending: false, nullsFirst: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        allData = allData.concat(data || []);
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return allData;
    },
  });

  const handleResume = async (campaignId: string) => {
    const counts = countsMap.get(campaignId);
    const remaining = (counts?.pending || 0) + (counts?.failed || 0);
    if (!window.confirm(`Nastaviti slanje za ${remaining} preostalih mailova?`)) return;
    
    setResumingId(campaignId);
    try {
      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: { campaign_id: campaignId },
      });
      if (error) throw error;
      toast({
        title: "Slanje završeno",
        description: `Uspešno: ${data.sent}, Neuspešno: ${data.failed}`,
      });
      qc.invalidateQueries({ queryKey: ["newsletter-campaigns"] });
      qc.invalidateQueries({ queryKey: ["newsletter-send-counts"] });
    } catch (err: any) {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    } finally {
      setResumingId(null);
    }
  };

  // Fill missing recipients and send
  const handleFillMissing = async (campaign: any) => {
    try {
      // Get all active recipients (paginated)
      let allRecipients: any[] = [];
      let offset = 0;
      const PAGE = 500;
      while (true) {
        const { data, error } = await supabase.from("newsletter_recipients").select("id, email").eq("is_active", true).range(offset, offset + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRecipients = allRecipients.concat(data);
        if (data.length < PAGE) break;
        offset += PAGE;
      }

      // Get already-sent recipient emails for this campaign (paginated)
      let existingEmails = new Set<string>();
      offset = 0;
      while (true) {
        const { data, error } = await supabase.from("newsletter_sends").select("recipient_email").eq("campaign_id", campaign.id).range(offset, offset + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        data.forEach((r: any) => existingEmails.add(r.recipient_email));
        if (data.length < PAGE) break;
        offset += PAGE;
      }

      const missing = allRecipients.filter(r => !existingEmails.has(r.email));
      if (missing.length === 0) {
        toast({ title: "Svi primaoci su već uključeni u kampanju" });
        return;
      }

      if (!window.confirm(`Pronađeno ${missing.length} primalaca koji nisu dobili mail. Dopuniti i poslati?`)) return;

      setResumingId(campaign.id);

      // Insert missing send records in batches
      const CHUNK = 500;
      for (let i = 0; i < missing.length; i += CHUNK) {
        const chunk = missing.slice(i, i + CHUNK).map(r => ({
          campaign_id: campaign.id,
          recipient_id: r.id,
          recipient_email: r.email,
          status: "pending",
        }));
        const { error } = await supabase.from("newsletter_sends").insert(chunk);
        if (error) throw error;
      }

      // Update campaign total
      await supabase.from("newsletter_campaigns").update({ 
        total_recipients: allRecipients.length,
        status: "sending" 
      }).eq("id", campaign.id);

      // Trigger send
      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: { campaign_id: campaign.id },
      });
      if (error) throw error;
      toast({
        title: "Dopuna završena",
        description: `Novo poslato: ${data.sent}, Neuspešno: ${data.failed}`,
      });
      qc.invalidateQueries({ queryKey: ["newsletter-campaigns"] });
      qc.invalidateQueries({ queryKey: ["newsletter-send-counts"] });
    } catch (err: any) {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    } finally {
      setResumingId(null);
    }

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent": return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Poslat</Badge>;
      case "sending": return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Slanje...</Badge>;
      case "draft": return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const sendStatusBadge = (status: string) => {
    switch (status) {
      case "sent": return <Badge variant="default" className="text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Uspešno</Badge>;
      case "failed": return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Neuspelo</Badge>;
      case "pending": return <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Čeka</Badge>;
      default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  // Summary stats from real counts
  const totalSent = sendCounts.reduce((s: number, c: any) => s + c.sent, 0);
  const totalFailed = sendCounts.reduce((s: number, c: any) => s + c.failed, 0);
  const totalCampaigns = campaigns.length;
  const successRate = totalSent + totalFailed > 0 ? ((totalSent / (totalSent + totalFailed)) * 100).toFixed(1) : "—";

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalCampaigns}</p>
            <p className="text-xs text-muted-foreground">Kampanja</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalSent}</p>
            <p className="text-xs text-muted-foreground">Poslato ukupno</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{totalFailed}</p>
            <p className="text-xs text-muted-foreground">Neuspelo ukupno</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{successRate}%</p>
            <p className="text-xs text-muted-foreground">Uspešnost</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns table */}
      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Naslov</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Poslato</TableHead>
              <TableHead className="text-right">Neuspelo</TableHead>
              <TableHead className="text-right">Čeka</TableHead>
              <TableHead className="text-right">Akcija</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : campaigns.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nema poslatih newslettera</TableCell></TableRow>
            ) : campaigns.map((c: any) => {
              const isExpanded = expandedId === c.id;
              const counts = countsMap.get(c.id) || { sent: 0, failed: 0, pending: 0 };
              const hasRemaining = counts.pending > 0 || counts.failed > 0;
              const total = counts.sent + counts.failed + counts.pending;
              const rate = counts.sent > 0 && total > 0 ? ((counts.sent / total) * 100).toFixed(0) : "—";
              return (
                <>
                  <TableRow 
                    key={c.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <TableCell className="text-muted-foreground">{isExpanded ? "▼" : "▶"}</TableCell>
                    <TableCell>
                      <div>{new Date(c.created_at).toLocaleDateString("sr-Latn")}</div>
                      {c.sent_at && <div className="text-xs text-muted-foreground">{new Date(c.sent_at).toLocaleTimeString("sr-Latn", { hour: "2-digit", minute: "2-digit" })}</div>}
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate">{c.subject}</TableCell>
                    <TableCell>{statusBadge(counts.pending > 0 ? "sending" : c.status)}</TableCell>
                    <TableCell className="text-right font-medium">
                      <span className="text-green-600">{counts.sent}</span>
                      <span className="text-muted-foreground">/{total}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {counts.failed > 0 ? <span className="text-destructive font-medium">{counts.failed}</span> : "0"}
                    </TableCell>
                    <TableCell className="text-right">
                      {counts.pending > 0 ? <span className="text-yellow-600 font-medium">{counts.pending}</span> : "0"}
                    </TableCell>
                    <TableCell className="text-right">
                      {hasRemaining && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resumingId === c.id}
                          onClick={(e) => { e.stopPropagation(); handleResume(c.id); }}
                        >
                          {resumingId === c.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                          Nastavi
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={c.id + "-detail"}>
                      <TableCell colSpan={8} className="bg-muted/30 p-0">
                        <div className="p-4 space-y-2">
                          {/* Progress bar */}
                          {total > 0 && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Progres: {counts.sent} od {total}</span>
                                <span>{rate !== "—" ? `${rate}%` : ""}</span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(counts.sent / total) * 100}%` }} />
                              </div>
                            </div>
                          )}
                          <h4 className="text-sm font-medium flex items-center gap-2"><Mail className="h-4 w-4" />Detalji slanja</h4>
                          {sendsLoading ? (
                            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                          ) : sends.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">Nema podataka o pojedinačnim slanjima</p>
                          ) : (
                            <div className="rounded border bg-background overflow-auto max-h-[300px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Vreme</TableHead>
                                    <TableHead>Greška</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sends.map((s: any) => (
                                    <TableRow key={s.id}>
                                      <TableCell className="text-sm">{s.recipient_email}</TableCell>
                                      <TableCell>{sendStatusBadge(s.status)}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {s.sent_at ? new Date(s.sent_at).toLocaleString("sr-Latn", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                                      </TableCell>
                                      <TableCell className="text-sm text-destructive max-w-[200px] truncate">{s.error_msg || ""}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
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
