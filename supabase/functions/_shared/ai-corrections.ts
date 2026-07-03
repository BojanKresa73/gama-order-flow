/**
 * Helper za few-shot learning iz korisničkih ispravki.
 * Bezbedno vraća [] ako tabela `ai_corrections` ne postoji ili nema pristupa.
 */

interface CorrectionRow {
  source_text: string;
  ai_output: unknown;
  corrected_output: unknown;
  changed_fields: string[];
  created_at: string;
}

export async function fetchRecentCorrections(
  correctionType: "tender_parse" | "extract_item",
  limit = 30
): Promise<CorrectionRow[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return [];

  try {
    const url = `${supabaseUrl}/rest/v1/ai_corrections?correction_type=eq.${correctionType}&order=created_at.desc&limit=${limit}&select=source_text,ai_output,corrected_output,changed_fields,created_at`;
    const res = await fetch(url, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!res.ok) return [];
    return (await res.json()) as CorrectionRow[];
  } catch {
    return [];
  }
}

export function formatCorrectionsForPrompt(rows: CorrectionRow[]): string {
  if (!rows.length) return "";
  const lines: string[] = [];
  lines.push(
    "ISTORIJA RANIJIH ISPRAVKI (uči iz njih — kad god vidiš sličan input, izbegni iste greške):"
  );
  for (const r of rows) {
    const src = (r.source_text || "").replace(/\s+/g, " ").slice(0, 280);
    const fields = (r.changed_fields || []).join(", ") || "—";
    let aiJson = "";
    let okJson = "";
    try {
      aiJson = JSON.stringify(r.ai_output).slice(0, 500);
      okJson = JSON.stringify(r.corrected_output).slice(0, 500);
    } catch {
      continue;
    }
    lines.push(
      `---\nULAZ: "${src}"\nAI je predložio: ${aiJson}\nKorisnik ispravio (polja: ${fields}): ${okJson}`
    );
  }
  lines.push("---\nKraj istorije. Primeni naučene obrasce ali ne kopiraj doslovno — gledaj logiku ispravki.");
  return lines.join("\n");
}
