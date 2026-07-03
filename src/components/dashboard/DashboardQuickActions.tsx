import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3, ChevronDown, Mail, Palmtree, Calculator } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthz } from "@/hooks/useAuthz";
import { QuickPriceCalculator } from "@/components/calculator/QuickPriceCalculator";

interface DashboardQuickActionsProps {
  canViewStats: boolean;
  isSuper?: boolean;
}

export const DashboardQuickActions = ({ canViewStats, isSuper }: DashboardQuickActionsProps) => {
  const navigate = useNavigate();
  const { isAdmin } = useAuthz();
  const [quickCalcOpen, setQuickCalcOpen] = useState(false);

  return (
    <>
      {/* Mobile Quick Actions */}
      <div className="grid grid-cols-2 md:hidden gap-2">
        <Button size="sm" className="w-full" onClick={() => navigate("/work-orders/new")}>
          + Novi nalog
        </Button>
        <Button size="sm" variant="secondary" className="w-full" onClick={() => navigate("/work-orders")}>
          <FileText className="h-4 w-4 mr-1" />
          Nalozi
        </Button>
        <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/large-format/new?type=roll")}>
          + Rolna
        </Button>
        <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/large-format/new?type=rigid")}>
          + Ploča
        </Button>
        <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/nabavka")}>
          Nabavka
        </Button>
        <Button size="sm" variant="outline" className="w-full col-span-2" onClick={() => navigate("/vacations")}>
          <Palmtree className="h-4 w-4 mr-1" />
          Godišnji odmori
        </Button>
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            className="w-full col-span-2 border-primary/40 text-primary"
            onClick={() => setQuickCalcOpen(true)}
          >
            <Calculator className="h-4 w-4 mr-1" />
            Brzi kalkulator
          </Button>
        )}
      </div>

      {/* Desktop Quick Actions */}
      <div className="hidden md:flex items-center gap-2 flex-wrap">
        <Button onClick={() => navigate("/work-orders/new")}>
          + Novi nalog
        </Button>
        <Button variant="outline" onClick={() => navigate("/large-format/new?type=roll")}>
          + Rolna
        </Button>
        <Button variant="outline" onClick={() => navigate("/large-format/new?type=rigid")}>
          + Ploča
        </Button>
        <Button variant="secondary" onClick={() => navigate("/work-orders")}>
          <FileText className="h-4 w-4 mr-2" />
          Svi nalozi
        </Button>
        <Button variant="outline" onClick={() => navigate("/clients")}>
          Klijenti
        </Button>
        <Button variant="outline" onClick={() => navigate("/inventory")}>
          Inventar
        </Button>
        <Button variant="outline" onClick={() => navigate("/nabavka")}>
          Nabavka
        </Button>
        <Button variant="outline" onClick={() => navigate("/checklist")}>
          Checklist
        </Button>
        <Button variant="outline" onClick={() => navigate("/vacations")}>
          <Palmtree className="h-4 w-4 mr-2" />
          Godišnji odmori
        </Button>
        <Button variant="outline" onClick={() => navigate("/reports/delivery-notes")}>
          <FileText className="h-4 w-4 mr-2" />
          Izveštaj otpremnica
        </Button>
        {canViewStats && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <BarChart3 className="h-4 w-4 mr-2" />
                Statistika
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background">
              <DropdownMenuItem onClick={() => navigate("/stats/ctp")}>
                CTP statistika
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/stats/digital")}>
                Digitala statistika
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {isSuper && (
          <Button variant="outline" onClick={() => navigate("/admin/newsletter")}>
            <Mail className="h-4 w-4 mr-2" />
            Newsletter
          </Button>
        )}
      </div>
    </>
  );
};
