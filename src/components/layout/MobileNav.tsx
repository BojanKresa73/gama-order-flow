import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  Menu, 
  Home, 
  FileText, 
  Users, 
  Package, 
  ClipboardList, 
  BarChart3, 
  Settings, 
  LogOut,
  Plus,
  ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthz } from "@/hooks/useAuthz";
import gamaLogo from "@/assets/gama-united-logo.svg";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PriorityNotificationBell } from "@/components/priority/PriorityNotificationBell";

interface MobileNavProps {
  userName?: string;
}

export const MobileNav = ({ userName }: MobileNavProps) => {
  const [open, setOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isSuper, isAdmin } = useAuthz();

  const canViewStats = isSuper || isAdmin;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Odjavljeni ste",
      description: "Uspešno ste se odjavili iz sistema",
    });
    setOpen(false);
    navigate("/");
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { icon: Home, label: "Početna", path: "/dashboard" },
    { icon: FileText, label: "Radni nalozi", path: "/work-orders" },
    { icon: Users, label: "Klijenti", path: "/clients" },
    { icon: Package, label: "Inventar", path: "/inventory" },
    { icon: ClipboardList, label: "Checklist", path: "/checklist" },
  ];

  const quickActions = [
    { label: "Novi CTP nalog", path: "/work-orders/new", color: "bg-primary" },
    { label: "Nova Rolna", path: "/large-format/new?type=roll", color: "bg-orange-500" },
    { label: "Nova Ploča", path: "/large-format/new?type=rigid", color: "bg-teal-500" },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={gamaLogo} alt="Gama United" className="h-10" />
              <SheetTitle className="text-left">Gama United</SheetTitle>
            </div>
            <PriorityNotificationBell />
          </div>
          {userName && (
            <p className="text-sm text-muted-foreground text-left mt-2">{userName}</p>
          )}
        </SheetHeader>

        <div className="flex flex-col h-[calc(100vh-100px)]">
          {/* Quick Actions */}
          <div className="p-4 border-b">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              Brze akcije
            </p>
            <div className="flex flex-col gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.path}
                  variant="outline"
                  className="justify-start"
                  onClick={() => handleNavigate(action.path)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              Navigacija
            </p>
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  variant={isActive(item.path) ? "secondary" : "ghost"}
                  className="justify-start h-12"
                  onClick={() => handleNavigate(item.path)}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.label}
                </Button>
              ))}

              {/* Statistics Submenu */}
              {canViewStats && (
                <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="justify-between w-full h-12">
                      <span className="flex items-center">
                        <BarChart3 className="h-5 w-5 mr-3" />
                        Statistika
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${statsOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-8 flex flex-col gap-1 mt-1">
                    <Button
                      variant={isActive("/stats/ctp") ? "secondary" : "ghost"}
                      className="justify-start h-10"
                      onClick={() => handleNavigate("/stats/ctp")}
                    >
                      CTP statistika
                    </Button>
                    <Button
                      variant={isActive("/stats/digital") ? "secondary" : "ghost"}
                      className="justify-start h-10"
                      onClick={() => handleNavigate("/stats/digital")}
                    >
                      Digitala statistika
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Admin */}
              {isSuper && (
                <Button
                  variant={isActive("/admin/users") ? "secondary" : "ghost"}
                  className="justify-start h-12"
                  onClick={() => handleNavigate("/admin/users")}
                >
                  <Settings className="h-5 w-5 mr-3" />
                  Administracija
                </Button>
              )}
            </div>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t mt-auto">
            <Button
              variant="ghost"
              className="justify-start w-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5 mr-3" />
              Odjavi se
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
