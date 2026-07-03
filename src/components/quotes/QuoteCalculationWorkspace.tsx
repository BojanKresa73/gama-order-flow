import { useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MaterialsCostPanel } from "@/components/quotes/MaterialsCostPanel";
import { WasteOptimizer } from "@/components/quotes/WasteOptimizer";
import { DigitalWorkspacePanel } from "@/components/quotes/DigitalWorkspacePanel";
import type { QuoteItem } from "@/hooks/useQuotesPro";

interface Props {
  quoteId: string;
  items: QuoteItem[];
  defaultMarkupPercent: number;
}

/**
 * QuoteCalculationWorkspace — jedan orkestrator za sve „radne" panele
 * ponude (materijali, digital, otpad). Zamena za odvojene sekcije koje su
 * ranije bile scattered po QuoteDetails.
 */
export function QuoteCalculationWorkspace({ quoteId, items, defaultMarkupPercent }: Props) {
  const [tab, setTab] = useState<"materials" | "digital" | "waste">("materials");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4" /> Radna površina kalkulacije
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="materials">Materijali</TabsTrigger>
            <TabsTrigger value="digital">Digital</TabsTrigger>
            <TabsTrigger value="waste">Otpad</TabsTrigger>
          </TabsList>
          <TabsContent value="materials" className="mt-4">
            <MaterialsCostPanel
              quoteId={quoteId}
              items={items}
              defaultMarkupPercent={defaultMarkupPercent}
            />
          </TabsContent>
          <TabsContent value="digital" className="mt-4">
            <DigitalWorkspacePanel quoteId={quoteId} items={items} />
          </TabsContent>
          <TabsContent value="waste" className="mt-4">
            <WasteOptimizer />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
