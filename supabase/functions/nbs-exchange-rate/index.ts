import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NbsRate {
  currency: string;
  middleRate: number;
  date: string;
  listNumber?: number;
  validFrom?: string;
  validTo?: string;
  source: string;
  cached?: boolean;
}

// NBS SOAP request za CurrentMiddleRate
function buildSoapRequest(currency: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <GetCurrentExchangeRate xmlns="http://communicationoffice.nbs.rs">
      <exchangeRateListType>2</exchangeRateListType>
      <currencyCode>${currency}</currencyCode>
    </GetCurrentExchangeRate>
  </soap12:Body>
</soap12:Envelope>`;
}

// Parse NBS SOAP response
function parseNbsResponse(xmlText: string): { 
  middleRate: number; 
  listNumber: number; 
  listDate: string;
  validFrom: string;
  validTo: string;
} | null {
  try {
    console.log('Parsing NBS response, length:', xmlText.length);
    
    // Extract middle rate (SrednjiKurs)
    const rateMatch = xmlText.match(/<SrednjiKurs>([0-9.,]+)<\/SrednjiKurs>/i) ||
                      xmlText.match(/<MiddleRate>([0-9.,]+)<\/MiddleRate>/i);
    
    // Extract list number (BrojKursneListe)  
    const listNumMatch = xmlText.match(/<BrojKursneListe>(\d+)<\/BrojKursneListe>/i) ||
                         xmlText.match(/<ExchangeRateListNumber>(\d+)<\/ExchangeRateListNumber>/i);
    
    // Extract list date (DatumPrimene / CreateDate)
    const dateMatch = xmlText.match(/<DatumPrimene>([^<]+)<\/DatumPrimene>/i) ||
                      xmlText.match(/<CreateDate>([^<]+)<\/CreateDate>/i) ||
                      xmlText.match(/<Date>([^<]+)<\/Date>/i);

    if (!rateMatch) {
      console.error('Could not find rate in response');
      return null;
    }

    const middleRate = parseFloat(rateMatch[1].replace(',', '.'));
    const listNumber = listNumMatch ? parseInt(listNumMatch[1]) : 0;
    
    // Parse date or use today
    let listDate = new Date().toISOString().split('T')[0];
    if (dateMatch) {
      const parsed = new Date(dateMatch[1]);
      if (!isNaN(parsed.getTime())) {
        listDate = parsed.toISOString().split('T')[0];
      }
    }

    // NBS rate valid from 08:00 to next day 08:00
    const validFromDate = new Date(listDate + 'T08:00:00+01:00'); // Belgrade timezone
    const validToDate = new Date(validFromDate.getTime() + 24 * 60 * 60 * 1000);

    return {
      middleRate,
      listNumber,
      listDate,
      validFrom: validFromDate.toISOString(),
      validTo: validToDate.toISOString(),
    };
  } catch (e) {
    console.error('Error parsing NBS response:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Support currency query param (default EUR)
    const url = new URL(req.url);
    const currency = url.searchParams.get('currency')?.toUpperCase() || 'EUR';
    const now = new Date();
    
    console.log('Checking for cached NBS rate...');

    // 1. Proveri keširani kurs u bazi
    const { data: cachedRate, error: cacheError } = await supabase
      .from('nbs_exchange_rates')
      .select('*')
      .eq('currency_code', currency)
      .lte('valid_from', now.toISOString())
      .gt('valid_to', now.toISOString())
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cacheError && cachedRate) {
      console.log('Using cached rate:', cachedRate.middle_rate);
      
      const result: NbsRate = {
        currency: cachedRate.currency_code,
        middleRate: Number(cachedRate.middle_rate),
        date: cachedRate.list_date,
        listNumber: cachedRate.list_number,
        validFrom: cachedRate.valid_from,
        validTo: cachedRate.valid_to,
        source: 'nbs_cached',
        cached: true,
      };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' },
      });
    }

    console.log('Cache miss or expired, fetching from NBS...');

    // 2. Pozovi NBS SOAP web servis
    let nbsData: ReturnType<typeof parseNbsResponse> = null;
    
    try {
      const soapBody = buildSoapRequest(currency);
      console.log('Calling NBS SOAP service...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const nbsResponse = await fetch(
        'https://webservices.nbs.rs/CommunicationOfficeService1_0/ExchangeRateXml.asmx',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            'SOAPAction': 'http://communicationoffice.nbs.rs/GetCurrentExchangeRate',
          },
          body: soapBody,
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (nbsResponse.ok) {
        const xmlText = await nbsResponse.text();
        console.log('NBS response received, length:', xmlText.length);
        console.log('NBS response preview:', xmlText.substring(0, 500));
        nbsData = parseNbsResponse(xmlText);
      } else {
        console.error('NBS SOAP error:', nbsResponse.status);
      }
    } catch (e) {
      console.warn('NBS SOAP request failed:', e);
    }

    // 3. Fallback: pokušaj REST endpoint
    if (!nbsData) {
      try {
        console.log('Trying NBS REST endpoint...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const restResponse = await fetch(
          'https://webappcenter.nbs.rs/ExchangeRateWebApp/ExchangeRate/CurrentMiddleRate',
          {
            headers: { 'Accept': 'application/json, text/html' },
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        if (restResponse.ok) {
          const contentType = restResponse.headers.get('content-type') || '';
          const text = await restResponse.text();
          console.log('REST response type:', contentType, 'length:', text.length);
          
          if (contentType.includes('json')) {
            const data = JSON.parse(text);
            // Parse JSON response format
            if (data.exchangeRates || data.rates) {
              const rates = data.exchangeRates || data.rates;
              const eurRate = rates.find((r: any) => r.currencyCode === 'EUR' || r.code === 'EUR');
              if (eurRate) {
                const today = new Date().toISOString().split('T')[0];
                nbsData = {
                  middleRate: parseFloat(String(eurRate.middleRate || eurRate.sredpiKurs).replace(',', '.')),
                  listNumber: data.listNumber || 0,
                  listDate: today,
                  validFrom: new Date(today + 'T08:00:00+01:00').toISOString(),
                  validTo: new Date(new Date(today + 'T08:00:00+01:00').getTime() + 86400000).toISOString(),
                };
              }
            }
          } else {
            // Parse HTML - look for EUR row
            const eurMatch = text.match(/EUR[\s\S]*?([0-9]+[.,][0-9]{4})/);
            if (eurMatch) {
              const today = new Date().toISOString().split('T')[0];
              nbsData = {
                middleRate: parseFloat(eurMatch[1].replace(',', '.')),
                listNumber: 0,
                listDate: today,
                validFrom: new Date(today + 'T08:00:00+01:00').toISOString(),
                validTo: new Date(new Date(today + 'T08:00:00+01:00').getTime() + 86400000).toISOString(),
              };
            }
          }
        }
      } catch (e) {
        console.warn('NBS REST request failed:', e);
      }
    }

    // 4. Ako smo dobili podatke, sačuvaj u bazu
    if (nbsData && nbsData.middleRate > 50 && nbsData.middleRate < 200) {
      console.log('Got valid NBS rate:', nbsData.middleRate);
      
      // Upsert u bazu (update ako postoji za taj dan)
      const { error: upsertError } = await supabase
        .from('nbs_exchange_rates')
        .upsert({
          currency_code: currency,
          middle_rate: nbsData.middleRate,
          list_number: nbsData.listNumber,
          list_date: nbsData.listDate,
          valid_from: nbsData.validFrom,
          valid_to: nbsData.validTo,
          fetched_at: new Date().toISOString(),
          source: 'nbs_soap',
        }, {
          onConflict: 'currency_code,list_date',
        });

      if (upsertError) {
        console.error('Error saving rate to cache:', upsertError);
      } else {
        console.log('Rate cached successfully');
      }

      const result: NbsRate = {
        currency,
        middleRate: Number(nbsData.middleRate.toFixed(4)),
        date: nbsData.listDate,
        listNumber: nbsData.listNumber,
        validFrom: nbsData.validFrom,
        validTo: nbsData.validTo,
        source: 'nbs_live',
        cached: false,
      };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' },
      });
    }

    // 5. Fallback: poslednji poznati kurs iz baze
    console.log('NBS APIs failed, checking for last known rate...');
    
    const { data: lastKnown, error: lastError } = await supabase
      .from('nbs_exchange_rates')
      .select('*')
      .eq('currency_code', currency)
      .order('list_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastError && lastKnown) {
      console.log('Using last known rate from DB:', lastKnown.middle_rate);
      
      return new Response(JSON.stringify({
        currency: lastKnown.currency_code,
        middleRate: Number(lastKnown.middle_rate),
        date: lastKnown.list_date,
        listNumber: lastKnown.list_number,
        source: 'nbs_fallback',
        cached: true,
        warning: 'Using last known rate - NBS service temporarily unavailable',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Krajnji fallback - hardcoded rate (samo ako nema ničega u bazi)
    console.warn('No cached rates available, using hardcoded fallback for', currency);
    const fallbackRates: Record<string, number> = { EUR: 117.12, USD: 108.50 };
    
    return new Response(JSON.stringify({
      currency,
      middleRate: fallbackRates[currency] || 117.12,
      date: new Date().toISOString().split('T')[0],
      source: 'hardcoded_fallback',
      cached: false,
      warning: 'Using emergency fallback rate - please refresh later',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Fatal error:', errorMessage);
    
    return new Response(JSON.stringify({
      currency: 'EUR',
      middleRate: 117.12,
      date: new Date().toISOString().split('T')[0],
      source: 'error_fallback',
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
