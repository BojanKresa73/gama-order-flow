import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ProfileSettingsDialog({ open, onOpenChange }: Props) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await (supabase as any)
        .from("profiles")
        .select("full_name, phone, job_title")
        .eq("id", auth.user.id)
        .maybeSingle();
      setFullName(data?.full_name || "");
      setPhone(data?.phone || "");
      setJobTitle(data?.job_title || "");
      setLoading(false);
    })();
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Nema korisnika");
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          job_title: jobTitle.trim() || null,
        })
        .eq("id", auth.user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["signer-profile"] });
      toast.success("Profil sačuvan");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Greška: " + (e?.message || ""));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Podešavanja profila</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Ovi podaci se koriste kao potpis na PDF ponudama iz brzog kalkulatora.
        </p>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Ime i prezime</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Radna pozicija</Label>
              <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="npr. Direktor prodaje" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+381 63 …" />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Otkaži</Button>
          <Button size="sm" onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Sačuvaj
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
