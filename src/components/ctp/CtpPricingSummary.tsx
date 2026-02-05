 import { useMemo } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Euro } from "lucide-react";
 
 interface FileEntry {
   id: string;
   filename: string;
   plate_format_id: string | null;
   quantity: number | null;
   format_name?: string;
 }
 
 interface ClientPlatePrice {
   plate_format_id: string;
   format_name?: string;
   price_eur: number;
   price_eur_mono?: number | null;
 }
 
 interface CtpPricingSummaryProps {
   fileEntries: FileEntry[];
   clientPlatePrices: ClientPlatePrice[];
   hasMonoPricing: boolean;
 }
 
 export function CtpPricingSummary({ 
   fileEntries, 
   clientPlatePrices, 
   hasMonoPricing 
 }: CtpPricingSummaryProps) {
   const pricing = useMemo(() => {
     if (clientPlatePrices.length === 0 || fileEntries.length === 0) {
       return null;
     }
 
     // Create a map of plate_format_id -> prices
     const priceMap = new Map<string, { color: number; mono: number | null }>();
     for (const p of clientPlatePrices) {
       priceMap.set(p.plate_format_id, {
         color: p.price_eur,
         mono: p.price_eur_mono ?? null,
       });
     }
 
     let totalPrice = 0;
     let totalPlates = 0;
     let monoPlates = 0;
     let colorPlates = 0;
     let hasMissingPrice = false;
 
     for (const entry of fileEntries) {
       if (!entry.plate_format_id || !entry.quantity) continue;
       
       const prices = priceMap.get(entry.plate_format_id);
       if (!prices) {
         hasMissingPrice = true;
         continue;
       }
 
       const qty = entry.quantity;
       totalPlates += qty;
 
       // Mono pricing logic: 1 plate = mono, 2+ plates = color
       const isMono = hasMonoPricing && qty === 1 && prices.mono !== null;
       
       if (isMono) {
         monoPlates += qty;
         totalPrice += qty * (prices.mono || prices.color);
       } else {
         colorPlates += qty;
         totalPrice += qty * prices.color;
       }
     }
 
     if (totalPlates === 0) return null;
 
     return {
       totalPrice,
       totalPlates,
       monoPlates,
       colorPlates,
       hasMissingPrice,
     };
   }, [fileEntries, clientPlatePrices, hasMonoPricing]);
 
   if (!pricing) {
     return (
       <Card className="border-dashed border-muted-foreground/30">
         <CardContent className="py-4">
           <p className="text-sm text-muted-foreground text-center">
             Klijent nema definisane cene ploča
           </p>
         </CardContent>
       </Card>
     );
   }
 
   return (
     <Card className="bg-primary/5 border-primary/20">
       <CardHeader className="pb-2">
         <CardTitle className="text-base flex items-center gap-2">
           <Euro className="h-4 w-4" />
           Kalkulacija CTP
         </CardTitle>
       </CardHeader>
       <CardContent className="space-y-2">
         <div className="flex justify-between items-center">
           <span className="text-sm text-muted-foreground">Ukupno ploča:</span>
           <span className="font-medium">{pricing.totalPlates} kom</span>
         </div>
         
         {hasMonoPricing && (pricing.monoPlates > 0 || pricing.colorPlates > 0) && (
           <div className="flex justify-between items-center text-sm">
             <span className="text-muted-foreground">Mono / Kolor:</span>
             <span className="font-medium">
               {pricing.monoPlates} CB / {pricing.colorPlates} kolor
             </span>
           </div>
         )}
         
         <div className="flex justify-between items-center pt-2 border-t">
           <span className="font-medium">Ukupna cena:</span>
           <span className="text-lg font-bold text-primary">
             {pricing.totalPrice.toFixed(2)} EUR
           </span>
         </div>
         
         {pricing.hasMissingPrice && (
           <p className="text-xs text-orange-600 mt-2">
             ⚠ Neke ploče nemaju definisanu cenu za ovog klijenta
           </p>
         )}
       </CardContent>
     </Card>
   );
 }