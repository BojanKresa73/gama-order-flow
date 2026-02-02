/**
 * Fetch EUR to RSD middle exchange rate from National Bank of Serbia
 * Uses edge function to bypass CORS and get accurate rates
 */

import { supabase } from "@/integrations/supabase/client";

interface NbsRateResponse {
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
    console.log('Using cached NBS rate:', cachedRate.rate);
    return cachedRate.rate;
  }

  try {
    console.log('Fetching NBS rate via edge function...');
    
    const { data, error } = await supabase.functions.invoke<NbsRateResponse>('nbs-exchange-rate');

    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }

    if (data && data.middleRate > 0) {
      console.log('NBS rate fetched:', data.middleRate, 'Date:', data.date);
      cachedRate = { rate: data.middleRate, date: today };
      return data.middleRate;
    }

    throw new Error('Invalid rate data received');
  } catch (error) {
    console.error('Failed to fetch NBS rate:', error);
    
    // Fallback: use a reasonable default rate
    console.warn('Using fallback EUR rate (117.0). Edge function may be unavailable.');
    const fallbackRate = 117.0;
    cachedRate = { rate: fallbackRate, date: today };
    return fallbackRate;
  }
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

/**
 * Clear cached rate (useful for forcing refresh)
 */
export function clearNbsRateCache(): void {
  cachedRate = null;
}
