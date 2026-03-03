import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, Calculator, Info, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const OLD_COST = 2.4;
const NEW_COST = 2.7;

// Map format name → area in m²
function formatArea(formatName: string): number {
  const cleaned = formatName.replace("×", "x");
  const parts = cleaned.split("x");
  if (parts.length !== 2) return 0;
  const w = parseFloat(parts[0]);
  const h = parseFloat(parts[1]);
  if (isNaN(w) || isNaN(h)) return 0;
  return (w / 1000) * (h / 1000);
}

interface ClientAnalysis {
  clientId: string;
  clientName: string;
  totalPlates: number;
  totalM2: number;
  currentRevenue: number;
  currentCost: number;
  currentMargin: number;
  currentMarginPct: number;
  newCost: number;
  proposedIncreasePct: number;
  proposedNewRevenue: number;
  proposedNewMargin: number;
  proposedNewMarginPct: number;
  tier: "high" | "medium" | "low";
  formats: Array<{
    formatName: string;
    plates: number;
    currentPrice: number;
    currentPriceMono: number | null;
    proposedPrice: number;
    proposedPriceMono: number | null;
    increasePct: number;
  }>;
}

export const CtpPriceIncreaseAnalysis = () => {
  const [spreadFactor, setSpreadFactor] = useState(2.0); // How much to spread the increase (1 = even, higher = more spread)

  // Fetch all-time file_entries for CTP orders
  const { data: consumptionData, isLoading: loadingConsumption } = useQuery({
    queryKey: ["price-increase-consumption"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("file_entries")
        .select(`
          quantity,
          plate_format_id,
          work_order:work_orders!inner (
            client_id,
            order_type,
            status,
            deleted_at,
            invalidated_at
          )
        `)
        .eq("file_type", "CTP")
        .range(0, 49999);
      if (error) throw error;
      return data as Array<{
        quantity: number | null;
        plate_format_id: string | null;
        work_order: {
          client_id: string;
          order_type: string;
          status: string;
          deleted_at: string | null;
          invalidated_at: string | null;
        };
      }>;
    },
    staleTime: 60000,
  });

  // Fetch clients
  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ["price-increase-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, has_mono_pricing");
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  // Fetch plate formats
  const { data: formats, isLoading: loadingFormats } = useQuery({
    queryKey: ["price-increase-formats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plate_formats")
        .select("id, format_name");
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  // Fetch all client plate prices
  const { data: prices, isLoading: loadingPrices } = useQuery({
    queryKey: ["price-increase-prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_plate_prices")
        .select("client_id, plate_format_id, price_eur, price_eur_mono");
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const isLoading = loadingConsumption || loadingClients || loadingFormats || loadingPrices;

  const analysis = useMemo(() => {
    if (!consumptionData || !clients || !formats || !prices) return null;

    const formatMap = new Map(formats.map(f => [f.id, f.format_name]));
    const clientMap = new Map(clients.map(c => [c.id, c]));
    // price key: clientId-formatId
    const priceMap = new Map(prices.map(p => [`${p.client_id}-${p.plate_format_id}`, p]));

    // Aggregate consumption per client per format
    const clientFormatPlates: Record<string, Record<string, number>> = {};

    for (const entry of consumptionData) {
      const wo = entry.work_order;
      if (!wo || wo.deleted_at || wo.invalidated_at) continue;
      if (wo.order_type !== "ctp") continue;
      const clientId = wo.client_id;
      const formatId = entry.plate_format_id;
      if (!formatId || !entry.quantity) continue;

      if (!clientFormatPlates[clientId]) clientFormatPlates[clientId] = {};
      clientFormatPlates[clientId][formatId] = (clientFormatPlates[clientId][formatId] || 0) + entry.quantity;
    }

    // Calculate total m² per client for ranking
    const clientTotalM2: Record<string, number> = {};
    for (const [clientId, formatPlates] of Object.entries(clientFormatPlates)) {
      let totalM2 = 0;
      for (const [formatId, qty] of Object.entries(formatPlates)) {
        const fname = formatMap.get(formatId);
        if (fname) totalM2 += qty * formatArea(fname);
      }
      clientTotalM2[clientId] = totalM2;
    }

    // Sort clients by volume (descending)
    const sortedClients = Object.entries(clientTotalM2)
      .filter(([, m2]) => m2 > 0)
      .sort(([, a], [, b]) => b - a);

    if (sortedClients.length === 0) return null;

    const maxM2 = sortedClients[0][1];
    const costDeltaPerM2 = NEW_COST - OLD_COST; // 0.30 €/m²

    // Calculate per-client analysis
    const clientAnalyses: ClientAnalysis[] = [];

    for (const [clientId, totalM2] of sortedClients) {
      const client = clientMap.get(clientId);
      if (!client) continue;

      // Volume ratio: 1.0 for highest, approaches 0 for lowest
      const volumeRatio = totalM2 / maxM2;
      
      // Spread factor for distributing the cost increase
      // High volume → lower multiplier, low volume → higher multiplier
      const rawFactor = 1 + spreadFactor * (1 - volumeRatio);
      const normFactor = 1 + spreadFactor * 0.5;
      const clientMultiplier = rawFactor / normFactor;

      // Determine tier
      const tier: "high" | "medium" | "low" = volumeRatio > 0.3 ? "high" : volumeRatio > 0.05 ? "medium" : "low";

      const formatEntries = clientFormatPlates[clientId] || {};
      let totalPlates = 0;
      let currentRevenue = 0;
      let currentCost = 0;
      let proposedRevenue = 0;

      const formatDetails: ClientAnalysis["formats"] = [];

      for (const [formatId, qty] of Object.entries(formatEntries)) {
        totalPlates += qty;
        const fname = formatMap.get(formatId) || "?";
        const area = formatArea(fname); // m² per plate
        const price = priceMap.get(`${clientId}-${formatId}`);
        const currentPriceEur = price ? Number(price.price_eur) : 0;
        const currentPriceMono = price?.price_eur_mono ? Number(price.price_eur_mono) : null;
        
        const entryRevenue = qty * currentPriceEur;
        const entryCost = qty * area * OLD_COST;
        currentRevenue += entryRevenue;
        currentCost += entryCost;

        // Only increase by the MATERIAL cost delta per plate, weighted by spread
        // materialDelta = area × 0.30 €/m² × clientMultiplier
        const materialDeltaPerPlate = area * costDeltaPerM2 * clientMultiplier;

        const proposedPrice = currentPriceEur > 0 
          ? Math.round((currentPriceEur + materialDeltaPerPlate) * 100) / 100 
          : 0;
        const proposedPriceMono = currentPriceMono !== null && currentPriceMono > 0
          ? Math.round((currentPriceMono + materialDeltaPerPlate) * 100) / 100
          : null;
        
        const increasePct = currentPriceEur > 0 ? (materialDeltaPerPlate / currentPriceEur) * 100 : 0;
        proposedRevenue += qty * proposedPrice;

        if (currentPriceEur > 0) {
          formatDetails.push({
            formatName: fname,
            plates: qty,
            currentPrice: currentPriceEur,
            currentPriceMono,
            proposedPrice,
            proposedPriceMono,
            increasePct,
          });
        }
      }

      const newCost = totalM2 * NEW_COST;

      if (currentRevenue > 0) {
        clientAnalyses.push({
          clientId,
          clientName: client.name,
          totalPlates,
          totalM2,
          currentRevenue,
          currentCost,
          currentMargin: currentRevenue - currentCost,
          currentMarginPct: ((currentRevenue - currentCost) / currentRevenue) * 100,
          newCost,
          proposedIncreasePct: currentRevenue > 0 ? ((proposedRevenue - currentRevenue) / currentRevenue) * 100 : 0,
          proposedNewRevenue: proposedRevenue,
          proposedNewMargin: proposedRevenue - newCost,
          proposedNewMarginPct: ((proposedRevenue - newCost) / proposedRevenue) * 100,
          tier,
          formats: formatDetails.sort((a, b) => b.plates - a.plates),
        });
      }
    }

    // Summary stats
    const totalCurrentRevenue = clientAnalyses.reduce((s, c) => s + c.currentRevenue, 0);
    const totalCurrentCost = clientAnalyses.reduce((s, c) => s + c.currentCost, 0);
    const totalNewCost = clientAnalyses.reduce((s, c) => s + c.newCost, 0);
    const totalProposedRevenue = clientAnalyses.reduce((s, c) => s + c.proposedNewRevenue, 0);
    const totalAdditionalCost = totalNewCost - totalCurrentCost;
    const totalAdditionalRevenue = totalProposedRevenue - totalCurrentRevenue;

    return {
      clients: clientAnalyses,
      summary: {
        totalCurrentRevenue,
        totalCurrentCost,
        totalCurrentMargin: totalCurrentRevenue - totalCurrentCost,
        totalNewCost,
        totalProposedRevenue,
        totalProposedMargin: totalProposedRevenue - totalNewCost,
        totalAdditionalCost,
        totalAdditionalRevenue,
        costCoverage: totalAdditionalCost > 0 ? (totalAdditionalRevenue / totalAdditionalCost) * 100 : 0,
        avgIncreasePct: ((NEW_COST - OLD_COST) / OLD_COST) * 100,
      },
    };
  }, [consumptionData, clients, formats, prices, spreadFactor]);

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Rast cena — Analiza
          </CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-[400px] w-full" /></CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Rast cena — Analiza
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Nema dovoljno podataka za analizu</p>
        </CardContent>
      </Card>
    );
  }

  const { summary, clients: clientData } = analysis;

  const fmt = (n: number, d = 2) =>
    n.toLocaleString("sr-RS", { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <Card className="rounded-2xl shadow-sm border-orange-200 dark:border-orange-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            Rast cena ploča — Analiza kompenzacije
          </CardTitle>
          <CardDescription>
            Nabavna cena raste sa {fmt(OLD_COST)} €/m² na {fmt(NEW_COST)} €/m² (+{fmt(((NEW_COST - OLD_COST) / OLD_COST) * 100, 1)}%).
            Predlog raspodele: manji rast za velike klijente, veći za manje.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Scenario: bez povećanja cena */}
          <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <ArrowDownRight className="h-5 w-5 text-destructive" />
              <p className="font-semibold text-destructive">Scenario: BEZ povećanja cena</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Trenutna marža (stara nabavka)</p>
                <p className="text-lg font-bold">{fmt(summary.totalCurrentMargin)} €</p>
                <p className="text-xs text-muted-foreground">
                  ({fmt(summary.totalCurrentRevenue > 0 ? (summary.totalCurrentMargin / summary.totalCurrentRevenue * 100) : 0, 1)}%)
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dodatni godišnji trošak</p>
                <p className="text-lg font-bold text-destructive">+{fmt(summary.totalAdditionalCost)} €</p>
                <p className="text-xs text-muted-foreground">({fmt(NEW_COST)} - {fmt(OLD_COST)}) × {fmt(clientData.reduce((s, c) => s + c.totalM2, 0), 1)} m²</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nova marža BEZ povećanja</p>
                <p className="text-lg font-bold text-destructive">{fmt(summary.totalCurrentRevenue - summary.totalNewCost)} €</p>
                <p className="text-xs text-muted-foreground">
                  ({fmt(summary.totalCurrentRevenue > 0 ? ((summary.totalCurrentRevenue - summary.totalNewCost) / summary.totalCurrentRevenue * 100) : 0, 1)}%)
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pad marže</p>
                <p className="text-lg font-bold text-destructive">
                  -{fmt(summary.totalCurrentMargin - (summary.totalCurrentRevenue - summary.totalNewCost))} €
                </p>
                <p className="text-xs text-muted-foreground">
                  -{fmt(summary.totalCurrentRevenue > 0 ? ((summary.totalCurrentMargin - (summary.totalCurrentRevenue - summary.totalNewCost)) / summary.totalCurrentMargin * 100) : 0, 1)}% od trenutne marže
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Potrebno mesečno pokriće</p>
                <p className="text-lg font-bold text-orange-600">{fmt(summary.totalAdditionalCost / 12)} €/mes</p>
                <p className="text-xs text-muted-foreground">ako se ne povećaju cene</p>
              </div>
            </div>
          </div>

          {/* Scenario: sa povećanjem */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Dodatni trošak</p>
              <p className="text-xl font-bold text-destructive">+{fmt(summary.totalAdditionalCost)} €</p>
              <p className="text-xs text-muted-foreground">zbog rasta nabavne cene</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Predloženi dodatni prihod</p>
              <p className="text-xl font-bold text-green-600">+{fmt(summary.totalAdditionalRevenue)} €</p>
              <p className="text-xs text-muted-foreground">sa novim cenama</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Pokrivenost troška</p>
              <p className="text-xl font-bold">{fmt(summary.costCoverage, 1)}%</p>
              <p className="text-xs text-muted-foreground">dodatnog prihoda / troška</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Nova ukupna marža</p>
              <p className="text-xl font-bold">{fmt(summary.totalProposedMargin)} €</p>
              <p className="text-xs text-muted-foreground">
                ({fmt(summary.totalProposedRevenue > 0 ? ((summary.totalProposedMargin / summary.totalProposedRevenue) * 100) : 0, 1)}%)
              </p>
            </div>
          </div>

          {/* Spread control */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium whitespace-nowrap">Faktor raspodele:</Label>
            </div>
            <Slider
              value={[spreadFactor]}
              onValueChange={([v]) => setSpreadFactor(v)}
              min={0}
              max={5}
              step={0.1}
              className="flex-1"
            />
            <span className="text-sm font-mono font-medium w-8 text-right">{spreadFactor.toFixed(1)}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>0 = svi klijenti dobijaju isti % rasta. Veći faktor = veća razlika između velikih i malih klijenata.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Tier summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["high", "medium", "low"] as const).map((tier) => {
          const tierClients = clientData.filter(c => c.tier === tier);
          const avgIncrease = tierClients.length > 0 
            ? tierClients.reduce((s, c) => s + c.proposedIncreasePct, 0) / tierClients.length
            : 0;
          const tierLabel = tier === "high" ? "Veliki klijenti" : tier === "medium" ? "Srednji klijenti" : "Mali klijenti";
          const tierColor = tier === "high" ? "text-green-600" : tier === "medium" ? "text-orange-600" : "text-red-600";
          const tierBg = tier === "high" ? "border-green-200 dark:border-green-800" : tier === "medium" ? "border-orange-200 dark:border-orange-800" : "border-red-200 dark:border-red-800";
          return (
            <Card key={tier} className={`rounded-2xl shadow-sm ${tierBg}`}>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{tierLabel}</p>
                <p className="text-2xl font-bold">{tierClients.length} klijenata</p>
                <p className={`text-sm font-medium ${tierColor}`}>
                  Prosečan rast: +{fmt(avgIncrease, 1)}%
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Per-client table */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Detaljan pregled po klijentima</CardTitle>
          <CardDescription>Kliknite na klijenta za pregled cena po formatima</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Klijent</TableHead>
                  <TableHead className="text-right">Ploča ukupno</TableHead>
                  <TableHead className="text-right">m²</TableHead>
                  <TableHead className="text-right">Prosečna cena (€)</TableHead>
                  <TableHead className="text-right">Nova cena (€)</TableHead>
                  <TableHead className="text-right">Trenutni prihod (€)</TableHead>
                  <TableHead className="text-right">Trenutna marža</TableHead>
                  <TableHead className="text-center">Rast %</TableHead>
                  <TableHead className="text-right">Novi prihod (€)</TableHead>
                  <TableHead className="text-right">Nova marža</TableHead>
                  <TableHead className="text-center">Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientData.map((client, idx) => (
                  <>
                    <TableRow 
                      key={client.clientId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedClient(expandedClient === client.clientId ? null : client.clientId)}
                    >
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-medium">{client.clientName}</TableCell>
                      <TableCell className="text-right">{client.totalPlates.toLocaleString("sr-RS")}</TableCell>
                      <TableCell className="text-right">{fmt(client.totalM2, 1)}</TableCell>
                      <TableCell className="text-right">{client.totalPlates > 0 ? fmt(client.currentRevenue / client.totalPlates) : "—"}</TableCell>
                      <TableCell className="text-right font-medium text-orange-600">{client.totalPlates > 0 ? fmt(client.proposedNewRevenue / client.totalPlates) : "—"}</TableCell>
                      <TableCell className="text-right">{fmt(client.currentRevenue)}</TableCell>
                      <TableCell className="text-right">
                        <span className={client.currentMarginPct > 30 ? "text-green-600" : client.currentMarginPct > 15 ? "text-orange-600" : "text-red-600"}>
                          {fmt(client.currentMarginPct, 1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={client.proposedIncreasePct < 10 ? "secondary" : client.proposedIncreasePct < 15 ? "default" : "destructive"}>
                          <ArrowUpRight className="h-3 w-3 mr-1" />
                          +{fmt(client.proposedIncreasePct, 1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt(client.proposedNewRevenue)}</TableCell>
                      <TableCell className="text-right">
                        <span className={client.proposedNewMarginPct > 30 ? "text-green-600" : client.proposedNewMarginPct > 15 ? "text-orange-600" : "text-red-600"}>
                          {fmt(client.proposedNewMarginPct, 1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={
                          client.tier === "high" ? "border-green-500 text-green-700 dark:text-green-400" :
                          client.tier === "medium" ? "border-orange-500 text-orange-700 dark:text-orange-400" :
                          "border-red-500 text-red-700 dark:text-red-400"
                        }>
                          {client.tier === "high" ? "Veliki" : client.tier === "medium" ? "Srednji" : "Mali"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {/* Expanded format details */}
                    {expandedClient === client.clientId && client.formats.length > 0 && (
                      <TableRow key={`${client.clientId}-detail`}>
                        <TableCell colSpan={12} className="bg-muted/30 p-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Format</TableHead>
                                <TableHead className="text-right">Ploča</TableHead>
                                <TableHead className="text-right">Trenutna cena (€)</TableHead>
                                <TableHead className="text-right">Trenutna mono (€)</TableHead>
                                <TableHead className="text-right">Nova cena (€)</TableHead>
                                <TableHead className="text-right">Nova mono (€)</TableHead>
                                <TableHead className="text-right">Rast</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {client.formats.map(f => (
                                <TableRow key={f.formatName}>
                                  <TableCell className="font-medium">{f.formatName}</TableCell>
                                  <TableCell className="text-right">{f.plates.toLocaleString("sr-RS")}</TableCell>
                                  <TableCell className="text-right">{fmt(f.currentPrice)}</TableCell>
                                  <TableCell className="text-right">{f.currentPriceMono !== null ? fmt(f.currentPriceMono) : "—"}</TableCell>
                                  <TableCell className="text-right font-medium text-orange-600">{fmt(f.proposedPrice)}</TableCell>
                                  <TableCell className="text-right font-medium text-orange-600">{f.proposedPriceMono !== null ? fmt(f.proposedPriceMono) : "—"}</TableCell>
                                  <TableCell className="text-right">+{fmt(f.increasePct, 1)}%</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
                {/* Total row */}
                <TableRow className="bg-muted/50 font-bold border-t-2">
                  <TableCell colSpan={2} className="font-bold">UKUPNO</TableCell>
                  <TableCell className="text-right font-bold">
                    {clientData.reduce((s, c) => s + c.totalPlates, 0).toLocaleString("sr-RS")}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {fmt(clientData.reduce((s, c) => s + c.totalM2, 0), 1)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {(() => { const tp = clientData.reduce((s, c) => s + c.totalPlates, 0); return tp > 0 ? fmt(summary.totalCurrentRevenue / tp) : "—"; })()}
                  </TableCell>
                  <TableCell className="text-right font-bold text-orange-600">
                    {(() => { const tp = clientData.reduce((s, c) => s + c.totalPlates, 0); return tp > 0 ? fmt(summary.totalProposedRevenue / tp) : "—"; })()}
                  </TableCell>
                  <TableCell className="text-right font-bold">{fmt(summary.totalCurrentRevenue)}</TableCell>
                  <TableCell className="text-right font-bold">
                    {fmt(summary.totalCurrentRevenue > 0 ? ((summary.totalCurrentMargin / summary.totalCurrentRevenue) * 100) : 0, 1)}%
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-bold">{fmt(summary.totalProposedRevenue)}</TableCell>
                  <TableCell className="text-right font-bold">
                    {fmt(summary.totalProposedRevenue > 0 ? ((summary.totalProposedMargin / summary.totalProposedRevenue) * 100) : 0, 1)}%
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
