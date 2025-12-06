import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { subDays } from "date-fns";
import { ChevronLeft, Printer } from "lucide-react";
import { DigitalFilters } from "@/components/stats/digital/DigitalFilters";
import { DigitalStatsCards } from "@/components/stats/digital/DigitalStatsCards";
import { DigitalDailyChart } from "@/components/stats/digital/DigitalDailyChart";
import { DigitalPrintSidesChart } from "@/components/stats/digital/DigitalPrintSidesChart";
import { DigitalTopClientsTable } from "@/components/stats/digital/DigitalTopClientsTable";
import { DigitalPaperTypesTable } from "@/components/stats/digital/DigitalPaperTypesTable";
import { DigitalFormatsChart } from "@/components/stats/digital/DigitalFormatsChart";
import { DigitalExportButtons } from "@/components/stats/digital/DigitalExportButtons";

export interface DigitalFiltersState {
  dateRange: {
    from: Date;
    to: Date;
  };
  clientIds: string[];
  printSides: string[];
  paperTypes: string[];
  sheetFormats: string[];
}

const DigitalStats = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<DigitalFiltersState>({
    dateRange: {
      from: subDays(new Date(), 30),
      to: new Date(),
    },
    clientIds: [],
    printSides: [],
    paperTypes: [],
    sheetFormats: [],
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
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
                <Printer className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Statistika Digitalne Štampe
                </h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <DigitalExportButtons filters={filters} />
            <Button variant="outline" onClick={handleLogout}>
              Odjavi se
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <DigitalFilters filters={filters} onFiltersChange={setFilters} />
        <DigitalStatsCards filters={filters} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DigitalDailyChart filters={filters} />
          <DigitalPrintSidesChart filters={filters} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <DigitalTopClientsTable filters={filters} />
          </div>
          <DigitalFormatsChart filters={filters} />
        </div>

        <DigitalPaperTypesTable filters={filters} />
      </main>
    </div>
  );
};

export default DigitalStats;
