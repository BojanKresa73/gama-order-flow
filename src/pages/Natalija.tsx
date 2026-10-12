import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Brain, Loader2, Plus, Send, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; tools_used?: { name: string }[] | null };

const EXAMPLES = [
  "Koliko smo ploča potrošili u septembru u odnosu na avgust, po formatima?",
  "Koji klijenti su najviše pali u CTP potrošnji poslednja 3 meseca?",
  "Da li treba da poručimo ploče i koliko, s obzirom na lager i robu na putu?",
  "Koliko zatvorenih naloga još nije fakturisano ovog meseca?",
];

export default function Natalija() {
  const qc = useQueryClient();
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: access, isLoading: accessLoading } = useQuery({
    queryKey: ["finance-access"],
    queryFn: async () => (await supabase.rpc("has_finance_access")).data === true,
  });

  const { data: convs } = useQuery({
    queryKey: ["ai-conversations"],
    enabled: access === true,
    queryFn: async () =>
      (await supabase.from("ai_conversations").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(30)).data ?? [],
  });

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  const openConv = async (id: string) => {
    setConvId(id); setErr(null);
    const { data } = await supabase.from("ai_messages").select("role, content, tools_used").eq("conversation_id", id).order("created_at");
    setMsgs((data ?? []) as Msg[]);
  };

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput(""); setErr(null); setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: message }]);
    const { data, error } = await supabase.functions.invoke("natalija", { body: { conversation_id: convId, message } });
    setBusy(false);
    if (error || data?.error) {
      let msg = data?.error;
      try { msg = msg ?? (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
      setErr(msg ?? "Natalija nije uspela da odgovori.");
      setInput(message);
      return;
    }
    setConvId(data.conversation_id);
    setMsgs((m) => [...m, { role: "assistant", content: data.answer, tools_used: data.tools_used }]);
    qc.invalidateQueries({ queryKey: ["ai-conversations"] });
  };

  if (accessLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!access) return (
    <div className="min-h-screen bg-background"><AppHeader />
      <p className="p-10 text-center text-muted-foreground">Nemate pristup Borisu.</p></div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-[1400px] mx-auto px-3 md:px-6 py-4 grid gap-4 md:grid-cols-[260px_1fr]">
        <Card className="p-3 h-fit md:sticky md:top-4">
          <Button className="w-full mb-3" variant="outline" onClick={() => { setConvId(null); setMsgs([]); setErr(null); }}>
            <Plus className="h-4 w-4 mr-1" /> Novi razgovor
          </Button>
          <div className="space-y-1 max-h-[60vh] overflow-auto">
            {convs?.map((c) => (
              <button key={c.id} onClick={() => openConv(c.id)}
                className={cn("w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted truncate", convId === c.id && "bg-muted font-medium")}>
                {c.title}
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col min-h-[75vh]">
          <div className="flex items-center gap-2 border-b p-4">
            <Brain className="h-6 w-6 text-primary" />
            <div>
              <h1 className="font-bold text-lg">Natalija — Gama AI Brain</h1>
              <p className="text-xs text-muted-foreground">Analiza naloga, ploča, filma, klijenata i nabavke iz stvarnih podataka. Samo čita, ništa ne menja.</p>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {msgs.length === 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {EXAMPLES.map((e) => (
                  <button key={e} onClick={() => send(e)} className="text-left text-sm border rounded-lg p-3 hover:bg-muted">{e}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={cn("max-w-[85%] rounded-lg p-3 text-sm whitespace-pre-wrap",
                m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted")}>
                {m.content}
                {m.role === "assistant" && m.tools_used && m.tools_used.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Wrench className="h-3 w-3" /> Izvori: {[...new Set(m.tools_used.map((t) => t.name))].join(", ")}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Natalija analizira podatke...</div>}
            {err && <div className="text-sm text-destructive">{err}</div>}
            <div ref={endRef} />
          </div>

          <div className="border-t p-3 flex gap-2">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="Pitajte Nataliju bilo šta o poslovanju..."
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <Button onClick={() => send()} disabled={busy || !input.trim()} className="self-end"><Send className="h-4 w-4" /></Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
