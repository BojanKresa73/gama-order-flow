import { useState, useEffect } from "react";
import { Mail, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailNotificationToggleProps {
  portalUserId: string;
  initialEnabled?: boolean;
}

export const EmailNotificationToggle = ({ portalUserId, initialEnabled = true }: EmailNotificationToggleProps) => {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);

  const handleToggle = async () => {
    setLoading(true);
    const newVal = !enabled;
    const { error } = await supabase
      .from("client_portal_users")
      .update({ email_notifications_enabled: newVal })
      .eq("id", portalUserId);

    setLoading(false);

    if (error) {
      toast({ title: "Greška", description: "Nije moguće sačuvati podešavanje.", variant: "destructive" });
      return;
    }

    setEnabled(newVal);
    toast({
      title: newVal ? "Email obaveštenja uključena" : "Email obaveštenja isključena",
      description: newVal
        ? "Primićete email kad se otvori novi nalog."
        : "Nećete više primati email obaveštenja o nalozima.",
    });
  };

  return (
    <Button
      variant={enabled ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className="gap-2"
    >
      {enabled ? (
        <>
          <Mail className="h-4 w-4" />
          <span className="hidden sm:inline">Email uključen</span>
        </>
      ) : (
        <>
          <MailX className="h-4 w-4" />
          <span className="hidden sm:inline">Email isključen</span>
        </>
      )}
    </Button>
  );
};
