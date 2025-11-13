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

export interface ComputeResult {
  computed_rotation_deg: number;
  computed_m_per_piece: number;
  computed_total_m: number;
}

export function computeFilmJobClient(job: FilmJob, settings: FilmSettings): ComputeResult | { error: string } {
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
    computed_m_per_piece: Number(mPerPiece.toFixed(4)),
    computed_total_m: Number(totalLengthM.toFixed(2)),
  };
}
