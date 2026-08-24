import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/layout/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertTriangle, Paperclip, Search, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthz } from "@/hooks/useAuthz";
import {
  useAllComplaints,
  useAddComplaintMessage,
  useComplaintAttachments,
  useComplaintMessages,
  useUpdateComplaintStatus,
  openComplaintAttachment,
  type Complaint,
} from "@/hooks/useComplaints";
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_VARIANTS,
  OPEN_COMPLAINT_STATUSES,
  isComplaintOverdue,
  type ComplaintStatus,
} from "@/lib/complaints";

const fmt = (d: string) =>
  new Date(d).toLocaleString("sr-RS", { dateStyle: "short", timeStyle: "short" });

type Row = Complaint & { clients?: { name: string } };

const Complaints = () => {
  const { toast } = useToast();
  const { isSuper, isLoading: authzLoading } = useAuthz();
  const [statusFilter, setStatusFilter] = useState<"open" | "all" | ComplaintStatus>("open");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");

  const { data: complaints = [], isLoading } = useAllComplaints();
  const { data: messages = [] } = useComplaintMessages(selected?.id);
  const { data: attachments = [] } = useComplaintAttachments(selected?.id);
  const addMessage = useAddComplaintMessage();
  const updateStatus = useUpdateComplaintStatus();

  const { data: profile } = useQuery({
    queryKey: ["my-profile-name"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (complaints as Row[]).filter((c) => {
      if (statusFilter === "open" && !OPEN_COMPLAINT_STATUSES.includes(c.status)) return false;
      if (statusFilter !== "open" && statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.complaint_number.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        (c.clients?.name || "").toLowerCase().includes(q)
      );
    });
  }, [complaints, statusFilter, search]);

  const openCount = (complaints as Row[]).filter((c) =>
    OPEN_COMPLAINT_STATUSES.includes(c.status)
  ).length;
  const overdueCount = (complaints as Row[]).filter((c) =>
    isComplaintOverdue(c.status, c.due_at)
  ).length;

  if (authzLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSuper) return <Navigate to="/dashboard" replace />;

  const handleReply = () => {
    if (!selected || !reply.trim()) return;
    addMessage.mutate(
      {
        complaintId: selected.id,
        body: reply.trim(),
        isInternal: internalNote,
        isFromClient: false,
        authorName: profile?.full_name || "Gama United",
      },
      {
        onSuccess: async () => {
          setReply("");
          toast({ title: internalNote ? "Interna napomena sačuvana" : "Odgovor poslat klijentu" });
          if (!internalNote) {
            try {
              await supabase.functions.invoke("notify-complaint", {
                body: { complaint_id: selected.id, event: "reply", note: reply.trim() },
              });
            } catch (e) {
              console.error(e);
            }
          }
        },
        onError: (e: any) =>
          toast({ title: "Greška", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleStatus = (status: ComplaintStatus) => {
    if (!selected) return;
    updateStatus.mutate(
      {
        complaintId: selected.id,
        status,
        resolutionNote:
          status === "resolved" || status === "rejected"
            ? resolutionNote.trim() || selected.resolution_note
            : selected.resolution_note,
      },
      {
        onSuccess: () => {
          toast({ title: `Status: ${COMPLAINT_STATUS_LABELS[status]}` });
          setSelected({ ...selected, status });
        },
        onError: (e: any) =>
          toast({ title: "Greška", description: e.message, variant: "destructive" }),
      }
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Reklamacije" />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Ukupno</p>
              <p className="text-2xl font-bold">{complaints.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">U toku</p>
              <p className="text-2xl font-bold">{openCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Prekoračen rok (24h)</p>
              <p className="text-2xl font-bold text-destructive">{overdueCount}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              Prijavljene reklamacije
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Pretraži po broju, klijentu ili naslovu..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Aktivne</SelectItem>
                  <SelectItem value="all">Sve</SelectItem>
                  {(Object.keys(COMPLAINT_STATUS_LABELS) as ComplaintStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{COMPLAINT_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <p className="py-8 text-center text-muted-foreground">Učitavanje...</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Nema reklamacija</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Broj</TableHead>
                      <TableHead>Klijent</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Naslov</TableHead>
                      <TableHead className="text-center">Ozbiljnost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rok</TableHead>
                      <TableHead>Prijavljena</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() => {
                          setSelected(c);
                          setReply("");
                          setInternalNote(false);
                          setResolutionNote(c.resolution_note || "");
                        }}
                      >
                        <TableCell className="font-mono text-sm">{c.complaint_number}</TableCell>
                        <TableCell>{c.clients?.name || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {COMPLAINT_CATEGORY_LABELS[c.category]}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate">{c.subject}</TableCell>
                        <TableCell className="text-center">{c.severity}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={COMPLAINT_STATUS_VARIANTS[c.status]}>
                            {COMPLAINT_STATUS_LABELS[c.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {isComplaintOverdue(c.status, c.due_at) ? (
                            <span className="text-destructive font-medium">
                              Prekoračen ({fmt(c.due_at)})
                            </span>
                          ) : (
                            fmt(c.due_at)
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{fmt(c.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{selected?.complaint_number}</span>
              {selected && (
                <Badge variant="outline" className={COMPLAINT_STATUS_VARIANTS[selected.status]}>
                  {COMPLAINT_STATUS_LABELS[selected.status]}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selected?.clients?.name} — {selected?.subject}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                {selected.description}
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Tip: {COMPLAINT_CATEGORY_LABELS[selected.category]}</span>
                <span>Ozbiljnost: {selected.severity}/5</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Rok: {fmt(selected.due_at)}
                </span>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Prilozi</p>
                  {attachments.map((a) => (
                    <button
                      key={a.id}
                      onClick={() =>
                        openComplaintAttachment(a.storage_path).catch(() =>
                          toast({ title: "Greška pri otvaranju priloga", variant: "destructive" })
                        )
                      }
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {a.file_name}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Status</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(COMPLAINT_STATUS_LABELS) as ComplaintStatus[]).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={selected.status === s ? "default" : "outline"}
                      disabled={updateStatus.isPending}
                      onClick={() => handleStatus(s)}
                    >
                      {COMPLAINT_STATUS_LABELS[s]}
                    </Button>
                  ))}
                </div>
                <Textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Napomena o rešenju (vidi je klijent kada je reklamacija rešena/odbijena)..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Prepiska</p>
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Još nema poruka.</p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-lg p-3 text-sm ${
                          m.is_internal
                            ? "bg-amber-500/10 border border-amber-500/30"
                            : m.is_from_client
                            ? "bg-muted/50"
                            : "bg-primary/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium">
                            {m.author_name || "—"}
                            {m.is_internal && (
                              <Badge variant="secondary" className="ml-2">Interno</Badge>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">{fmt(m.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={internalNote ? "Interna napomena (klijent ne vidi)..." : "Odgovor klijentu..."}
                  rows={3}
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={internalNote}
                      onCheckedChange={(v) => setInternalNote(!!v)}
                    />
                    Interna napomena (klijent ne vidi)
                  </label>
                  <Button onClick={handleReply} disabled={!reply.trim() || addMessage.isPending}>
                    {addMessage.isPending ? "Slanje..." : "Pošalji"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Complaints;
