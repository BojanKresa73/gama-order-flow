// Spajanje CTP stavki istog posla za izvoz (fakturisanje).
// Fajlovi koji se razlikuju samo po oznaci strane/signature (".p0001", ".p0002"...)
// spajaju se u jednu stavku sa zbirom ploča.

/** Koren naziva posla: bez ekstenzije i bez završne oznake ".pNNNN". */
export function jobBaseName(filename: string): string {
  let name = (filename || "").trim();
  name = name.replace(/\.(pdf|tif|tiff|ps|eps|1bit|len)$/i, "");
  name = name.replace(/[._\s-]p\d{1,5}$/i, "");
  return name.trim();
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
  return [...map.values()];
}
