import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, X } from "lucide-react";
import {
  COMPLAINT_CATEGORY_LABELS,
  MAX_COMPLAINT_ATTACHMENTS,
  SEVERITY_LABELS,
  type ComplaintCategory,
} from "@/lib/complaints";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  authorName: string;
}

export const NewComplaintDialog = ({
  open,
  onOpenChange,
  clientId,
  clientName,
  authorName,
}: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<ComplaintCategory>("job");
  const [workOrderId, setWorkOrderId] = useState<string>("none");
  const [severity, setSeverity] = useState("3");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: orders = [] } = useQuery({
    queryKey: ["portal-complaint-orders", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, display_order_number, job_name")
        .eq("client_id", clientId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const reset = () => {
    setCategory("job");
    setWorkOrderId("none");
    setSeverity("3");
    setSubject("");
    setDescription("");
    setFiles([]);
  };

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, MAX_COMPLAINT_ATTACHMENTS);
    setFiles(next);
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      toast({
        title: "Nepotpuni podaci",
        description: "Unesite naslov i opis reklamacije.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: complaint, error } = await supabase
        .from("complaints")
        .insert({
          client_id: clientId,
          work_order_id: workOrderId === "none" ? null : workOrderId,
          category,
          severity: Number(severity),
          subject: subject.trim(),
          description: description.trim(),
          created_by: user?.id ?? null,
        } as any)
        .select("id, complaint_number")
        .single();

      if (error) throw error;

      // Upload attachments
      let failedAttachments = 0;
      for (const file of files) {
        const path = `${clientId}/${complaint.id}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("complaints")
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) {
          console.error("Upload failed", upErr);
          failedAttachments++;
          continue;
        }
        const { error: rowErr } = await supabase.from("complaint_attachments").insert({
          complaint_id: complaint.id,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_by: user?.id ?? null,
        } as any);
        if (rowErr) {
          console.error("Attachment insert failed", rowErr);
          failedAttachments++;
        }
      }

      if (failedAttachments > 0) {
        toast({
          title: "Prilozi nisu sačuvani",
          description: `${failedAttachments} priloga nije moguće sačuvati. Reklamacija je poslata — priloge možete poslati dodatno.`,
          variant: "destructive",
        });
      }


      try {
        await supabase.functions.invoke("notify-complaint", {
          body: { complaint_id: complaint.id, event: "created" },
        });
      } catch (e) {
        console.error("notify-complaint failed", e);
      }

      toast({
        title: "Reklamacija poslata",
        description: `Broj reklamacije: ${(complaint as any).complaint_number}. Odgovor dobijate u roku od 24h.`,
      });
      queryClient.invalidateQueries({ queryKey: ["client-complaints", clientId] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Greška",
        description: e.message || "Reklamacija nije poslata",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova reklamacija</DialogTitle>
          <DialogDescription>
            {clientName} — odgovor dobijate u roku od 24 sata.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tip reklamacije</label>
              <Select value={category} onValueChange={(v) => setCategory(v as ComplaintCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPLAINT_CATEGORY_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ozbiljnost</label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SEVERITY_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Radni nalog (opciono)</label>
            <Select value={workOrderId} onValueChange={setWorkOrderId}>
              <SelectTrigger><SelectValue placeholder="Izaberi nalog" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bez naloga</SelectItem>
                {orders.map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.display_order_number}{o.job_name ? ` — ${o.job_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Naslov</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Kratko o čemu se radi"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Opis</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detaljan opis problema..."
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Prilozi (max {MAX_COMPLAINT_ATTACHMENTS})
            </label>
            <Input
              type="file"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              disabled={files.length >= MAX_COMPLAINT_ATTACHMENTS}
            />
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span className="truncate flex-1">{f.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Otkaži
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Slanje..." : "Pošalji reklamaciju"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
