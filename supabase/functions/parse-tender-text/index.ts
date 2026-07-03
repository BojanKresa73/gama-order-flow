import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { fetchRecentCorrections, formatCorrectionsForPrompt } from "../_shared/ai-corrections.ts";

interface MaterialOption {
  id: string;
  name: string;
  category?: string;
}

interface ParseRequest {
  text: string;
  materials: MaterialOption[];
  defaultMarkupPercent?: number;
}

interface AiRow {
  code: string;
  productName: string;
  category: string;
  description: string;
  material: string | null;
  printSides: string | null;
  finishing: string | null;
  format: string | null;
  minQtyPerOrder: number | null;
  uom: "m2" | "pcs";
  yearlyQty: number;
  materialName: string | null;
  productType?: "digital" | "large_format" | null;
  paperType?: string | null;
  paperGsm?: number | null;
  pages?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  sheetFormat?: "488x330" | "700x330" | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as ParseRequest;
    if (!body?.text || typeof body.text !== "string") {
      return new Response(JSON.stringify({ error: "text je obavezan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY nije konfigurisan" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const materials = Array.isArray(body.materials) ? body.materials.slice(0, 500) : [];
    const catalog = materials.map((m) => `- ${m.name}${m.category ? ` (${m.category})` : ""}`).join("\n");
    const text = body.text.slice(0, 60000);

    const systemPrompt = `Ti si asistent za štampariju koji iz teksta zahteva/tendera/emaila izvlači listu stavki za ponudu.

Vrati JSON objekat sa poljem "rows" — niz objekata sa poljima:
- code (string) — broj stavke ("1.1", "2.3"); ako ne postoji generiši "1", "2", "3"...
- productName (string) — KONKRETAN naziv proizvoda iz teksta.
- category (string) — širja kategorija/grupa.
- description (string) — pun tekstualni opis stavke iz originala.
- material (string|null) — naziv materijala iz teksta.
- printSides (string|null) — "4/0" jednostrano, "4/4" obostrano, null.
- finishing (string|null) — vrsta dorade ili null.
- format (string|null) — dimenzije kao tekst.
- minQtyPerOrder (number|null) — min količina po porudžbini.
- uom ("m2"|"pcs")
- yearlyQty (number)
- materialName (string|null) — najbliži naziv iz kataloga ili null. Za digital UVEK null.
- productType ("digital"|"large_format")
- paperType (string|null)
- paperGsm (number|null)
- pages (number|null)
- widthMm (number|null)
- heightMm (number|null)
- sheetFormat ("488x330"|"700x330"|null)

Standardni formati (cm): A0 84.1x118.9, A1 59.4x84.1, A2 42x59.4, A3 29.7x42, A4 21x29.7, A5 14.8x21, A6 10.5x14.8, B1 70x100, B2 50x70, B3 35x50, CLP 118.5x175.

Klasifikacija:
- brošura/katalog/knjižica/flajer/vizit/pozivnica/memorandum/deklaracija/NCR → digital
- PVC/cerada/forex/plexi/vinil/alubond/stadur/samolepljiv/baner/roll-up/mesh → large_format
- Format ≤ A3 + papir ≤350g → digital
- Format ≥ B2 i nije tanak papir → large_format

Za digital: uom="pcs", minQtyPerOrder=null, materialName=null (papir u paperType/paperGsm).
Za large_format sa dimenzijama: uom="m2", minQtyPerOrder = kvadratura u m².

Katalog materijala:
${catalog || "(prazno)"}`;

    const corrections = await fetchRecentCorrections("tender_parse", 25);
    const correctionsBlock = formatCorrectionsForPrompt(corrections);
    const fullSystem = correctionsBlock ? `${systemPrompt}\n\n${correctionsBlock}` : systemPrompt;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: fullSystem },
          { role: "user", content: text },
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
    let parsed: { rows: AiRow[] } = { rows: [] };
    try {
      parsed = JSON.parse(content);
      if (!Array.isArray(parsed.rows)) parsed.rows = [];
    } catch {
      parsed = { rows: [] };
    }

    const matByName = new Map(materials.map((m) => [m.name.toLowerCase().trim(), m]));
    const DIGITAL_KEYWORDS = /(brošur|brosur|katalog|knjižic|knjizic|\bblok\b|flajer|letak|vizit|pozivnic|čestit|cestit|memorandum|letterhead|deklaracij|\bncr\b|obrazac|fascikla papirn|jelovnik|menu kart)/i;
    const LF_KEYWORDS = /(pvc|cerad|forex|plexi|vinil|alubond|kapa ploč|kapa ploc|stadur|samolepljiv|baner|roll[- ]?up|frontlit|backlit|mesh|one ?way|stiker|nalepnic|displej|kartonski displ)/i;
    const SMALL_FORMAT = /\b(a3|a4|a5|a6|sra3|sra4)\b/i;

    const enriched = parsed.rows.map((r, idx) => {
      const matched = r.materialName ? matByName.get(r.materialName.toLowerCase().trim()) : null;
      const blob = `${r.productName || ""} ${r.category || ""} ${r.description || ""} ${r.format || ""} ${r.material || ""}`;
      let productType: "digital" | "large_format" = r.productType === "digital" ? "digital" : "large_format";
      const isLFMaterial = LF_KEYWORDS.test(blob);
      if (!isLFMaterial) {
        if (DIGITAL_KEYWORDS.test(blob)) productType = "digital";
        else if (SMALL_FORMAT.test(blob) && (r.paperGsm == null || r.paperGsm <= 350)) productType = "digital";
      }
      const isDigital = productType === "digital";
      return {
        rowIndex: idx,
        code: String(r.code ?? idx + 1),
        productName: r.productName || r.category || "Stavka",
        category: r.category || "Stavka",
        rawDescription: r.description || "",
        material: r.material || null,
        printSides: r.printSides || null,
        finishing: r.finishing || null,
        format: r.format || null,
        minQtyPerOrder: isDigital ? null : r.minQtyPerOrder ?? null,
        uom: isDigital ? "pcs" : r.uom === "m2" ? "m2" : "pcs",
        yearlyQty: typeof r.yearlyQty === "number" && r.yearlyQty > 0 ? r.yearlyQty : 1,
        monthlyQty: null,
        perStoreQty: null,
        comment: null,
        matchedMaterialId: isDigital ? null : matched?.id ?? null,
        matchedMaterialName: isDigital ? null : matched?.name ?? null,
        productType,
        paperType: r.paperType ?? null,
        paperGsm: typeof r.paperGsm === "number" ? r.paperGsm : null,
        pages: typeof r.pages === "number" && r.pages > 0 ? r.pages : null,
        widthMm: typeof r.widthMm === "number" ? r.widthMm : null,
        heightMm: typeof r.heightMm === "number" ? r.heightMm : null,
        sheetFormat: r.sheetFormat === "700x330" ? "700x330" : "488x330",
      };
    });

    return new Response(JSON.stringify({ rows: enriched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-tender-text error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Nepoznata greška" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
