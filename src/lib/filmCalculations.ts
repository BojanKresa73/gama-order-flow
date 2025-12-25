export interface FitResult {
  orientation: 0 | 90;    // izabrana orijentacija
  across: number;         // uvek 1 - nema nesting-a
  rows: number;           // broj komada = količina
  m_per_piece: number;    // dužina po komadu u metrima
  total_m: number;        // ukupno metara (sa otp.) za traženu količinu
}

/**
 * Računa filmovanje BEZ nesting-a.
 * Mašina ne radi nesting - svaki komad ide jedan ispod drugog.
 * Biramo orijentaciju tako da jedna dimenzija stane u širinu rolne,
 * a druga dimenzija ide u dužinu (množi se sa količinom).
 */
export function fitOnRoll(
  w_mm: number,           // širina fajla (uneta)
  h_mm: number,           // visina fajla (uneta)
  qty: number,
  roll_mm = 500,          // širina role
  margin_mm = 0,          // bočni razmak (svaka strana)
  gap_mm = 0,             // razmak između komada (ne koristi se za nesting, ali ostavljen za kompatibilnost)
  waste_pct = 0           // procenat otpada (0…1)
): FitResult {
  const usable = roll_mm - 2 * margin_mm;

  const tryOrient = (o: 0 | 90) => {
    // pieceW ide po širini rolne, pieceH ide po dužini rolne
    const pieceW = o === 0 ? w_mm : h_mm;
    const pieceH = o === 0 ? h_mm : w_mm;

    // Provera da li staje u širinu rolne
    if (pieceW > usable) return null;

    // Nema nesting-a - svaki komad ide jedan ispod drugog
    const across = 1;
    const rows = qty;
    const m_per_piece = pieceH / 1000;
    const total_m_raw = rows * m_per_piece;
    const total_m = total_m_raw * (1 + waste_pct);

    return { orientation: o, across, rows, m_per_piece, total_m };
  };

  const o0 = tryOrient(0);
  const o90 = tryOrient(90);

  if (!o0 && !o90) {
    throw new Error('NE_STAJE_U_ROLNU'); // ni jedna orijentacija ne staje
  }

  if (o0 && o90) {
    // Obe orijentacije staju - biramo ekonomičniju (manji total_m)
    if (o90.total_m < o0.total_m) return o90;
    return o0;
  }

  return (o0 ?? o90)!;
}
