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

// datum kao dd.MM.yyyy. (s tačkom na kraju)
const formatDateSR = (iso?: string | Date) => {
  const d = iso ? new Date(iso) : new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}.`;
};

// Izvuci redni broj iz postojećeg koda (uzima poslednji broj u stringu)
const extractSeq = (code?: string) => {
  const m = (code ?? '').match(/(\d+)(?!.*\d)/);
  const n = m ? parseInt(m[1], 10) : 0;
  return String(isNaN(n) ? 0 : n).padStart(4, '0');
};

// tip u UPPER skraćenici
const toTypeShort = (t?: string) => {
  const s = (t ?? '').toLowerCase();
  if (s === 'ctp') return 'CTP';
  if (s === 'digital') return 'DIG';
  if (s === 'film' || s === 'fil') return 'FIL';
  return 'RAZ';
};

// konverzija u enum vrednost za bazu
export const toEnumType = (t: string) => {
  const s = t.toLowerCase();
  if (s === 'ctp') return 'ctp';
  if (s === 'digital') return 'digital';
  if (s === 'film' || s === 'fil') return 'film';
  return 'razno';
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

export const displayOrderNumber = (o: {
  order_code?: string;
  created_at?: string;
  client_name?: string;
  type?: string;
}) => {
  const seq  = extractSeq(o.order_code);
  const date = formatDateSR(o.created_at);
  const typ  = toTypeShort(o.type);
  const cli  = o.client_name ?? 'Klijent';
  return `${seq}-${date}-${typ}-${cli}`;
};

// Za fajl ime: bez dijakritike i opasnih znakova
export const toPdfFileName = (label: string) => {
  const noDiacritics = label.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const safe = noDiacritics
    .replace(/\./g, '-')             // tačke u datumu -> crtice
    .replace(/[^A-Za-z0-9_-]+/g, '-')// sve ostalo -> crtica
    .replace(/-+/g, '-')             // duple crtice
    .replace(/(^-|-$)/g, '');        // trim
  return `${safe}.pdf`;
};
