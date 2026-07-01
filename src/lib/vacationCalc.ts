// Klijentski helperi za "Godišnji odmori"
// Ogledalo SQL funkcije public.vacation_count_days

export function countBusinessDaysWithHolidays(
  start: Date,
  end: Date,
  holidayIsoDates: Set<string>
): number {
  if (end < start) return 0;
  let days = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last) {
    const iso = cur.toISOString().slice(0, 10);
    if (!holidayIsoDates.has(iso)) days += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: Date, b: Date): number {
  const ms = 1000 * 60 * 60 * 24;
  const ad = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bd = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((ad - bd) / ms);
}

// Deterministički HSL po korisničkom ID-u — pastelna paleta
export function colorForUser(userId: string): { bg: string; border: string; text: string } {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) % 360;
  }
  return {
    bg: `hsl(${h} 70% 88%)`,
    border: `hsl(${h} 60% 55%)`,
    text: `hsl(${h} 55% 25%)`,
  };
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function statusLabel(s: string): string {
  switch (s) {
    case "pending": return "Na čekanju";
    case "approved": return "Odobreno";
    case "rejected": return "Odbijeno";
    case "cancelled": return "Otkazano";
    default: return s;
  }
}
