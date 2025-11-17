export const prefixFor = (t?: string) => ({
  CTP: 'CTP',
  DIGITAL: 'DIG',
  FILM: 'FILM',
  OSTALO: 'OST',
}[t?.toUpperCase() || ''] ?? 'WO');

// mapiranje skraćenica
export const shortType = (t?: string) => {
  const m: Record<string, string> = {
    CTP: 'ctp',
    Digital: 'dig',
    film: 'fil',
    Ostalo: 'raz',
  };
  return m[t || ''] ?? 'raz';
};

// datum kao 17.11.2025
export const formatDateSR = (iso?: string | Date) => {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// sastavi label za prikaz u tabeli
export const workOrderDisplay = (o: {
  order_code?: string;     // interni broj naloga iz baze
  created_at?: string;     // ISO datum
  client_name?: string;    // ime klijenta
  type?: string;           // 'CTP' | 'Digital' | 'film' | 'Ostalo'
}) => {
  const code  = o.order_code ?? 'N/A';
  const date  = formatDateSR(o.created_at);
  const cli   = o.client_name ?? 'Nepoznat klijent';
  const vrsta = shortType(o.type);
  return `${code} - ${date} - ${cli} - ${vrsta}`;
};

// (opciono) bezbedno ime fajla za PDF
export const safeFileName = (s: string) =>
  s.normalize('NFKD')
   .replace(/[\u0300-\u036f]/g, '')       // skini dijakritike
   .replace(/[^A-Za-z0-9._ -]+/g, '')     // izbaci problematične simbole
   .trim()
   .replace(/\s+/g, '_');
