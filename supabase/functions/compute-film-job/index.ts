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
  const effectiveRollWidth = settings.roll_width_mm - 2 * settings.side_margin_mm;
  const effectiveHeight = job.height_mm + 2 * job.margin_mm;
  const effectiveWidth = job.width_mm + 2 * job.margin_mm;

  let best: { rotation: number; copies: number; rows: number; length: number } | null = null;

  // Try 0° orientation
  const copiesPerRow0 = Math.floor(effectiveRollWidth / effectiveWidth);
  if (copiesPerRow0 >= 1) {
    const rows0 = Math.ceil(job.qty / copiesPerRow0);
    const totalLength0 = rows0 * (effectiveHeight + settings.gap_mm) + 
                         settings.lead_trim_mm + settings.tail_trim_mm - settings.gap_mm;
    best = { rotation: 0, copies: copiesPerRow0, rows: rows0, length: totalLength0 };
  }

  // Try 90° orientation if allowed
  if (job.allow_rotate_90) {
    const copiesPerRow90 = Math.floor(effectiveRollWidth / effectiveHeight);
    if (copiesPerRow90 >= 1) {
      const rows90 = Math.ceil(job.qty / copiesPerRow90);
      const totalLength90 = rows90 * (effectiveWidth + settings.gap_mm) + 
                           settings.lead_trim_mm + settings.tail_trim_mm - settings.gap_mm;
      
      if (!best || totalLength90 < best.length) {
        best = { rotation: 90, copies: copiesPerRow90, rows: rows90, length: totalLength90 };
      }
    }
  }

  if (!best) {
    return { error: `Preširoko za rolu (${settings.roll_width_mm} mm)` };
  }

  // Apply waste percentage
  const totalLengthWithWaste = best.length * (1 + settings.waste_percent / 100);
  
  // Round up to centimeters
  const totalLengthM = Math.ceil(totalLengthWithWaste / 10) / 100;
  const mPerPiece = totalLengthM / job.qty;

  return {
    computed_rotation_deg: best.rotation,
    computed_m_per_piece: mPerPiece,
    computed_total_m: totalLengthM,
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
