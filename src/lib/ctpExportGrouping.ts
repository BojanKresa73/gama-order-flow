// Spajanje CTP stavki istog posla za izvoz (fakturisanje).
// Fajlovi koji se razlikuju samo po oznaci strane/signature (".p0001", ".p0002"...)
// spajaju se u jednu stavku sa zbirom ploča.

/** Naziv bez ekstenzije, Preps, .new i ".pNNNN" — ali sa brojem tabaka. */
function pageStrippedName(filename: string): string {
  let name = (filename || "").trim();
  name = name.replace(/\.(pdf|tif|tiff|ps|eps|1bit|len)$/i, "");
  name = name.replace(/[\s_.-]*preps\b/gi, "");
  name = name.replace(/\.new$/i, "");
  name = name.replace(/[._\s-]p\d{1,5}$/i, "");
  return name.replace(/\s{2,}/g, " ").trim();
}

/** Koren naziva posla: bez ekstenzije, bez oznake Preps i bez završne oznake ".pNNNN". */
export function jobBaseName(filename: string): string {
  let name = (filename || "").trim();
  name = name.replace(/\.(pdf|tif|tiff|ps|eps|1bit|len)$/i, "");
  name = name.replace(/[\s_.-]*preps\b/gi, "");
  name = name.replace(/\.new$/i, "");
  name = name.replace(/[._\s-]p\d{1,5}$/i, "");
  // Završni brojač tabaka: "tabaci 01", "tabak 2", "_03" (1-2 cifre).
  name = name.replace(/([\s_-]+(?:tabaci|tabak|tab)?)[\s_-]*\d{1,2}$/i, (_m, w: string) =>
    /tab/i.test(w) ? w.replace(/[\s_-]+$/, "") : "",
  );
  return name.replace(/\s{2,}/g, " ").trim();
}

/**
 * Naziv posla za fakturu: uklanja početni prefiks "klijent dimenzija" (npr. "dunav 745x605 ")
 * koji operater doda pri montaži — klijent i format se već navode u opisu stavke.
 * Prefiks se skida samo ako se dimenzija pojavi među prve 3 reči i iza nje ostane tekst.
 */
export function invoiceJobName(baseName: string): string {
  // Razdvajač može biti razmak ili donja crta ("Birograf_1060x795_..."). Skida se samo
  // dimenzija ploče (obe strane ≥ 400 mm), ne dimenzija proizvoda (npr. "482x130mm").
  const m = baseName.match(/^((?:[^\s_]+[\s_]+){0,2}?)(\d{3,4})\s*[x×]\s*(\d{3,4})(?:mm)?[\s_-]+(.+)$/i);
  if (m && m[4].trim() && Number(m[2]) >= 400 && Number(m[3]) >= 400) return m[4].trim();
  return baseName;
}

export interface GroupableEntry {
  filename: string;
  quantity: number;
  format_name?: string;
}

export interface GroupedEntry<T extends GroupableEntry> {
  baseName: string;
  format_name?: string;
  quantity: number;
  price: number | null;
  entries: T[];
  merged: boolean;
}

/** Grupiše po (koren naziva, format, jedinična cena) uz očuvanje redosleda. */
export function groupEntriesForExport<T extends GroupableEntry>(
  entries: T[],
  priceOf: (e: T) => number | null,
): GroupedEntry<T>[] {
  const map = new Map<string, GroupedEntry<T>>();
  for (const e of entries) {
    const base = jobBaseName(e.filename);
    const price = priceOf(e);
    const key = `${base.toLowerCase()}|${e.format_name ?? ""}|${price ?? "null"}`;
    const g = map.get(key);
    const qty = e.quantity || 1;
    if (g) {
      g.quantity += qty;
      g.entries.push(e);
      g.merged = true;
    } else {
      map.set(key, { baseName: base, format_name: e.format_name, quantity: qty, price, entries: [e], merged: false });
    }
  }
  // Ako se u grupi nije menjao brojač tabaka (npr. jedan "tabak 04" u više .pNNNN strana),
  // zadrži pun naziv sa brojem — brojač se skida samo kad se spajaju različiti tabaci.
  for (const g of map.values()) {
    const names = new Set(g.entries.map((e) => pageStrippedName(e.filename).toLowerCase()));
    if (names.size === 1) g.baseName = pageStrippedName(g.entries[0].filename);
  }
  return [...map.values()];
}

/** Redosled naloga u izvozu: po broju naloga, rastuće. */
export function compareOrderNumbers(a?: string | null, b?: string | null): number {
  return (a || "").localeCompare(b || "", "sr", { numeric: true });
}
