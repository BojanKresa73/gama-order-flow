/**
 * Rule-based classifier that decides whether a quote item is digital print
 * or large format based on free text, format dimensions and paper spec.
 *
 * Design goals:
 *  - Deterministic and explainable (returns list of matched signals).
 *  - Precision > recall: only overrides "other" or a weak AI guess when
 *    a strong signal is present.
 */

export type PrintClass = "digital" | "large_format" | "other";

export interface ClassifierInput {
  text?: string | null;           // free text (name + description + material)
  widthMm?: number | null;
  heightMm?: number | null;
  paperType?: string | null;
  paperGsm?: number | null;
  aiGuess?: PrintClass;           // productType from AI, if any
}

export interface ClassifierResult {
  type: PrintClass;
  confidence: "high" | "medium" | "low";
  reasons: string[];
}

// --- Vocabularies -----------------------------------------------------------

/** Materials/products that are ONLY produced on large-format machines. */
const LF_MATERIAL_RX = /\b(pvc\b|cerad\w*|forex|plexi\w*|pleksi\w*|akril|vinil|alubond|aludibon|aluminij\w*|kapa\s*ploč\w*|kapaploc\w*|stadur|samolepljiv\w*|nalepnic\w*|sticker|baner|banner|frontlit|backlit|mesh|one[\s-]?way|jednosmerna\s*folij|roll[\s-]?up|rolap|displej|kartonski\s*displ|x[- ]?banner)/i;

/** Product types that are ALWAYS digital printing. */
const DIGITAL_PRODUCT_RX = /\b(brošur\w*|brosur\w*|katalog\w*|knjižic\w*|knjizic\w*|flajer\w*|letak|letka|vizit[\s-]?kart\w*|vizitk\w*|pozivnic\w*|čestitk\w*|cestitk\w*|memorandum\w*|letterhead|deklaracij\w*|\bncr\b|obrazac|obrasc\w*|jelovnik|menu[\s-]?kart\w*|bloków?|blok\w*|kalendar\w*|razglednic\w*|program\s*knjižic|papirn\w*\s*fascikl)/i;

/** Paper materials (digital / offset). */
const PAPER_RX = /\b(kunzdruk|kunsdruk|kuncdruk|offset\s*papir|mat\s*papir|sjaj\s*papir|hromo\s*karton|hromolux|munken|invercote|kraft\s*papir|nepremaz|premaz)\b/i;

/** Bookbinding / finishings only used on paper-based products. */
const DIGITAL_FINISHING_RX = /\b(klamerov\w*|klamer\w*|šiveno\s*klamer|siveno\s*klamer|meki\s*povez|tvrdi\s*povez|spirala|wire[- ]?o|topli\s*lepak|lepljen\w*|plastifikacij\w*\s*korice|obrezan\w*\s*na\s*format|povez\w*|falcov\w*|bigov\w*\s*korice)/i;

/** Small paper formats (A-series + SRA/B tail). */
const SMALL_FORMAT_RX = /\b(a[3-7]|sra[3-4]|b[3-6])\b/i;
/** Large-only formats (B0-B2, A0-A2, CLP). */
const LARGE_FORMAT_RX = /\b(a[0-2]\b|b[0-2]\b|clp|jumbo|billboard|bilbord)/i;

// --- Core classifier --------------------------------------------------------

export function classifyPrintType(input: ClassifierInput): ClassifierResult {
  const text = (input.text ?? "").toLowerCase();
  const paper = `${input.paperType ?? ""}`.toLowerCase();
  const blob = `${text} ${paper}`;

  const reasons: string[] = [];
  let lfScore = 0;
  let dgScore = 0;

  // 1. Explicit large-format materials.
  const lfMatMatch = blob.match(LF_MATERIAL_RX);
  if (lfMatMatch) {
    lfScore += 5;
    reasons.push(`LF materijal: "${lfMatMatch[0]}"`);
  }

  // 2. Explicit large-format formats (A0..A2, B0..B2, CLP, billboard).
  if (LARGE_FORMAT_RX.test(blob)) {
    lfScore += 3;
    reasons.push("veliki format (A0-A2 / B0-B2 / CLP)");
  }

  // 3. Digital product type.
  const dgMatch = blob.match(DIGITAL_PRODUCT_RX);
  if (dgMatch) {
    dgScore += 4;
    reasons.push(`digitalni proizvod: "${dgMatch[0]}"`);
  }

  // 4. Digital finishing (klamerom, meki povez, plastifikacija korice…).
  const dfMatch = blob.match(DIGITAL_FINISHING_RX);
  if (dfMatch) {
    dgScore += 3;
    reasons.push(`digitalna dorada: "${dfMatch[0]}"`);
  }

  // 5. Paper spec present → digital.
  if (PAPER_RX.test(blob)) {
    dgScore += 2;
    reasons.push("papir prepoznat");
  }
  if (typeof input.paperGsm === "number" && input.paperGsm > 0 && input.paperGsm <= 400) {
    dgScore += 1;
    reasons.push(`gramaža ${input.paperGsm}g ≤ 400`);
  }

  // 6. Small format A3..A7 / SRA / B3..B6 → digital.
  if (SMALL_FORMAT_RX.test(blob)) {
    dgScore += 2;
    reasons.push("mali format (A3-A7 / SRA / B3-B6)");
  }

  // 7. Dimensions.
  const w = input.widthMm ?? 0;
  const h = input.heightMm ?? 0;
  const maxDim = Math.max(w, h);
  const areaM2 = (w * h) / 1_000_000;
  if (maxDim > 0) {
    if (maxDim <= 500 && areaM2 <= 0.25) {
      dgScore += 2;
      reasons.push(`dimenzije ${w}×${h} mm (≤ SRA3)`);
    } else if (maxDim >= 700 || areaM2 >= 0.5) {
      lfScore += 2;
      reasons.push(`dimenzije ${w}×${h} mm (≥ B2 ili ≥ 0.5 m²)`);
    }
  }

  // 8. AI hint counts as a soft signal.
  if (input.aiGuess === "digital") { dgScore += 1; reasons.push("AI: digital"); }
  else if (input.aiGuess === "large_format") { lfScore += 1; reasons.push("AI: large_format"); }

  // --- Decision ---
  // Large-format material is a hard override even against many digital signals.
  if (lfMatMatch && dgScore < lfScore + 3) {
    return { type: "large_format", confidence: "high", reasons };
  }
  if (dgScore >= lfScore + 3 && dgScore >= 3) {
    return { type: "digital", confidence: "high", reasons };
  }
  if (lfScore >= dgScore + 3 && lfScore >= 3) {
    return { type: "large_format", confidence: "high", reasons };
  }
  if (dgScore > lfScore && dgScore >= 2) {
    return { type: "digital", confidence: dgScore >= 4 ? "high" : "medium", reasons };
  }
  if (lfScore > dgScore && lfScore >= 2) {
    return { type: "large_format", confidence: lfScore >= 4 ? "high" : "medium", reasons };
  }
  // Fall back to AI hint or "other".
  if (input.aiGuess && input.aiGuess !== "other") {
    return { type: input.aiGuess, confidence: "low", reasons: [...reasons, "fallback: AI hint"] };
  }
  return { type: "other", confidence: "low", reasons };
}
