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
- code (string) — broj stavke (npr. "1.1", "2.3"); ako ne postoji generiši "1", "2", "3"...
- productName (string) — KONKRETAN naziv proizvoda iz teksta (npr. "B2 poster", "Shelftalker", "Kartolina", "Stiker za frizider", "Roll-up baner"). OBAVEZNO različit za svaku stavku — to je glavni naziv koji korisnik vidi.
- category (string) — širja kategorija/grupa (npr. "POS materijal", "Baneri", "Nalepnice"). Može se ponavljati između stavki.
- description (string) — pun tekstualni opis stavke iz originala (sve specifikacije, materijal, dorada...)
- material (string|null) — naziv materijala iz teksta (npr. "PVC samolepljiva folija", "Forex 5mm", "masni papir")
- printSides (string|null) — "4/0" jednostrano, "4/4" obostrano, null ako nije navedeno
- finishing (string|null) — vrsta dorade (sečenje, kaširanje, plastifikacija...) ili null
- format (string|null) — dimenzije kao tekst (npr. "70x100 cm", "A4", "B2")
- minQtyPerOrder (number|null) — min količina po porudžbini (za m² to je kvadratura jedne stavke)
- uom ("m2"|"pcs") — jedinica mere; "m2" za štampu velikog formata sa dimenzijama, "pcs" inače
- yearlyQty (number) — tražena količina komada; 1 ako nije navedeno
- materialName (string|null) — najbliži naziv iz priloženog kataloga materijala (tačan naziv) ili null. Za productType="digital" UVEK null, jer je katalog za veliki format; papir upiši u paperType/paperGsm.
- productType ("digital"|"large_format") — KLASIFIKACIJA proizvoda. "digital" = svi tabačni proizvodi na papiru/kartonu ≤350g i formatu ≤ A3 (SRA3 488×330): flajeri, leci, vizit karte, plakati A3/A4/A5, pozivnice, čestitke, deklaracije, BROŠURE, KATALOZI, KNJIŽICE, blokovi, memorandumi, fascikle papirne. "large_format" = rolni/rigidni materijali ≥ B2: PVC folije, cerada, baneri, roll-up, forex, plexi, alubond, kapa ploča, stadur, kartonski displeji. ČVRSTA PRAVILA (primeni redom):
  1) Ako tekst pominje "brošur", "katalog", "knjižic", "blok", "flajer", "letak", "vizit", "pozivnic", "čestitk", "memorandum", "letterhead", "deklaracij", "NCR", "obrazac" → ALWAYS digital.
  2) Ako format ≤ A3 (uključujući A4, A5, A6) I materijal je papir/karton/kunstdruk/offset/hromokarton ≤350g → digital.
  3) "Plastifikacija" mat/sjajna NA PAPIRU (npr. korica brošure) ne znači large_format — i dalje je digital.
  4) Materijal sadrži PVC, cerada, forex, plexi, vinil, alubond, kapa ploča, stadur, samolepljiv → large_format.
  5) Format ≥ B2 i nije papir tanji od 350g → large_format.
  Kad nisi siguran između digital i large_format za papirne proizvode A4/A3 manje od 350g → uvek biraj digital.
- paperType (string|null) — za digitalne: tip papira (kunstdruk mat, kunstdruk sjajni, offset, hromokarton, NCR). null za large_format.
- paperGsm (number|null) — gramatura papira u g/m² (npr. 90, 130, 170, 250, 300). Za brošure koristi gramaturu knjižnog bloka.
- pages (number|null) — broj stranica po komadu (za brošure: ukupan obim uključujući koricu, npr. "32 strane + korica" → 36). default 1 za jednolisne digital proizvode.
- widthMm (number|null) — širina jednog komada u milimetrima.
- heightMm (number|null) — visina jednog komada u milimetrima.
- sheetFormat ("488x330"|"700x330"|null) — preporučeni format tabaka za digital. "488x330" je default (SRA3). "700x330" samo za izduženje formate (≥ 488mm po jednoj strani, npr. dugi flajeri 480×100mm).

KRITIČNO za brošure/kataloge/knjižice:
- Brošura sa knjižnim blokom + koricom + povezom je JEDNA stavka digital, NE više stavki. Ne pravi posebne stavke za "korica" i "blok" — to su delovi iste brošure.
- productName = "Brošura A4" (ili sl.), pages = ukupan obim (strane bloka + 4 strane korice ako se računaju), paperType i paperGsm = vrednosti knjižnog bloka, finishing = "Mat plastifikacija korice + klamanje" ili sl.
- productType OBAVEZNO "digital".

Pravila:
- Ignoriši pozdrave, potpise, headere/footere emaila, linkove na fajlove.
- Svaka linija oblika "Naziv – broj komada – opis" je JEDNA stavka. Naziv ide u productName.
- Ako vidiš tabelu, svaki red je jedna stavka.
- Ako tekst nema stavki za štampu, vrati {"rows": []}.
- Za materialName izaberi NAJSLIČNIJI naziv iz kataloga (poklapanje po ključnim rečima). Ako nema razumnog poklapanja vrati null.
- Za m² stavke pokušaj da pročitaš dimenzije i kvadraturu.
- productName NIKAD ne sme biti isti kao category — productName je specifičan ("B2 poster"), category je generalna ("POS materijal").

Domensko znanje (štamparija Gama, Srbija) — koristi za predlog materijala kad u tekstu nije eksplicitno naveden:
- POSTER / PLAKAT / FLAJER / LETAK / BROŠURA / KATALOG → materijal je PAPIR (kunstdruk mat/sjajni 130–250g, offset 80–120g). NIKAD Stadur, Forex ili karton.
- SHELFTALKER / WOBBLER / TOPPER / CENOVNIK na rafu / displej / hard POS → tvrdi materijal: Stadur, Forex (PVC penasti), kapa ploča ili 3-slojni karton. Ako tekst kaže "masni papir" misli se na premazani plakatni papir koji se kaširaju na podlogu.
- NALEPNICA / STIKER / ETIKETA → po defaultu PVC SAMOLEPLJIVA FOLIJA (mat/sjajna). Samo retko na samolepljivom papiru (mi to zovemo "Muflon"). Ako tekst eksplicitno ne kaže "papirna nalepnica" ili "Muflon", uvek predloži PVC samolepljivu.
- KARTOLINA / KARTONSKI DISPLEJ / STOJEĆI KARTON → 3-slojni ili 5-slojni karton (talasasti), često sa kaširanom štampom (papir + lepenka).
- BANER / CERADA / FRONTLIT → PVC cerada (frontlit) 440–510g; MESH za prozračne; BACKLIT za osvetljene.
- ROLL-UP / X-BANER → roll-up film (mat polyester) ili PVC samolepljiva folija.
- ONE WAY / izlog → One way perforirana folija.
- BRANDING auto/zid/podloga → PVC samolepljiva folija (mat ili sjajna), za pod laminacija.

Standardni formati (ako tekst pominje samo naziv formata, popuni "format" sa dimenzijama u cm):
- A0 = 84.1x118.9 cm
- A1 = 59.4x84.1 cm
- A2 = 42x59.4 cm
- A3 = 29.7x42 cm
- A4 = 21x29.7 cm
- A5 = 14.8x21 cm
- A6 = 10.5x14.8 cm
- B0 = 100x140 cm
- B1 = 70x100 cm
- B2 = 50x70 cm  (čest format za plakate/postere)
- B3 = 35x50 cm
- B4 = 25x35 cm
- B5 = 17.6x25 cm
- Citylight / CLP = 118.5x175 cm
- Bilbord / Billboard = 400x300 cm (standardni), megabord = 1200x400 cm
- Roll-up standardni = 85x200 cm (često i 100x200 cm)
- X-baner = 60x160 cm
- Pano / outdoor pano = 200x100 cm (varira)
- Šelftolker (shelftalker) standardni = 7x10 cm do 15x20 cm (popuni samo ako tekst pominje konkretnu dimenziju)
- Wobbler standardni = 8x10 cm do 12x15 cm

Pravila za format:
- Ako je naveden samo naziv (npr. "Plakat B2", "Poster A3", "Roll-up baner"), AUTOMATSKI upiši dimenzije u "format" polje kao "ŠxV cm" (npr. "50x70 cm").
- Ako je tekst eksplicitno dao dimenzije ("70x100", "1m x 2m"), koristi njih i ignoriši standard.
- Ako je proizvod kružan/okrugao (kružne nalepnice, okrugli stiker, round, ø, Ø, fi, prečnik), uzmi prečnik kao i širinu i kao visinu (bounding box). Npr. "prečnik 65 mm" → format = "6.5x6.5 cm". Površina po komadu je tada π·(d/2)² ali za potrebe ponude uzimamo bounding box kvadrat.
- Za productType="digital" uvek postavi uom="pcs" i minQtyPerOrder=null, bez obzira što format ima poznate dimenzije (A4/A3 brošure, katalozi, flajeri...).
- Za productType="large_format" sa poznatim dimenzijama postavi uom="m2" i izračunaj minQtyPerOrder kao kvadraturu jedne stavke u m² (npr. B2 = 0.50 × 0.70 = 0.35 m²).
- Za sitne stvari bez jasnog formata (nalepnice, kartice) ostavi uom="pcs".

Ako materijal nije eksplicitno naveden u tekstu, ALI tip proizvoda jasno implicira materijal po pravilima iznad, popuni "material" sa najlogičnijim materijalom i izaberi odgovarajući materialName iz kataloga. Ne ostavljaj prazno samo zato što tekst nije bukvalno naveo.

KRITIČNO — Specifikacija po varijantama (boje, verzije, modeli):
- Ako tekst ima sekciju "Specifikacija po boji", "Po verziji", "Po modelu", "Razrada", "Količine po boji" ili sl. gde svaka varijanta ima svoju količinu (npr. "Zelene: 500 komada", "Žute: 1500 komada"), NAPRAVI POSEBNU STAVKU za SVAKU varijantu. Svaka stavka dobija količinu te varijante u yearlyQty.
- "Količina (ukupno)", "Ukupno", "Total", "Tiraž ukupno" je SUMA svih varijanti — NIKAD ne koristi taj broj za yearlyQty pojedinačne stavke. Koristi ga samo za proveru (zbir varijanti treba da bude jednak ukupnoj količini).
- "Boje/Verzije: N" ili "Broj boja: N" označava KOLIKO varijanti postoji — to NIJE količina. Ne mešaj broj boja sa brojem komada.
- productName treba da uključuje naziv varijante: "Kružne nalepnice — Zelene", "Kružne nalepnice — Žute" itd.
- Bullet markeri (samostalni "1", "•", "-", "*", "1.", "2.") u listama ignoriši — to su znaci formatiranja, NE količine ni kodovi.
- Primer ulaza:
    "Proizvod: Kružne nalepnice, Materijal: PVC folija, Boje: 2 (zelena, žuta), Količina ukupno: 2000
     Zelene: 500 komada
     Žute: 1500 komada"
  → ROW 1: productName="Kružne nalepnice — Zelene", yearlyQty=500, material="PVC folija"
  → ROW 2: productName="Kružne nalepnice — Žute", yearlyQty=1500, material="PVC folija"
  (NE pravi treću "ukupno" stavku od 2000.)

Katalog materijala:
${catalog || "(prazno)"}`;

    const corrections = await fetchRecentCorrections("tender_parse", 25);
    const correctionsBlock = formatCorrectionsForPrompt(corrections);
    const fullSystem = correctionsBlock
      ? `${systemPrompt}\n\n${correctionsBlock}`
      : systemPrompt;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
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
    const DIGITAL_KEYWORDS = /(brošur|brosur|katalog|knjižic|knjizic|\bblok\b|flajer|letak|lifle|vizit|pozivnic|čestit|cestit|memorandum|letterhead|deklaracij|\bncr\b|obrazac|fascikla papirn|jelovnik|menu kart)/i;
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
      const uom = isDigital ? "pcs" : r.uom === "m2" ? "m2" : "pcs";
      const minQtyPerOrder = isDigital ? null : r.minQtyPerOrder ?? null;
      const materialId = isDigital ? null : matched?.id ?? null;
      const materialName = isDigital ? null : matched?.name ?? null;

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
        minQtyPerOrder,
        uom,
        yearlyQty: typeof r.yearlyQty === "number" && r.yearlyQty > 0 ? r.yearlyQty : 1,
        monthlyQty: null,
        perStoreQty: null,
        comment: null,
        matchedMaterialId: materialId,
        matchedMaterialName: materialName,
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
