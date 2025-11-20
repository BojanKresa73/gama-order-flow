import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Boxes, Mail } from "lucide-react";
import { useAuthz } from "@/hooks/useAuthz";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export default function AdminSection() {
  const nav = useNavigate();
  const { isSuper, isAdmin } = useAuthz();
  const [testingEmail, setTestingEmail] = useState(false);

  const handleTestEmail = async () => {
    try {
      setTestingEmail(true);
      
      // Prompt for email address
      const email = prompt('Unesite email adresu za test:');
      if (!email) {
        toast.info('Test obustavljen');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error('Nevažeća email adresa');
        return;
      }

      toast.loading('Šaljem test email...', { id: 'test-email' });

      const { data, error } = await supabase.functions.invoke('test-email', {
        body: { to: email }
      });

      if (error) {
        console.error('[test-email] Error:', error);
        toast.error(`Greška: ${error.message}`, { id: 'test-email' });
        return;
      }

      if (data?.ok || data?.success) {
        toast.success(`Test email uspešno poslat na ${email}!`, { id: 'test-email' });
      } else {
        toast.error(data?.error || 'Nepoznata greška', { id: 'test-email' });
      }
    } catch (error: any) {
      console.error('[test-email] Exception:', error);
      toast.error(`Izuzetak: ${error.message}`, { id: 'test-email' });
    } finally {
      setTestingEmail(false);
    }
  };

  if (!isSuper && !isAdmin) return null;

  return (
    <Card className="col-span-12 xl:col-span-4 shadow-md">
      <CardHeader className="flex flex-row items-center gap-2">
        <Shield className="h-5 w-5" />
        <CardTitle>Administracija</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <Button
          variant="default"
          className="h-20 flex-col gap-2"
          onClick={() => nav("/admin/users")}
        >
          <Users className="h-6 w-6" />
          <span className="font-semibold">Korisnici</span>
        </Button>

        <Button
          variant="outline"
          className="h-20 flex-col gap-2"
          onClick={() => nav("/admin/inventory")}
        >
          <Boxes className="h-6 w-6" />
          <span className="font-semibold">Inventar</span>
        </Button>

        <Button
          variant="secondary"
          className="h-20 flex-col gap-2 col-span-2"
          onClick={handleTestEmail}
          disabled={testingEmail}
        >
          <Mail className="h-6 w-6" />
          <span className="font-semibold">Test Email</span>
        </Button>
      </CardContent>
    </Card>
  );
}
