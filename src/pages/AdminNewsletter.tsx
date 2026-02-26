import { useState, useEffect } from "react";
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
  Trash2, Edit, Search, Loader2, CheckCircle2, XCircle, Clock, Code, Sparkles, Package
} from "lucide-react";
import * as XLSX from "xlsx";
import NewsletterBuilder, { blocksToFullHtml, ThemePicker, EMAIL_THEMES, type EmailTheme } from "@/components/newsletter/NewsletterBuilder";

// ── Recipients Tab ──
function RecipientsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editRecipient, setEditRecipient] = useState<any>(null);
  const [form, setForm] = useState({ company_name: "", email: "", contact_person: "", city: "", phone: "", notes: "" });

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
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);

    const mapped = rows
      .filter((r) => r.email || r.Email || r.EMAIL)
      .map((r) => ({
        company_name: r.company_name || r.firma || r.Firma || r.naziv || r.Naziv || r.name || r.Name || "Nepoznato",
        email: (r.email || r.Email || r.EMAIL || "").trim().toLowerCase(),
        contact_person: r.contact_person || r.kontakt || r.Kontakt || r.kontakt_osoba || null,
        city: r.city || r.grad || r.Grad || r.mesto || r.Mesto || null,
        phone: r.phone || r.telefon || r.Telefon || null,
        notes: r.notes || r.napomena || r.Napomena || null,
      }));

    if (mapped.length === 0) {
      toast({ title: "Nema validnih redova", description: "Excel mora imati kolonu 'email'", variant: "destructive" });
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
        <label className="cursor-pointer">
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" asChild><span><Upload className="h-4 w-4 mr-1" />Import Excel</span></Button>
        </label>
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
                      <NewsletterBuilder onHtmlChange={setHtmlBody} theme={selectedTheme} />
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
