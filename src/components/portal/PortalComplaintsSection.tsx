import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, MessageSquarePlus, Paperclip, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NewComplaintDialog } from "./NewComplaintDialog";
import {
  useAddComplaintMessage,
  useClientComplaints,
  useComplaintAttachments,
  useComplaintMessages,
  openComplaintAttachment,
  type Complaint,
} from "@/hooks/useComplaints";
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_VARIANTS,
  OPEN_COMPLAINT_STATUSES,
} from "@/lib/complaints";

interface Props {
  clientId: string;
  clientName: string;
  authorName: string;
}

const fmt = (d: string) =>
  new Date(d).toLocaleString("sr-RS", { dateStyle: "short", timeStyle: "short" });

export const PortalComplaintsSection = ({ clientId, clientName, authorName }: Props) => {
  const { toast } = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [reply, setReply] = useState("");

  const { data: complaints = [], isLoading } = useClientComplaints(clientId);
  const { data: messages = [] } = useComplaintMessages(selected?.id);
  const { data: attachments = [] } = useComplaintAttachments(selected?.id);
  const addMessage = useAddComplaintMessage();

  const openCount = complaints.filter((c) =>
    OPEN_COMPLAINT_STATUSES.includes(c.status)
  ).length;

  const handleReply = () => {
    if (!selected || !reply.trim()) return;
    addMessage.mutate(
      {
        complaintId: selected.id,
        body: reply.trim(),
        isInternal: false,
        isFromClient: true,
        authorName,
      },
      {
        onSuccess: () => {
          setReply("");
          toast({ title: "Poruka poslata" });
        },
        onError: (e: any) =>
          toast({ title: "Greška", description: e.message, variant: "destructive" }),
      }
    );
  };

  return (
    <>
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Reklamacije
            {openCount > 0 && (
              <Badge variant="secondary">{openCount} u toku</Badge>
            )}
          </CardTitle>
          <Button onClick={() => setNewOpen(true)}>
            <MessageSquarePlus className="h-4 w-4 mr-2" />
            Nova reklamacija
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Učitavanje...</p>
          ) : complaints.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nemate prijavljenih reklamacija.
            </p>
          ) : (
            <div className="space-y-2">
              {complaints.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelected(c); setReply(""); }}
                  className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">{c.complaint_number}</span>
                    <Badge variant="outline" className={COMPLAINT_STATUS_VARIANTS[c.status]}>
                      {COMPLAINT_STATUS_LABELS[c.status]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {COMPLAINT_CATEGORY_LABELS[c.category]}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {fmt(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 font-medium">{c.subject}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewComplaintDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        clientId={clientId}
        clientName={clientName}
        authorName={authorName}
      />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{selected?.complaint_number}</span>
              {selected && (
                <Badge variant="outline" className={COMPLAINT_STATUS_VARIANTS[selected.status]}>
                  {COMPLAINT_STATUS_LABELS[selected.status]}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>{selected?.subject}</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                {selected.description}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Rok za odgovor: {fmt(selected.due_at)}
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

              {selected.resolution_note && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                  <p className="font-medium mb-1">Rešenje</p>
                  <p className="whitespace-pre-wrap">{selected.resolution_note}</p>
                </div>
              )}

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
                          m.is_from_client ? "bg-muted/50" : "bg-primary/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium">
                            {m.is_from_client ? m.author_name || "Vi" : m.author_name || "Gama United"}
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
                  placeholder="Dodajte poruku..."
                  rows={3}
                />
                <Button
                  onClick={handleReply}
                  disabled={!reply.trim() || addMessage.isPending}
                >
                  {addMessage.isPending ? "Slanje..." : "Pošalji poruku"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
