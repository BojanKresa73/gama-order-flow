import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NbsRate {
  currency: string;
  middleRate: number;
  date: string;
  source?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Fetching NBS EUR exchange rate...');
    
    let eurRate: number | null = null;
    let rateDate: string = new Date().toISOString().split('T')[0];
    let source: string = 'fallback';

    // Metod 1: Frankfurter API (ECB rates, najbrži i najpouzdaniji)
    try {
      console.log('Trying frankfurter.app API...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
      
      const frankfurterResponse = await fetch('https://api.frankfurter.app/latest?from=EUR&to=RSD', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (frankfurterResponse.ok) {
        const data = await frankfurterResponse.json();
        if (data.rates && data.rates.RSD) {
          eurRate = data.rates.RSD;
          rateDate = data.date || rateDate;
          source = 'frankfurter.app (ECB)';
          console.log('Got rate from frankfurter:', eurRate);
        }
      }
    } catch (e) {
      console.warn('frankfurter.app failed:', e);
    }

    // Metod 2: ExchangeRate-API (alternativa)
    if (!eurRate || eurRate < 100 || eurRate > 130) {
      try {
        console.log('Trying exchangerate-api...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const exchangeResponse = await fetch('https://open.er-api.com/v6/latest/EUR', {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (exchangeResponse.ok) {
          const data = await exchangeResponse.json();
          if (data.rates && data.rates.RSD) {
            eurRate = data.rates.RSD;
            // Parse date properly - time_last_update_utc is like "Mon, 02 Feb 2026 00:02:31 +0000"
            if (data.time_last_update_utc) {
              const parsedDate = new Date(data.time_last_update_utc);
              if (!isNaN(parsedDate.getTime())) {
                rateDate = parsedDate.toISOString().split('T')[0];
              }
            }
            source = 'exchangerate-api';
            console.log('Got rate from exchangerate-api:', eurRate);
          }
        }
      } catch (e) {
        console.warn('exchangerate-api failed:', e);
      }
    }

    // Fallback: Hardcoded rate (ažurirati povremeno)
    if (!eurRate || isNaN(eurRate) || eurRate < 100 || eurRate > 130) {
      console.warn('All APIs failed, using fallback rate');
      eurRate = 117.1167;
      source = 'fallback (please update)';
    }

    // Format to exactly 4 decimal places
    const formattedRate = Number(eurRate.toFixed(4));

    const result: NbsRate = {
      currency: 'EUR',
      middleRate: formattedRate,
      date: rateDate,
      source: source,
    };

    console.log('Returning rate:', JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600'
        } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching rate:', errorMessage);
    
    // Always return a rate so exports don't fail
    return new Response(
      JSON.stringify({ 
        currency: 'EUR',
        middleRate: 117.1167,
        date: new Date().toISOString().split('T')[0],
        source: 'fallback (error)',
        warning: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
