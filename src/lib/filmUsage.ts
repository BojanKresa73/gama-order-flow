const ROLL_WIDTH_MM = 500;

export function computeFilmUsage(params: {
  widthMm: number; // širina fajla u mm
  heightMm: number; // visina fajla u mm
  qty: number; // količina komada
}) {
  const { widthMm, heightMm, qty } = params;

  // No nesting - machine processes one piece at a time
  // Choose orientation so that one dimension fits in roll width,
  // and the other goes along the length
  const fit0  = widthMm <= ROLL_WIDTH_MM;
  const fit90 = heightMm <= ROLL_WIDTH_MM;

  // Pick orientation that minimizes total material usage
  const use90 = fit90 && (!fit0 || widthMm < heightMm);
  const across = 1;
  const pieceM = (use90 ? widthMm : heightMm) / 1000; // length per piece in meters
  const rows = qty;
  const totalM = rows * pieceM;

  return {
    orientation: use90 ? 90 : 0,
    across,
    rows,
    mPerPiece: pieceM,
    totalM,
  };
}
