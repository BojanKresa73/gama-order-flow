
## Cilj

U postojećoj app (NewWorkOrder → Digitala) zameniti trenutni unos stavki novim "proizvodno orijentisanim" unosom inspirisanim gamaunited.rs kalkulatorom, ali bogatijim: više tipova proizvoda, posebne korice, povez, plastifikacija, sečenje, numeracija/perforacija — sa svim cenama konfigurabilnim kroz Admin.

Postojeća grupna logika (po `coverage × format` sa progresivnim tarifama) ostaje **netaknuta** kao osnovna kalkulacija cene štampe — samo se na vrhu dodaje sloj "Proizvoda" i "Dorada".

## 1) Baza — nove tabele

Sve cene konfigurabilne kroz Admin (`/admin/cenovnik-digital` se proširuje tabovima).

```text
digital_product_types
  code (pk) | name | description | active | display_order
  npr. "katalog" / "flajer" / "poster" / "blok" / "custom"

digital_finishing_types
  code (pk) | name | category (povez|plastifikacija|secenje|numeracija|ostalo)
            | pricing_model (per_copy | per_item | per_sheet | per_m2 | fixed | fixed_plus_per_copy)
            | active | display_order

digital_finishing_prices
  id | finishing_code (fk) | variant (text, npr. "1-strano mat", "klamovanje", "spirala")
     | fixed_cost (numeric) | unit_price (numeric) | min_qty | max_qty | notes
     | active
  npr. povez/klamovanje: fixed=5, unit=0.05 (per_copy)
       plastifikacija/1-strano mat: unit=20 (per_m2) ili per_sheet
       sečenje: fixed=5, unit=0 (po rezu)

digital_product_defaults  (mapiranje proizvod → tip strane, papir, sečenje, default print_sides)
  product_code (fk) | default_paper | default_print_sides | sheets_default_per_copy
```

Sve sa `GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated`, RLS: read svi authenticated, write samo admin/superuser.

Proširenje `digital_jobs`:
- `product_code text null`                — tip proizvoda
- `page_count int null`                   — broj strana (za katalog)
- `page_format text null`                 — A4, A5, custom
- `page_width_mm`, `page_height_mm`       — kad je custom
- `has_cover bool default false`
- `cover_paper text`, `cover_print_sides text`, `cover_lamination text`
- `finishings jsonb default '[]'`         — `[{code, variant, qty, unit_price, fixed_cost, total}]`
- `finishings_total numeric default 0`

## 2) Frontend — novi unos stavke

Komponenta `DigitalProductForm.tsx` zamenjuje trenutni red u `LocalDigitalJobsTable`:

- **Proizvod** (select iz `digital_product_types`) → setuje pametne defaultne vrednosti.
- **Broj primeraka** (tiraž).
- **Format strane** (preset A4/A5/A3 + custom širina/visina mm) — koristi se za izračunavanje broja tabaka po primerku zavisno od mašinskog tabaka (488×330 ili 760×330).
- **Papir unutrašnjosti** (postojeći `digital_paper_types`).
- **Mašinski tabak** (postojeći).
- Za **katalog**: `broj strana (sa koricama)` + checkbox `Posebne korice` → papir korica, štampa korica, plastifikacija korica.
- **Povez** (select kad ima više strana): klamovanje / spirala / lepljeno / šivenje / bez.
- **Dorade**: dinamična lista checkboxova (plastifikacija strana, sečenje, numeracija, perforacija, rupičenje) — svaka sa varijantama (mat/sjaj, 1-/2-strano).

Pri unosu, komponenta automatski generiše interno 1–2 "job entry" (unutrašnjost + korice) koji idu kroz postojeći `calculateGroupedPricing()` za cenu štampe. Dorade se računaju zasebno preko nove `calculateFinishings()` funkcije i dodaju na ukupnu cenu.

## 3) Logika kalkulacije

Novi fajl `src/lib/digitalProductPricing.ts`:

```ts
calculateProductPricing(product, finishingPriceList): {
  printJobs: DigitalJobItem[];      // za grouped pricing
  finishings: FinishingLine[];      // sa total cenom
  finishingsTotal: number;
}
```

Ukupno za nalog =
- postojeći `calculateGroupedPricing(printJobs)` (sa svim pravilima 488/760, 1.5×, progresivni tarifi, papir, klikovi, RUC)
- **+** zbir `finishingsTotal` po svim proizvodima

`DigitalPricingBreakdown` se proširuje sekcijom "Dorada" ispod grupa, sa per-stavka breakdown-om.

## 4) Admin cenovnik — novi tabovi

Na stranici `AdminPriceListDigital` dodati tabove:
- **Tabaci / Coverage** (postojeća `price_list_digital` tabela)
- **Proizvodi** (CRUD `digital_product_types`)
- **Dorade** (CRUD `digital_finishing_types` + `digital_finishing_prices` sa varijantama)

Sve uređivanje admin-only.

## 5) Migracija i kompatibilnost

- Postojeći `digital_jobs` redovi rade i dalje (sva nova polja nullable, `product_code = null` znači "klasičan unos" pa se prikazuje stari editor kao fallback).
- PDF i otpremnica: dodati listu dorada u "Napomene" sekciju digitalnog naloga (bez prikaza cena klijentu, samo opis).
- Stats ostaju iste (gledaju `computed_total_sheets`, `computed_color_clicks`, `computed_mono_clicks` — neizmenjeno).

## Tehnički detalji

- Migracija (1 fajl, 4 tabele + 5 ALTER kolona na `digital_jobs` + seed default proizvoda/dorada).
- Novi hookovi: `useDigitalProductTypes`, `useDigitalFinishingTypes`, `useDigitalFinishingPrices`.
- Novi UI: `DigitalProductForm.tsx`, `FinishingsPicker.tsx`, `AdminProductTypesTab.tsx`, `AdminFinishingsTab.tsx`.
- Engine: `digitalProductPricing.ts` (ne dira `digitalGroupedPricing.ts`).

## Plan u koracima

1. Migracija + seed osnovnih proizvoda i cena dorada.
2. Hookovi za nove tabele.
3. `digitalProductPricing.ts` engine + jedinični check kroz manuelni unos.
4. `DigitalProductForm` + `FinishingsPicker` UI, integracija u `AddDigitalJobsModal` i `LocalDigitalJobsTable`.
5. Proširenje `DigitalPricingBreakdown` sa Dorada sekcijom.
6. Admin tabovi.
7. PDF/otpremnica — dodati listu dorada u napomenama.

Šta NE radi (van opsega ove iteracije): klijentski kalkulator u portalu, slanje upita mailom, podrška za "more od pet boja"/spec papira preko hardcode-a (ide preko admina).
