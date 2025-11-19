export interface FitResult {
  orientation: 0 | 90;    // izabrana orijentacija
  across: number;         // koliko komada staje po širini role
  rows: number;           // broj "redova" (poteza) dužine pieceH
  m_per_piece: number;    // dužina po komadu u metrima
  total_m: number;        // ukupno metara (sa otp.) za traženu količinu
}

export function fitOnRoll(
  w_mm: number,           // širina fajla (uneta)
  h_mm: number,           // visina fajla (uneta)
  qty: number,
  roll_mm = 500,          // širina role
  margin_mm = 0,          // bočni razmak (svaka strana)
  gap_mm = 0,             // razmak između komada po širini
  waste_pct = 0           // procenat otpada (0…1)
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
    throw new Error('NE_STAJE_U_ROLNU'); // ni jedna orijentacija ne staje u 500 mm
  }
  if (o0 && o90) {
    // biramo ekonomičniju (manji total_m), a može i veći across ako su isti
    if (o90.total_m < o0.total_m) return o90;
    if (o90.total_m === o0.total_m && o90.across > o0.across) return o90;
    return o0;
  }
  return (o0 ?? o90)!;
}
