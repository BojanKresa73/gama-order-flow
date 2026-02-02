/**
 * Fetch EUR to RSD middle exchange rate from National Bank of Serbia
 * Uses their public XML endpoint for current rates
 */

interface NbsRate {
  currency: string;
  middleRate: number;
  date: string;
}

// Cache the rate for the current day to avoid multiple API calls
let cachedRate: { rate: number; date: string } | null = null;

export async function fetchNbsEurRate(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  
  // Return cached rate if it's from today
  if (cachedRate && cachedRate.date === today) {
    return cachedRate.rate;
  }

  try {
    // NBS provides rates in XML format
    // We'll use a CORS proxy or fetch from our edge function if needed
    // For now, try the direct endpoint
    const response = await fetch(
      'https://www.nbs.rs/kursnaListaMod498/srednjiKurs.json',
      { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );

    if (response.ok) {
      const data = await response.json();
      // Find EUR rate in the response
      const eurEntry = data?.find?.((item: any) => 
        item.currencyCode === 'EUR' || item.currency === 'EUR'
      );
      
      if (eurEntry) {
        const rate = parseFloat(eurEntry.middleRate || eurEntry.sredpiKurs || eurEntry.rate);
        if (!isNaN(rate) && rate > 0) {
          cachedRate = { rate, date: today };
          return rate;
        }
      }
    }
  } catch (error) {
    console.warn('Failed to fetch NBS rate directly, trying fallback...', error);
  }

  // Fallback: Try alternative NBS endpoint
  try {
    const response = await fetch(
      'https://nbs.rs/export/sites/NBS_site/documents-eng/kursna-lista/exchange_rate_list_csv.csv'
    );
    
    if (response.ok) {
      const text = await response.text();
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (line.includes('EUR')) {
          const parts = line.split(',');
          // CSV format varies, try to find the middle rate
          for (const part of parts) {
            const rate = parseFloat(part.replace(',', '.').trim());
            if (!isNaN(rate) && rate > 100 && rate < 130) { // EUR is typically 115-120 RSD
              cachedRate = { rate, date: today };
              return rate;
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Fallback NBS fetch failed', error);
  }

  // Ultimate fallback: use a reasonable default rate
  // This should rarely happen - log a warning
  console.warn('Using fallback EUR rate. Please check NBS API availability.');
  const fallbackRate = 117.0; // Approximate current rate as fallback
  cachedRate = { rate: fallbackRate, date: today };
  return fallbackRate;
}

/**
 * Convert EUR amount to RSD using current NBS middle rate
 */
export async function convertEurToRsd(eurAmount: number): Promise<{ rsdAmount: number; rate: number }> {
  const rate = await fetchNbsEurRate();
  return {
    rsdAmount: eurAmount * rate,
    rate
  };
}

/**
 * Get current NBS rate info for display purposes
 */
export async function getNbsRateInfo(): Promise<{ rate: number; date: string }> {
  const rate = await fetchNbsEurRate();
  return {
    rate,
    date: new Date().toLocaleDateString('sr-RS')
  };
}
