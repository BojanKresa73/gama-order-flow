import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthz } from "@/hooks/useAuthz";
import { useIsMobile } from "@/hooks/use-mobile";
import gamaLogo from "@/assets/gama-united-logo.svg";
import { MobileNav } from "./MobileNav";
import { PriorityNotificationBell } from "@/components/priority/PriorityNotificationBell";
import { Flag, Calculator, UserCog, FileText } from "lucide-react";
import { QuickPriceCalculator } from "@/components/calculator/QuickPriceCalculator";
import { ProfileSettingsDialog } from "@/components/profile/ProfileSettingsDialog";


interface AppHeaderProps {
  userName?: string;
  showBackButton?: boolean;
  title?: string;
}

export const AppHeader = ({ userName, showBackButton, title }: AppHeaderProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuper, isAdmin, isLoading: isAuthzLoading } = useAuthz();
  const isMobile = useIsMobile();
  const [quickCalcOpen, setQuickCalcOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
      <div className="container mx-auto px-3 md:px-4 py-3 md:py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile hamburger menu */}
          <MobileNav userName={userName} />
          
          <img 
            src={gamaLogo} 
            alt="Gama United" 
            className="h-10 md:h-14 cursor-pointer" 
            onClick={() => navigate("/dashboard")}
          />
          <h1 className="text-lg md:text-2xl font-bold hidden sm:block">
            {title || "Radni nalozi"}
          </h1>
        </div>
        
        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-4">
          <PriorityNotificationBell />
          <span className="text-sm text-muted-foreground">{userName}</span>

          {!isAuthzLoading && isAdmin && (
            <Button
              variant="outline"
              className="border-primary/50 text-primary hover:bg-primary/10"
              onClick={() => setQuickCalcOpen(true)}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Brzi kalkulator
            </Button>
          )}

          {!isAuthzLoading && isAdmin && (
            <Button variant="outline" onClick={() => navigate("/quotes")}>
              <FileText className="h-4 w-4 mr-2" />
              Ponude
            </Button>
          )}

          {!isAuthzLoading && isAdmin && (
            <Button variant="outline" onClick={() => navigate("/admin/priority")}>
              <Flag className="h-4 w-4 mr-2" />
              Prioritet
            </Button>
          )}


          {isSuper && (
            <Button variant="outline" onClick={() => navigate("/reklamacije")}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Reklamacije
            </Button>
          )}

          {isSuper && (
            <Button variant="outline" onClick={() => navigate("/admin/users")}>
              Administracija
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => setProfileOpen(true)} title="Podešavanja profila">
            <UserCog className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            Odjavi se
          </Button>
        </div>
      </div>

      <ProfileSettingsDialog open={profileOpen} onOpenChange={setProfileOpen} />

      {!isAuthzLoading && isAdmin && (
        <QuickPriceCalculator
          open={quickCalcOpen}
          onOpenChange={setQuickCalcOpen}
          hideTrigger
        />
      )}
    </header>
  );
};
