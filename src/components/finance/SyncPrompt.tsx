import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const fmt = (s?: string | null) => s ? new Date(s).toLocaleString("sr-RS", { timeZone: "Europe/Belgrade", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "nepoznato";

export function SyncPrompt() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const loadLast = async () => {
    const { data } = await supabase.from("mm_sync_state" as any).select("updated_at").eq("status", "done").order("updated_at", { ascending: false }).limit(1);
    setLast((data as any)?.[0]?.updated_at ?? null);
  };
  useEffect(() => { loadLast().then(() => setOpen(true)); }, []);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("minimax-sync", { body });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const run = async () => {
    setBusy(true);
    try {
      const y = new Date().getFullYear();
      const steps: [string, Record<string, unknown>][] = [
        ["Kupci i dobavljači", { step: "customers" }], ["Konta", { step: "accounts" }],
        ["Izlazne fakture", { step: "issuedinvoices" }], ["Ulazne fakture", { step: "receivedinvoices" }],
        [`Knjiženja ${y}`, { step: "journals", year: y }],
      ];
      for (const [label, b] of steps) {
        setProgress(label);
        let r = await call({ ...b, restart: true });
        while (!r.done) {
          if (r.integrity_error) throw new Error(`${label}: odstupanje broja dokumenata`);
          r = await call(b);
        }
      }
      setProgress("Stavke knjiženja");
      let r = await call({ step: "journal_details" });
      while (r.remaining > 0) { setProgress(`Stavke knjiženja (preostalo ${r.remaining})`); r = await call({ step: "journal_details" }); }
      setProgress("Povezivanje dokumenata");
      await call({ step: "link_vat" });
      await qc.invalidateQueries();
      await loadLast();
      toast.success("Podaci su sinhronizovani sa Minimaxom");
      setOpen(false);
    } catch (e: any) {
      toast.error(`Sinhronizacija nije uspela: ${e.message ?? e}`);
    } finally { setBusy(false); setProgress(""); }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sinhronizacija sa Minimaxom</AlertDialogTitle>
          <AlertDialogDescription>
            Poslednje osvežavanje podataka iz Minimaxa: <b>{fmt(last)}</b>.<br />
            Da li želite da sada sinhronizujete podatke? Iz Minimaxa se samo čita, ništa se ne menja.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {busy && <p className="text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{progress}… (može potrajati nekoliko minuta)</p>}
        <AlertDialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Ne, prikaži postojeće</Button>
          <Button disabled={busy} onClick={run}>Da, sinhronizuj</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
