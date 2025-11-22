const ROLL_WIDTH_MM = 500;

export function computeFilmUsage(params: {
  widthMm: number; // širina fajla u mm
  heightMm: number; // visina fajla u mm
  qty: number; // količina komada
}) {
  const { widthMm, heightMm, qty } = params;

  const fit0  = Math.floor(ROLL_WIDTH_MM / widthMm);
  const fit90 = Math.floor(ROLL_WIDTH_MM / heightMm);

  const use90   = fit90 > fit0;
  const across  = Math.max(fit0, fit90, 1);
  const pieceM  = (use90 ? widthMm : heightMm) / 1000; // dužina po komadu u metrima
  const rows    = Math.ceil(qty / across);
  const totalM  = rows * pieceM;

  return {
    orientation: use90 ? 90 : 0,
    across,
    rows,
    mPerPiece: pieceM,
    totalM,
  };
}
