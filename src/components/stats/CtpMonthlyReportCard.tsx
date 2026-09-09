import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthz } from "@/hooks/useAuthz";
import { toast } from "sonner";
import { Loader2, Mail, Send } from "lucide-react";

export const CtpMonthlyReportCard = () => {
  const { isAdminPlus } = useAuthz();
  const [clientId, setClientId] = useState<string>("");
  const [previewEmail, setPreviewEmail] = useState("bojan.kresovic@gamaunited.rs");
  const [busy, setBusy] = useState<"preview" | "one" | "all" | null>(null);

  const { data: clients } = useQuery({
    queryKey: ["ctp-report-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isAdminPlus,
    staleTime: 300000,
  });

  const { data: log, refetch: refetchLog } = useQuery({
    queryKey: ["ctp-monthly-report-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctp_monthly_report_log")
        .select("period, status, recipients, sent_at, clients(name)")
        .order("sent_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdminPlus,
  });

  if (!isAdminPlus) return null;

  const invoke = async (body: Record<string, unknown>, mode: "preview" | "one" | "all") => {
    setBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke("send-ctp-monthly-report", { body });
      if (error) throw error;
      const results = (data as any)?.results || [];
      const sent = results.reduce((s: number, r: any) => s + (r.sent || 0), 0);
      toast.success(
        mode === "preview"
          ? `Pregled poslat na ${previewEmail}`
          : `Poslato: ${sent} mejlova (${results.length} klijenata)`,
      );
      refetchLog();
    } catch (e: any) {
      toast.error(e?.message || "Greška pri slanju izveštaja");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Mesečni izveštaj klijentima</CardTitle>
        <CardDescription>
          Automatski se šalje svakog 1. u mesecu u 07:00 svim klijentima sa CTP potrošnjom.
          Ovde možete poslati pregled sebi ili pokrenuti slanje ručno.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Klijent (za pregled / pojedinačno slanje)</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Izaberite klijenta" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {(clients || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mejl za pregled</Label>
            <Input
              type="email"
              value={previewEmail}
              onChange={(e) => setPreviewEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!clientId || !previewEmail || busy !== null}
            onClick={() => invoke({ client_id: clientId, preview: true, preview_to: previewEmail }, "preview")}
          >
            {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Pošalji pregled meni
          </Button>
          <Button
            variant="outline"
            disabled={!clientId || busy !== null}
            onClick={() => {
              if (confirm("Poslati izveštaj ovom klijentu na sve njegove mejlove?")) {
                invoke({ client_id: clientId, force: true }, "one");
              }
            }}
          >
            {busy === "one" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Pošalji ovom klijentu
          </Button>
          <Button
            disabled={busy !== null}
            onClick={() => {
              if (confirm("Poslati mesečni izveštaj SVIM CTP klijentima? Klijenti kojima je već poslato za ovaj mesec biće preskočeni.")) {
                invoke({}, "all");
              }
            }}
          >
            {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Pošalji svim CTP klijentima
          </Button>
        </div>

        {log && log.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2 text-muted-foreground">Poslednja slanja</p>
            <div className="space-y-1 text-sm">
              {log.map((row: any, i: number) => (
                <div key={i} className="flex justify-between gap-2">
                  <span>{row.clients?.name || "—"}</span>
                  <span className="text-muted-foreground">
                    {row.period?.slice(0, 7)} ·{" "}
                    <span className={row.status === "sent" ? "text-green-600" : "text-destructive"}>
                      {row.status === "sent" ? `poslato (${row.recipients?.length || 0})` : "greška"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
