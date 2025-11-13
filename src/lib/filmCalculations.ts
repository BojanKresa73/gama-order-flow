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
  const ROLL_WIDTH_MM = 508;
  const MAX_COMPONENT_WIDTH_MM = 500;

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

  // Apply waste percentage
  const wastePercent = settings.waste_percent || 3;
  const totalMmWithWaste = best.totalMm * (1 + wastePercent / 100);
  
  // Convert to meters and round up to centimeter (0.01 m)
  const totalLengthM = Math.ceil(totalMmWithWaste / 10) / 100;
  const mPerPiece = totalLengthM / job.qty;

  return {
    computed_rotation_deg: best.rotation,
    computed_m_per_piece: Number(mPerPiece.toFixed(4)),
    computed_total_m: Number(totalLengthM.toFixed(2)),
  };
}
