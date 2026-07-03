## Cilj

Portovati kompletan koncept **Ponuda** iz GDC Order projekta u ovaj projekat 1:1 — bez diranja postojećeg modula Nabavka ploča. Katalog materijala i cenovnici se čitaju **read-only iz GDC baze** kroz već postojeći `supabaseGDC` klijent.

## Šta ostaje netaknuto

- `/procurement` (ploče, forecast, arrivals) — ne diramo.
- `client_plate_prices`, `plate_formats`, `procurement_orders*` — ne diramo.
- CTP/FILM/DIGITALA/RAZNO radni nalozi — ne diramo (osim konverzije Ponuda → Radni nalog kao novi tok).

## Faza 1 — Schema (jedna migracija)

Uskladiti bazu sa GDC modelom Ponuda. Trenutne `quotes`/`quote_items` proširiti dodatnim kolonama koje nedostaju, dodati prateće tabele.

**Nove/proširene tabele:**
- `quotes` — dodati: `parent_quote_id`, `revision_number`, `target_price_eur`, `sent_at`, `expires_at`, `superseded_at`, `converted_work_order_id`, `sent_to_email`, `sent_snapshot` (jsonb).
- `quote_items` — dodati sve GDC kolone (digital_spec jsonb, sheet_finishing_*, installation_*, finishing_*, source_category, billable_qty/unit, order_index) — najvećim delom već postoje.
- `quote_activities` (već postoji trigger `fn_log_quote_change`) — samo verifikacija.
- **novo:** `quote_collaborators` (već postoji), `quote_expiry_notifications` (postoji).
- **novo:** `quote_digital_jobs` — GDC odvaja detaljnu digitalnu spec od `quote_items`.
- **novo:** `quote_material_snapshots` — snapshot GDC materijala/cena na trenutak slanja (za istorijsku tačnost).

**RPC funkcije (port iz GDC):**
- `duplicate_quote(p_quote_id, p_as_new_version)` — već postoji.
- `next_quote_number()` — već postoji.
- `expire_old_quotes()` — već postoji (cron).
- **novo:** `convert_quote_to_work_order(p_quote_id, p_kind)` — kreira `work_orders` + prenesi stavke po tipu.
- **novo:** `recalculate_quote_totals(p_quote_id)` — server-side rekalkulacija (deo klijent, deo baze).

Sve nove tabele dobijaju GRANT za `authenticated`/`service_role` i RLS po istom modelu kao postojeće (autor + saradnici + admin+).

## Faza 2 — Hookovi (paritetno sa GDC/src/hooks)

Portovati:
- `useQuotes` (list/filter/CRUD, snapshot, konverzija) — proširiti postojeći `useQuotesPro`.
- `useQuoteActivities` (timeline).
- `useQuoteCollaborators` (dodavanje/uklanjanje, realtime).
- `useKasiranjeSettings`, `useFinishingPrices`, `useDigitalPriceList`, `useDigitalPaperTypes`, `useToners`, `useSheetRemnants`, `usePrintingMachines`, `useLargeFormatMaterials` — svi read-only iz GDC baze preko `supabaseGDC`.
- `useIncomingInvoices` — read-only iz GDC (za info o nabavnim cenama u MaterialsCostPanel).

## Faza 3 — Komponente (paritetno sa GDC/src/components/quotes)

Portovati komponente redom prioriteta:

**Kritične (za /quotes/:id):**
- `AddQuoteItemDialog` (tabovi: Digital / LFP / Sitna / Ostalo)
- `EditQuoteItemDialog`
- `QuoteFloatingPriceSummary` (lebdeći totali)
- `QuoteStatusActions` (draft → sent → accepted/rejected/expired)
- `SendQuoteDialog` (email sa PDF-om preko edge funkcije)
- `ConvertToWorkOrderDialog`
- `MaterialsCostPanel` (nabavna vs prodajna, marža po stavci)
- `QuoteActivityTimeline`
- Refactor postojećeg `QuoteItemsTable` da odgovara GDC-u (digital podstavke, inline editori).

**Dodatne (Full 1:1):**
- `ChangeClientDialog`, `SetTargetPriceDialog`, `WasteOptimizer`
- `QuoteCollaboratorsCard`, `QuoteVersionHistory`
- `DigitalItemDetail`, `DigitalJobDialog`, `DigitalJobInlineEditor`, `DigitalWorkspacePanel`
- `InlineJobName`, `ImportTenderDialog`
- `QuoteCalculationWorkspace` (glavni orkestrator radne površine)

## Faza 4 — Stranice

- `/quotes` — refactor `Quotes.tsx` prema GDC listi (napredni filteri, kolone, akcije).
- `/quotes/new` — GDC tok kreiranja.
- `/quotes/:id` — GDC layout: leva strana stavke + Materials/Cost/Activity paneli, desna strana `QuoteFloatingPriceSummary`, gornji `QuoteStatusActions`.

## Faza 5 — Edge funkcije

Portovati iz GDC:
- `send-quote-email` (Resend, PDF attachement).
- `quote-to-pdf` (server render PDF-a stavki i totala).
- `expire-quotes-cron` (već imamo `expire_old_quotes`).

## Faza 6 — Verifikacija

- Typecheck.
- Playwright smoke: /quotes → /quotes/new → dodaj 2 stavke (LFP + Digital) → snimi → /quotes/:id → dodaj stavku kroz `AddQuoteItemDialog` → promeni status → screenshot totala.

## Tehničke napomene

- **Read-only GDC pristup:** sve cene se čitaju kroz `supabaseGDC` iz `useLargeFormatPricing`, `useDigitalPriceList` itd. Prilikom slanja ponude, sačuvamo snapshot u `quote_material_snapshots` da istorijski totali ne zavise od budućih izmena cena u GDC-u.
- **Bez diranja ploča:** svaka nova SQL i UI izmena mora izbeći `procurement_orders*`, `plate_formats`, `client_plate_prices`, `file_entries`.
- **Radni nalog konverzija:** koristimo postojeći `work_orders` model, mapiramo tip stavke u odgovarajući `kind` (LFP→ROLNA/PLOCA, Digital→DIGITALA, Sitna→RAZNO).

## Isporuka

Zbog obima (~30 fajlova + migracija + edge funkcije), rad ću voditi kroz **više uzastopnih sesija**, po fazama gore. Predlog: krenuti od Faze 1 (migracija) i Faze 2 (hookovi), pa Faze 3 tokom sledećih rundi.

## Pitanje pre početka

Da li da odmah otvorim Fazu 1 migraciju i pošaljem je na tvoju potvrdu?
