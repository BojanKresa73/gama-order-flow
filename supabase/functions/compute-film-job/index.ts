import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FilmJobItem {
  file_name: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
}

interface BatchComputeRequest {
  roll_width_mm: number;
  smart_rotation: boolean;
  waste_percent: number;
  items: FilmJobItem[];
}

interface ComputeResultItem {
  file_name: string;
  m_per_piece: number;
  total_m: number;
  used_width_mm: number;
  rotation: number;
  waste_m: number;
  error?: string;
}

function computeSingleFilmJob(
  item: FilmJobItem,
  rollWidthMm: number,
  wastePercent: number,
  smartRotation: boolean
): ComputeResultItem {
  const MAX_COMPONENT_WIDTH_MM = 500;

  // Check if dimensions exceed maximum allowed width
  if (item.width_mm > MAX_COMPONENT_WIDTH_MM || item.height_mm > MAX_COMPONENT_WIDTH_MM) {
    return {
      file_name: item.file_name,
      m_per_piece: 0,
      total_m: 0,
      used_width_mm: 0,
      rotation: 0,
      waste_m: 0,
      error: `Preširoko za rolu (max ${MAX_COMPONENT_WIDTH_MM} mm)`,
    };
  }

  let best: { rotation: number; usedWidth: number; totalMm: number } | null = null;

  // Try 0° orientation
  if (item.width_mm <= rollWidthMm) {
    const totalMm0 = item.height_mm * item.quantity;
    best = { rotation: 0, usedWidth: item.width_mm, totalMm: totalMm0 };
  }

  // Try 90° orientation if smart_rotation enabled
  if (smartRotation && item.height_mm <= rollWidthMm) {
    const totalMm90 = item.width_mm * item.quantity;
    if (!best || totalMm90 < best.totalMm) {
      best = { rotation: 90, usedWidth: item.height_mm, totalMm: totalMm90 };
    }
  }

  if (!best) {
    return {
      file_name: item.file_name,
      m_per_piece: 0,
      total_m: 0,
      used_width_mm: 0,
      rotation: 0,
      waste_m: 0,
      error: `Preširoko za rolu (max ${rollWidthMm} mm)`,
    };
  }

  // Apply waste percentage
  const wasteMm = best.totalMm * (wastePercent / 100);
  const totalMmWithWaste = best.totalMm + wasteMm;
  
  // Convert to meters and round to 2 decimals
  const totalM = Number((totalMmWithWaste / 1000).toFixed(2));
  const mPerPiece = Number((totalM / item.quantity).toFixed(4));
  const wasteM = Number((wasteMm / 1000).toFixed(2));

  return {
    file_name: item.file_name,
    m_per_piece: mPerPiece,
    total_m: totalM,
    used_width_mm: best.usedWidth,
    rotation: best.rotation,
    waste_m: wasteM,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: BatchComputeRequest = await req.json();
    
    console.log('Received compute request:', {
      roll_width_mm: body.roll_width_mm,
      smart_rotation: body.smart_rotation,
      waste_percent: body.waste_percent,
      items_count: body.items?.length || 0,
    });

    // Validate request
    if (!body.items || !Array.isArray(body.items)) {
      return new Response(
        JSON.stringify({ error: 'Items array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default values
    const rollWidthMm = body.roll_width_mm || 500;
    const smartRotation = body.smart_rotation ?? false;
    const wastePercent = body.waste_percent ?? 0;

    // Compute all items
    const results: ComputeResultItem[] = body.items.map((item) =>
      computeSingleFilmJob(item, rollWidthMm, wastePercent, smartRotation)
    );

    console.log('Computed results:', results);

    return new Response(
      JSON.stringify({ items: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in compute-film-job:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
