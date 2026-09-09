import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CtpFilters } from "@/components/stats/CtpFilters";
import { CtpStatsCards } from "@/components/stats/CtpStatsCards";
import { CtpDailyChart } from "@/components/stats/CtpDailyChart";
import { CtpFormatChart } from "@/components/stats/CtpFormatChart";
import { CtpTopClientsTable } from "@/components/stats/CtpTopClientsTable";
import { CtpTopFormatsTable } from "@/components/stats/CtpTopFormatsTable";
import { CtpExportButtons } from "@/components/stats/CtpExportButtons";
import { CtpInventoryForecast } from "@/components/stats/CtpInventoryForecast";
import { CtpFormatConsumption } from "@/components/stats/CtpFormatConsumption";
import { CtpPriceIncreaseAnalysis } from "@/components/stats/CtpPriceIncreaseAnalysis";
import { CtpMonthlyReportCard } from "@/components/stats/CtpMonthlyReportCard";
import { SavedReportsDropdown } from "@/components/stats/SavedReportsDropdown";
import { subDays } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
          <div className="flex items-center gap-4">
            <CtpExportButtons filters={filters} />
            <Button variant="outline" onClick={handleLogout}>
              Odjavi se
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Pregled</TabsTrigger>
            <TabsTrigger value="price-increase">Rast cena</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-4">
            <SavedReportsDropdown filters={filters} onFiltersChange={setFilters} />
            <CtpFilters filters={filters} onFiltersChange={setFilters} />
            <CtpStatsCards filters={filters} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CtpDailyChart filters={filters} />
              <CtpFormatChart filters={filters} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CtpTopClientsTable filters={filters} />
              <CtpTopFormatsTable filters={filters} />
            </div>

            <CtpFormatConsumption filters={filters} />
            <CtpInventoryForecast />
          </TabsContent>

          <TabsContent value="price-increase" className="mt-4">
            <CtpPriceIncreaseAnalysis />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CtpStats;
