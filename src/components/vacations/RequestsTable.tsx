import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Ban } from "lucide-react";
import { VacationRequest, useCancelVacation, useReviewVacation } from "@/hooks/useVacations";
import { formatDate, statusLabel } from "@/lib/vacationCalc";
import { useAuthz } from "@/hooks/useAuthz";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  requests: VacationRequest[];
  scope: "mine" | "all";
}

export function RequestsTable({ requests, scope }: Props) {
  const [uid, setUid] = useState<string | null>(null);
  const { isAdminPlus } = useAuthz();
  const cancel = useCancelVacation();
  const review = useReviewVacation();
  const [reviewOpen, setReviewOpen] = useState<{ id: string; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then((r) => setUid(r.data.user?.id ?? null));
  }, []);

  const rows = scope === "mine"
    ? requests.filter((r) => r.user_id === uid)
    : requests;

  const badgeVariant = (s: string) =>
    s === "approved" ? "default" : s === "pending" ? "secondary" : s === "rejected" ? "destructive" : "outline";

  const handleReview = async () => {
    if (!reviewOpen) return;
    try {
      await review.mutateAsync({ id: reviewOpen.id, decision: reviewOpen.decision, note: note.trim() || null });
      toast.success(reviewOpen.decision === "approved" ? "Zahtev odobren" : "Zahtev odbijen");
      setReviewOpen(null);
      setNote("");
    } catch (e: any) {
      toast.error(e.message || "Greška");
    }
  };

  return (
    <>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {scope === "all" && <TableHead>Zaposleni</TableHead>}
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Dana</TableHead>
              <TableHead>Napomena</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Odluka</TableHead>
              <TableHead className="text-right">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={scope === "all" ? 7 : 6} className="text-center text-muted-foreground py-6">
                  Nema zahteva
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                {scope === "all" && <TableCell className="font-medium">{r.user_name}</TableCell>}
                <TableCell>{formatDate(r.start_date)} — {formatDate(r.end_date)}</TableCell>
                <TableCell className="text-right">{r.days_count}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground text-sm">{r.reason || "—"}</TableCell>
                <TableCell><Badge variant={badgeVariant(r.status)}>{statusLabel(r.status)}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.reviewed_at ? <>{formatDate(r.reviewed_at)}<div className="text-xs">{r.reviewer_note}</div></> : "—"}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {r.status === "pending" && r.user_id === uid && (
                    <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r.id)}>
                      <Ban className="h-4 w-4 mr-1" /> Otkaži
                    </Button>
                  )}
                  {r.status === "pending" && isAdminPlus && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setReviewOpen({ id: r.id, decision: "approved" }); setNote(""); }}>
                        <Check className="h-4 w-4 mr-1 text-emerald-600" /> Odobri
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setReviewOpen({ id: r.id, decision: "rejected" }); setNote(""); }}>
                        <X className="h-4 w-4 mr-1 text-destructive" /> Odbij
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!reviewOpen} onOpenChange={(o) => !o && setReviewOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewOpen?.decision === "approved" ? "Odobri zahtev" : "Odbij zahtev"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Napomena (opciono)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(null)}>Otkaži</Button>
            <Button onClick={handleReview} disabled={review.isPending}>Potvrdi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
