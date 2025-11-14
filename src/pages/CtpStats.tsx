import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CtpFilters } from "@/components/stats/CtpFilters";
import { CtpStatsCards } from "@/components/stats/CtpStatsCards";
import { subDays } from "date-fns";
import { ChevronLeft } from "lucide-react";

export interface CtpFiltersState {
  dateRange: {
    from: Date;
    to: Date;
  };
  clientIds: string[];
  plateFormatIds: string[];
}

const CtpStats = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<CtpFiltersState>({
    dateRange: {
      from: subDays(new Date(), 30),
      to: new Date(),
    },
    clientIds: [],
    plateFormatIds: [],
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">CTP Statistika</h1>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Odjavi se
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <CtpFilters filters={filters} onFiltersChange={setFilters} />
        <CtpStatsCards filters={filters} />
      </main>
    </div>
  );
};

export default CtpStats;
