export const prefixFor = (t?: string) => ({
  CTP: 'CTP',
  DIGITAL: 'DIG',
  FILM: 'FILM',
  OSTALO: 'OST',
}[t?.toUpperCase() || ''] ?? 'WO');
