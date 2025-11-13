import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FilmJob {
  width_mm: number;
  height_mm: number;
  qty: number;
  allow_rotate_90: boolean;
  margin_mm: number;
}

interface FilmSettings {
  roll_width_mm: number;
  side_margin_mm: number;
  lead_trim_mm: number;
  tail_trim_mm: number;
  gap_mm: number;
  waste_percent: number;
}

interface ComputeResult {
  computed_rotation_deg: number;
  computed_m_per_piece: number;
  computed_total_m: number;
  cut_info: {
    rotation_deg: number;
    copies_per_row: number;
    rows_needed: number;
    length_m: number;
  };
}

function computeFilmJob(job: FilmJob, settings: FilmSettings): ComputeResult | { error: string } {
  const ROLL_WIDTH_MM = 508;
  const MAX_COMPONENT_WIDTH_MM = 500;
  const WASTE_PERCENT = 3;

  // Check if dimensions exceed maximum allowed width
  if (job.width_mm > MAX_COMPONENT_WIDTH_MM || job.height_mm > MAX_COMPONENT_WIDTH_MM) {
    return { error: `Preširoko za rolu (max ${MAX_COMPONENT_WIDTH_MM} mm)` };
  }

  let best: { rotation: number; copies: number; rows: number; totalMm: number } | null = null;

  // Try 0° orientation
  const copiesPerRow0 = Math.floor(ROLL_WIDTH_MM / job.width_mm);
  if (copiesPerRow0 >= 1) {
    const rows0 = Math.ceil(job.qty / copiesPerRow0);
    const total0Mm = rows0 * job.height_mm;
    best = { rotation: 0, copies: copiesPerRow0, rows: rows0, totalMm: total0Mm };
  }

  // Try 90° orientation if allowed
  if (job.allow_rotate_90) {
    const copiesPerRow90 = Math.floor(ROLL_WIDTH_MM / job.height_mm);
    if (copiesPerRow90 >= 1) {
      const rows90 = Math.ceil(job.qty / copiesPerRow90);
      const total90Mm = rows90 * job.width_mm;
      
      if (!best || total90Mm < best.totalMm) {
        best = { rotation: 90, copies: copiesPerRow90, rows: rows90, totalMm: total90Mm };
      }
    }
  }

  if (!best) {
    return { error: `Preširoko za rolu (max ${MAX_COMPONENT_WIDTH_MM} mm)` };
  }

  // Apply 3% waste
  const totalMmWithWaste = best.totalMm * (1 + WASTE_PERCENT / 100);
  
  // Ceiling to centimeter (0.01 m)
  const totalLengthM = Math.ceil(totalMmWithWaste / 10) / 100;
  const mPerPiece = totalLengthM / job.qty;

  return {
    computed_rotation_deg: best.rotation,
    computed_m_per_piece: Number(mPerPiece.toFixed(4)),
    computed_total_m: Number(totalLengthM.toFixed(2)),
    cut_info: {
      rotation_deg: best.rotation,
      copies_per_row: best.copies,
      rows_needed: best.rows,
      length_m: totalLengthM,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { job } = await req.json();

    // Fetch film settings
    const { data: settings, error: settingsError } = await supabase
      .from('film_settings')
      .select('*')
      .single();

    if (settingsError || !settings) {
      console.error('Failed to fetch film settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch film settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = computeFilmJob(job, settings);

    if ('error' in result) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
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
