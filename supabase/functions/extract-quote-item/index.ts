import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { fetchRecentCorrections, formatCorrectionsForPrompt } from "../_shared/ai-corrections.ts";

interface MaterialOption { id: string; name: string; }
interface ExtractRequest { text: string; materials: MaterialOption[]; }
interface ExtractResult {
  widthCm: number | null;
  heightCm: number | null;
  quantity: number | null;
  printSides: "4/0" | "4/4" | null;
  materialId: string | null;
  materialName: string | null;
  notes: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as ExtractRequest;
    if (!body?.text || typeof body.text !== "string") {
      return new Response(JSON.stringify({ error: "text je obavezan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY nije konfigurisan" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const materials = Array.isArray(body.materials) ? body.materials.slice(0, 500) : [];
    const catalog = materials.map((m) => `- ${m.id} :: ${m.name}`).join("\n");

    const systemPrompt = `Ti si asistent za štampariju koji iz slobodnog opisa stavke ponude izvlači strukturisane podatke.
Vrati JSON sa poljima:
- widthCm (number|null), heightCm (number|null)
- quantity (number|null)
- printSides ("4/0"|"4/4"|null)
- materialId (string|null) — UUID iz kataloga ili null
- materialName (string|null)
- notes (string|null)

Dimenzije: "broj x broj" = širina × visina. Jedinice: mm/10, m*100, cm ostavi. Ako nije navedeno, cm.
"jednostrano"/"4+0" = "4/0". "obostrano"/"4+4" = "4/4".
Količina: eksplicitne oznake ("kom", "500 kom", "tiraž"). Samostalni broj na početku linije = redni broj (quantity=null).
A-formati: A3=29.7x42, A4=21x29.7, A5=14.8x21.
3D dimenzije (105x13x58cm): uzmi dve najveće, treću u notes.
Materijal: najbliže poklapanje po nazivu. Null ako nema dobrog matcha.

Katalog materijala (id :: naziv):
${catalog || "(prazno)"}`;

    const corrections = await fetchRecentCorrections("extract_item", 25);
    const correctionsBlock = formatCorrectionsForPrompt(corrections);
    const fullSystem = correctionsBlock ? `${systemPrompt}\n\n${correctionsBlock}` : systemPrompt;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: fullSystem },
          { role: "user", content: body.text },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errText);
      return new Response(
        JSON.stringify({ error: `AI greška (${aiRes.status})`, detail: errText }),
        {
          status: aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: ExtractResult;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { widthCm: null, heightCm: null, quantity: null, printSides: null, materialId: null, materialName: null, notes: "AI nije vratio validan JSON" };
    }

    if (parsed.materialId) {
      const found = materials.find((m) => m.id === parsed.materialId);
      if (!found) {
        const byName = materials.find((m) =>
          parsed.materialName && m.name.toLowerCase().trim() === parsed.materialName.toLowerCase().trim()
        );
        if (byName) { parsed.materialId = byName.id; parsed.materialName = byName.name; }
        else parsed.materialId = null;
      } else parsed.materialName = found.name;
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("extract-quote-item error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Nepoznata greška" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
