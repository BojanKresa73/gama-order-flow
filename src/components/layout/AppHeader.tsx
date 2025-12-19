import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthz } from "@/hooks/useAuthz";
import gamaLogo from "@/assets/gama-united-logo.svg";


interface AppHeaderProps {
  userName?: string;
  showBackButton?: boolean;
  title?: string;
}

export const AppHeader = ({ userName, showBackButton, title }: AppHeaderProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuper } = useAuthz();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Odjavljeni ste",
      description: "Uspešno ste se odjavili iz sistema",
    });
    navigate("/");
  };

  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <img 
            src={gamaLogo} 
            alt="Gama United" 
            className="h-14 cursor-pointer" 
            onClick={() => navigate("/dashboard")}
          />
          <h1 className="text-2xl font-bold">
            {title || "Radni nalozi - Gama United"}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{userName}</span>
          {isSuper && (
            <Button variant="outline" onClick={() => navigate("/admin/users")}>
              Administracija
            </Button>
          )}
          <Button variant="outline" onClick={handleLogout}>
            Odjavi se
          </Button>
        </div>
      </div>
    </header>
  );
};
