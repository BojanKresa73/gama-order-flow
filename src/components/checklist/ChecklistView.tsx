import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, Clock, AlertCircle, Lock } from "lucide-react";

interface ChecklistItem {
  id: string;
  title: string;
  status: "Pending" | "InProgress" | "Blocked" | "Done" | "NA";
  is_required: boolean;
  file_entry_id: string | null;
  due_at: string | null;
  blocker_reason: string | null;
  comment: string | null;
  started_at: string | null;
  completed_at: string | null;
  file_entries?: {
    filename: string;
  } | null;
}

interface ChecklistViewProps {
  workOrderId: string;
}

export const ChecklistView = ({ workOrderId }: ChecklistViewProps) => {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null);
  const [comment, setComment] = useState("");
  const [blockerReason, setBlockerReason] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchChecklist();
  }, [workOrderId]);

  const fetchChecklist = async () => {
    const { data: checklist } = await supabase
      .from("work_order_checklists")
      .select(`
        id,
        progress_pct,
        work_order_checklist_items(
          id,
          title,
          status,
          is_required,
          file_entry_id,
          due_at,
          blocker_reason,
          comment,
          started_at,
          completed_at,
          file_entries(filename)
        )
      `)
      .eq("work_order_id", workOrderId)
      .single();

    if (checklist) {
      setItems(checklist.work_order_checklist_items as any);
      setProgress(checklist.progress_pct);
    }
  };

  const updateItemStatus = async (itemId: string, newStatus: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    // Validate: Can't mark as Done/Blocked without comment for certain statuses
    if (newStatus === "Blocked" && !blockerReason) {
      toast({
        title: "Greška",
        description: "Morate uneti razlog blokiranja",
        variant: "destructive",
      });
      return;
    }

    const updates: any = {
      status: newStatus,
      updated_by: user.id,
    };

    if (newStatus === "InProgress" && !item.started_at) {
      updates.started_at = new Date().toISOString();
    }

    if (newStatus === "Done") {
      updates.completed_at = new Date().toISOString();
    }

    if (newStatus === "Blocked") {
      updates.blocker_reason = blockerReason;
    }

    if (comment) {
      updates.comment = comment;
    }

    const { error } = await supabase
      .from("work_order_checklist_items")
      .update(updates)
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Log activity
    await supabase.from("checklist_activity_log").insert([{
      checklist_item_id: itemId,
      old_status: item.status,
      new_status: newStatus as any,
      note: comment || blockerReason || null,
      created_by: user.id,
    }]);

    // Update progress
    const updatedItems = items.map(i => 
      i.id === itemId 
        ? { ...i, status: newStatus as any, comment: comment || i.comment, blocker_reason: blockerReason || i.blocker_reason }
        : i
    );
    
    const completedCount = updatedItems.filter(i => i.status === "Done").length;
    const newProgress = Math.round((completedCount / updatedItems.length) * 100);
    
    await supabase
      .from("work_order_checklists")
      .update({ progress_pct: newProgress })
      .eq("work_order_id", workOrderId);

    setItems(updatedItems);
    setProgress(newProgress);
    setSelectedItem(null);
    setComment("");
    setBlockerReason("");

    toast({
      title: "Uspeh",
      description: "Status stavke ažuriran",
    });
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      Pending: { color: "bg-gray-500", icon: Circle, label: "Na čekanju" },
      InProgress: { color: "bg-blue-500", icon: Clock, label: "U toku" },
      Blocked: { color: "bg-red-500", icon: AlertCircle, label: "Blokirano" },
      Done: { color: "bg-green-500", icon: CheckCircle2, label: "Završeno" },
      NA: { color: "bg-gray-400", icon: Circle, label: "N/A" },
    };
    const config = configs[status as keyof typeof configs];
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const isDueSoon = (dueAt: string | null) => {
    if (!dueAt) return false;
    const diff = new Date(dueAt).getTime() - Date.now();
    return diff > 0 && diff < 24 * 60 * 60 * 1000; // Less than 24h
  };

  const requiredIncomplete = items.filter(i => i.is_required && i.status !== "Done").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Checklist</CardTitle>
          {requiredIncomplete > 0 && (
            <Badge variant="outline" className="gap-1">
              <Lock className="w-3 h-3" />
              {requiredIncomplete} obaveznih preostalo
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Napredak: {progress}%</span>
            <span>{items.filter(i => i.status === "Done").length} / {items.length}</span>
          </div>
          <Progress value={progress} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item) => (
            <Dialog key={item.id}>
              <DialogTrigger asChild>
                <div
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {item.title}
                        {item.is_required && <span className="text-red-500 ml-1">*</span>}
                      </p>
                      {item.file_entries && (
                        <Badge variant="outline" className="text-xs">
                          {item.file_entries.filename}
                        </Badge>
                      )}
                    </div>
                    {item.blocker_reason && (
                      <p className="text-sm text-red-600 mt-1">{item.blocker_reason}</p>
                    )}
                    {item.comment && (
                      <p className="text-sm text-muted-foreground mt-1">{item.comment}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.due_at && isDueSoon(item.due_at) && (
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        <Clock className="w-3 h-3 mr-1" />
                        Uskoro rok
                      </Badge>
                    )}
                    {getStatusBadge(item.status)}
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{item.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {item.file_entries && (
                    <div>
                      <p className="text-sm font-medium mb-1">Fajl:</p>
                      <p className="text-sm text-muted-foreground">{item.file_entries.filename}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Select
                      value={item.status}
                      onValueChange={(value) => {
                        const newItem = { ...item, status: value as any };
                        setSelectedItem(newItem);
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Na čekanju</SelectItem>
                        <SelectItem value="InProgress">U toku</SelectItem>
                        <SelectItem value="Done">Završeno</SelectItem>
                        <SelectItem value="Blocked">Blokirano</SelectItem>
                        <SelectItem value="NA">N/A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedItem?.status === "Blocked" && (
                    <div>
                      <label className="text-sm font-medium">Razlog blokiranja *</label>
                      <Textarea
                        className="mt-1"
                        value={blockerReason}
                        onChange={(e) => setBlockerReason(e.target.value)}
                        placeholder="Opišite zašto je stavka blokirana..."
                        rows={3}
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium">Komentar</label>
                    <Textarea
                      className="mt-1"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Dodajte komentar..."
                      rows={3}
                    />
                  </div>

                  <Button
                    onClick={() => updateItemStatus(item.id, selectedItem?.status || item.status)}
                    className="w-full"
                  >
                    Sačuvaj izmene
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
