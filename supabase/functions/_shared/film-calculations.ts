export interface FitResult {
  orientation: 0 | 90;
  across: number;
  rows: number;
  m_per_piece: number;
  total_m: number;
}

export function fitOnRoll(
  w_mm: number,
  h_mm: number,
  qty: number,
  roll_mm = 500,
  margin_mm = 0,
  gap_mm = 0,
  waste_pct = 0
): FitResult {
  const tryOrient = (o: 0 | 90) => {
    const pieceW = o === 0 ? w_mm : h_mm;
    const pieceH = o === 0 ? h_mm : w_mm;

    const usable = roll_mm - 2 * margin_mm;
    if (pieceW > usable) return null;

    const across = Math.max(1, Math.floor((usable + gap_mm) / (pieceW + gap_mm)));
    const rows = Math.ceil(qty / across);
    const m_per_piece = pieceH / 1000;
    const total_m_raw = rows * m_per_piece;
    const total_m = total_m_raw * (1 + waste_pct);

    return { orientation: o, across, rows, m_per_piece, total_m };
  };

  const o0 = tryOrient(0);
  const o90 = tryOrient(90);

  if (!o0 && !o90) {
    throw new Error('NE_STAJE_U_ROLNU');
  }
  if (o0 && o90) {
    // Choose more economical (lower total_m), or higher across if equal
    if (o90.total_m < o0.total_m) return o90;
    if (o90.total_m === o0.total_m && o90.across > o0.across) return o90;
    return o0;
  }
  return (o0 ?? o90)!;
}