import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Boxes, CloudUpload, Loader2 } from "lucide-react";
import { useAuthz } from "@/hooks/useAuthz";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function AdminSection() {
  const nav = useNavigate();
  const { isSuper, isAdmin } = useAuthz();
  const { toast } = useToast();
  const [isBackingUp, setIsBackingUp] = useState(false);

  if (!isSuper && !isAdmin) return null;

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('backup-to-gdrive');
      
      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: "Backup uspešan",
          description: `Fajl ${data.fileName} uploadovan na Google Drive`,
        });
      } else {
        throw new Error(data?.error || 'Backup nije uspeo');
      }
    } catch (error: unknown) {
      console.error('Backup error:', error);
      toast({
        title: "Greška pri backup-u",
        description: error instanceof Error ? error.message : 'Nepoznata greška',
        variant: "destructive",
      });
    } finally {
      setIsBackingUp(false);
    }
  };

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
          variant="outline"
          className="h-20 flex-col gap-2 col-span-2"
          onClick={handleBackup}
          disabled={isBackingUp}
        >
          {isBackingUp ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <CloudUpload className="h-6 w-6" />
          )}
          <span className="font-semibold">
            {isBackingUp ? "Backup u toku..." : "Backup na Google Drive"}
          </span>
        </Button>
      </CardContent>
    </Card>
  );
}