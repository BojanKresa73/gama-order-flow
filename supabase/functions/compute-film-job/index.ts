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
  margin_mm?: number;
  gap_mm?: number;
  waste_percent: number;
  items: FilmJobItem[];
}

interface ComputeResultItem {
  file_name: string;
  m_per_piece: number;
  total_m: number;
  rotation: number;
  across: number;
  rows: number;
  error?: string;
}

function fitOnRoll(
  w_mm: number,
  h_mm: number,
  qty: number,
  roll_mm: number,
  margin_mm: number,
  gap_mm: number,
  waste_pct: number
): { orientation: 0 | 90; across: number; rows: number; m_per_piece: number; total_m: number } {
  const tryOrient = (o: 0 | 90) => {
    const pieceW = o === 0 ? w_mm : h_mm;
    const pieceH = o === 0 ? h_mm : w_mm;

    const usable = roll_mm - 2 * margin_mm;
    if (pieceW > usable) return null;

    const across = Math.max(1, Math.floor((usable + gap_mm) / (pieceW + gap_mm)));
    const rows = Math.ceil(qty / across);
    const m_per_piece = pieceH / 1000;
    const total_m_raw = rows * m_per_piece;
    const total_m = total_m_raw * (1 + waste_pct / 100);

    return { orientation: o, across, rows, m_per_piece, total_m };
  };

  const o0 = tryOrient(0);
  const o90 = tryOrient(90);

  if (!o0 && !o90) {
    throw new Error('NE_STAJE_U_ROLNU');
  }
  if (o0 && o90) {
    if (o90.total_m < o0.total_m) return o90;
    if (o90.total_m === o0.total_m && o90.across > o0.across) return o90;
    return o0;
  }
  return (o0 ?? o90)!;
}

function computeSingleFilmJob(
  item: FilmJobItem,
  rollWidthMm: number,
  marginMm: number,
  gapMm: number,
  wastePercent: number
): ComputeResultItem {
  try {
    const result = fitOnRoll(
      item.width_mm,
      item.height_mm,
      item.quantity,
      rollWidthMm,
      marginMm,
      gapMm,
      wastePercent
    );

    return {
      file_name: item.file_name,
      m_per_piece: Number(result.m_per_piece.toFixed(4)),
      total_m: Number(result.total_m.toFixed(2)),
      rotation: result.orientation,
      across: result.across,
      rows: result.rows,
    };
  } catch (error) {
    return {
      file_name: item.file_name,
      m_per_piece: 0,
      total_m: 0,
      rotation: 0,
      across: 0,
      rows: 0,
      error: `Ne staje u rolnu ${rollWidthMm} mm`,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: BatchComputeRequest = await req.json();
    
    console.log('Received compute request:', {
      roll_width_mm: body.roll_width_mm,
      margin_mm: body.margin_mm,
      gap_mm: body.gap_mm,
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
    const marginMm = body.margin_mm ?? 0;
    const gapMm = body.gap_mm ?? 0;
    const wastePercent = body.waste_percent ?? 0;

    // Compute all items
    const results: ComputeResultItem[] = body.items.map((item) =>
      computeSingleFilmJob(item, rollWidthMm, marginMm, gapMm, wastePercent)
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
