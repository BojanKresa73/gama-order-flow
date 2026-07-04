## Cilj
GDC Order = source of truth za sve što se tiče uvoza i parsiranja ponuda. U ovom projektu se sve dovodi 1:1 na GDC verziju, bez lokalnih „poboljšanja" koja divergiraju od GDC-a.

## Šta se uvozi iz GDC (verbatim, gde god je moguće)

### Edge funkcija
- `supabase/functions/parse-tender-text/index.ts` → prepiši 1:1 GDC verzijom (sadrži pravila za brošure/kataloge, varijante po boji, shelftalker/wobbler pravila, ø/prečnik, standardne formate).

### `src/lib/`
- `tenderImport.ts` — puna verzija iz GDC: `parseTenderWorkbook` (Excel), `autoMatchMaterials` (Fuse.js + sinonimi), `extractDimensionsMm`, `extractFormat`, `extractQuantity`, `extractPrintSides`, `normalizePrintSides`, `extractFinishing`, `extractMaterial`, `recomputeRow`, tip `ParsedTenderRow`.
- `quotePricing.ts` — GDC verzija (`computeLargeFormatPricing`, `defaultTonerCostEur`, `EUR_TO_RSD`, `deriveStoredTonerCostPerM2Eur`, montaža).
- `materialPriceFallback.ts` — `resolveMaterialEurPerM2` (nema ga u projektu).

### `src/hooks/`
- `useAiCorrections.ts` — `useLogAiCorrection` + tip `CorrectionType` (few-shot learning). Pretpostavlja tabelu `ai_corrections` u bazi (proveriti; ako fali → migracija sa GRANT + RLS).

### `src/components/quotes/`
- `ImportTenderDialog.tsx` — puni GDC dijalog (Excel/Word/TXT/EML upload + paste, preview tabela sa Digital/Veliki format badge-ovima, edit UOM/marža/dorada, auto match materijala, cene iz cenovnika, uvoz).
- Postojeći `PasteItemsDialog.tsx` i `TenderImportItemsDialog.tsx` se **brišu** — `ImportTenderDialog` ih zamenjuje (dva ulaza: `initialMode="file"` i `initialMode="paste"`).

### Zavisnosti koje se pretpostavljaju već postoje
- `useLargeFormatMaterials` + `useLargeFormatMaterialsWithPrices` (koriste se u projektu — GDC kompatibilne).
- `digitalCalculations` (`calculateItemPrice`, `calculateItemClickCost`, `calculatePiecesPerSheet`) — postoji.
- `supabase/functions/_shared/ai-corrections.ts` — postoji.

## Adaptacije (samo integracija, ne logika)
`ImportTenderDialog` u GDC-u koristi `useBulkInsertQuoteItems` + `useRecalculateQuoteTotals` iz `useQuotes` i tip `QuoteItem` sa poljima `pages/print_sides/paper_type/paper_gsm/sheet_format/...`. Ovaj projekat koristi `useQuotesPro` sa `useBulkInsertQuoteItemsPro`. Rešenje:
1. Sve GDC-specifična polja na `quote_items` insertu (pages, print_sides, paper_*, sheet_format, source_category, min_qty_per_order, yearly_qty, custom_price, cost_per_m2, supplier_*, service_*) — mapiraju se na najbliža polja ovog projekta preko `...(digital ?? {})` spread pattern-a koji već postoji. Nepostojeća polja se prosto izostavljaju iz insert payload-a (Supabase klijent ih ignoriše).
2. `useRecalculateQuoteTotals` → ekvivalent iz `useQuotesPro` (ako postoji) ili tiho izostaviti (totals se već računaju iz `line_total`).
3. `logCorrection` — koristi se samo ako tabela `ai_corrections` postoji; inače hook interno tiho preskače.

## Šta se briše iz projekta (jer je zamenjeno GDC-om)
- `src/lib/printClassifier.ts` — logika je već u parse-tender-text edge funkciji.
- `src/lib/digitalSpecExtractor.ts` — GDC ne koristi lokalnu re-ekstrakciju; sva polja dolaze direktno iz AI odgovora.
- `src/lib/parsedItemToProductDraft.ts` — nije deo GDC toka.
- Prilagođena logika iz trenutnog `tenderImport.ts` (`classifyPrintType` sekundarna klasifikacija, `extractDigitalSpec` post-processing) — GDC to ne radi, AI odgovor je autoritativan.

## Ulazne tačke u UI
- Dugmad u `QuoteDetails.tsx` / drugde koja su otvarala `PasteItemsDialog` / `TenderImportItemsDialog` → sada otvaraju `ImportTenderDialog` sa `initialMode="paste"` odnosno `"file"`.

## Detalji integracije quote_items schema
Za digital red iz `handleImport`:
```
{ quote_id, item_type: "digital", name, description, quantity,
  width_mm, height_mm, pages, print_sides, paper_type, paper_gsm,
  sheet_format, unit_cost, unit_price, line_total, finishing_cost: 0,
  order_index }
```
Za large_format red analogno bez digital polja + `material_id`, `material_name`, `area_m2`, `cost_per_m2`.

## Verifikacija
1. `tsgo --noEmit` čist.
2. Paste flow: nalepiti primer katalog/flajer tekst → očekuje se Digital badge, `pages`, `sheet_format`, `sides`, cena iz digital tarife (nije 0).
3. Excel flow: uvesti test .xlsx tender → očekuje se struktura sa mapiranim materijalima i m² cenama.

## Van scope-a
- Nikakva nova UI polja niti "poboljšanja" izvan GDC verzije.
- Ništa se ne menja u `digitalCalculations`, `digitalProductPricing`, `DigitalProductDialog`.
