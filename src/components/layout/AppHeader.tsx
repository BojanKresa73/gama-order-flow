import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthz } from "@/hooks/useAuthz";
import gamaLogo from "@/assets/gama-united-logo.svg";
import { MobileNav } from "./MobileNav";

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
      <div className="container mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <MobileNav userName={userName} />
          <img 
            src={gamaLogo} 
            alt="Gama United" 
            className="h-10 md:h-14 cursor-pointer" 
            onClick={() => navigate("/dashboard")}
          />
          <h1 className="text-lg md:text-2xl font-bold hidden sm:block">
            {title || "Radni nalozi - Gama United"}
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-4">
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
