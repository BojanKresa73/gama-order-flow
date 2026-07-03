## Cilj

Ponude u ovom projektu treba da izgledaju i funkcionišu **1:1 kao u GDC Order**:
- `/quotes` — lista sa statistikama, quick filterima i tabelom
- `/quotes/new` — puna stranica za kreiranje (izbor klijenta + uslovi)
- `/quotes/:id` — puna stranica sa headerom, sažetkom cena, tabelom stavki, side-panelom (kolaboratori, aktivnost, verzije)

Trenutno stanje:
- `/quotes` je **stari legacy** modul (Quick Calc + Paste + PDF import nad `quick_calc_quotes`)
- `/quotes-pro` je novi PRO modul ali sa **dialog editor** UX-om
- Baza već ima `quotes`, `quote_items`, `quote_activities`, `quote_collaborators` (isti model kao GDC)

## Šta se radi

### 1. Sklanjanje / preraspoređivanje starog

- Legacy `/quotes` (Quick Calc + Paste + PDF import) selim na **`/quotes-legacy`** (link ostaje u meniju kao „Ponude (legacy alati)" dok se ne dogovori šta sa njim).
- `/quotes-pro` gasim — sve što je vredno (hookovi, edge funkcije, PDF adapter, aktivnosti/kolaboratori) ostaje i pretače se u nove komponente.
- Route `/quotes` postaje novi PRO list view.

### 2. Nove stranice (portovane iz GDC)

- **`src/pages/Quotes.tsx`** — prepisana da bude 1:1 kopija GDC verzije (header + 4 stats kartice + `QuoteQuickFilters` + filter bar + tabela sa revizijom, PIB-om, „ističe uskoro" bedžom, akcijama Dupliraj/Obriši, AlertDialog za brisanje).
- **`src/pages/QuoteNew.tsx`** — kopija GDC forme: `Popover` combobox za klijenta, `QuickAddClientDialog` (prospect), naziv posla, rok važenja, rok isporuke, marža, uslovi plaćanja, napomene, interna napomena, prefill iz `quickCalc:pendingItems:v1` sessionStorage.
- **`src/pages/QuoteDetails.tsx`** — kopija GDC stranice: sticky header sa statusom, „Konvertuj u radni nalog", „Dupliraj", „Sačuvaj PDF", „Nova verzija", inline editor napomena/popusta, compact summary bar (stavke, montaža, izlazak na teren, popust, ukupno €/kom), tabela stavki, side panel (kolaboratori + aktivnost + verzije).

### 3. Portovane komponente `src/components/quotes/`

Iz GDC se portuju (delimično adaptirane na naš schema):
- `QuoteQuickFilters.tsx`
- `QuoteItemsTable.tsx`, `AddQuoteItemDialog.tsx`, `EditQuoteItemDialog.tsx`
- `InlineJobName.tsx`
- `QuoteStatusActions.tsx`, `SendQuoteDialog.tsx` (mapira na naš `send-quote-pro-email`)
- `SetTargetPriceDialog.tsx`
- `QuoteCollaboratorsCard.tsx`, `QuoteActivityTimeline.tsx` (koriste postojeće hookove `useQuoteCollaborators`, `useQuoteActivities`)
- `QuoteFloatingPriceSummary.tsx`
- `QuoteVersionHistory.tsx`
- `ChangeClientDialog.tsx`
- `ImportTenderDialog.tsx` (mapira na naš `parse-tender-text` edge fn)
- `MaterialCombobox.tsx` (već postoji — proveriti kompatibilnost sa GDC verzijom)
- `QuickAddClientDialog.tsx` — nova komponenta u `src/components/clients/`

**Namerno se NE portuju** (zavise od GDC specifičnog work-order modela / digital jobs pipelina koji ovde nema smisla):
- `ConvertToWorkOrderDialog.tsx` — dugme ostaje ali otvara toast „Uskoro" dok se ne definiše mapiranje na naš `work_orders`
- `DigitalJobDialog.tsx`, `DigitalItemDetail.tsx`, `DigitalJobInlineEditor.tsx`, `DigitalWorkspacePanel.tsx` — Digital modul kod nas već postoji zasebno (`digital_jobs`), integracija je posebna faza
- `QuoteCalculationWorkspace.tsx`, `MaterialsCostPanel.tsx`, `WasteOptimizer.tsx` — advanced kalkulator, ide u kasniju fazu

### 4. Hookovi

- `src/hooks/useQuotesPro.ts` **preimenuje se** u `src/hooks/useQuotes.ts` sa istim API-jem kao GDC (`useQuotes(filters)`, `useQuote(id)`, `useCreateQuote`, `useUpdateQuote`, `useDeleteQuote`, `useDuplicateQuote`, tipovi `QuoteFilters`, `QuoteStatus`, `QuoteQuickFilter`).
- Sve postojeće import putanje iz `/quotes-pro` komponenata koje ostaju u projektu se refaktorišu.

### 5. Routing (`src/App.tsx`)

```text
/quotes           → Quotes (nova PRO lista)
/quotes/new       → QuoteNew
/quotes/:id       → QuoteDetails
/quotes-legacy    → stari Quick Calc / Paste / PDF import
/quotes-pro       → redirect na /quotes
```

Svi zaštićeni `AdminGuard`-om kao i sada.

## Tehnički detalji

- Baza: **bez novih migracija** — schema `quotes`/`quote_items` već je usklađena sa GDC modelom (37 + 79 kolona).
- Iznosi u GDC-u su interno u RSD i deljeni sa 117.55 → kod nas su već u EUR (`unit_price`, `line_total`, `final_price` u EUR). Zamenjujem `Number(x) / 117.55` sa `Number(x)` u portovanim delovima.
- `DashboardLayout` GDC-a menjam našim `<AppHeader />` wrapperom (isti pattern kao ostale stranice).
- `useClients()` GDC vs naš — proveriti šta vraća (`is_prospect`, `pib`, `adresa`, `grad`, `email`). Ako fali `is_prospect`, prospect UI se skriva.
- PDF: koristi postojeći `generateQuoteProPdf` (preimenovan po potrebi).
- Email: postojeći `send-quote-pro-email` edge fn.
- Tender import: postojeći `parse-tender-text` edge fn.

## Faze (izvršenje)

1. **Faza A — struktura**: rename hookova, novi routing, `/quotes-legacy` premeštanje, `Quotes.tsx` port (lista + stats + filteri).
2. **Faza B — kreiranje**: `QuoteNew.tsx` + `QuickAddClientDialog` + portovan `QuoteQuickFilters`.
3. **Faza C — detalj**: `QuoteDetails.tsx` sa headerom, summary barom, tabelom stavki (`QuoteItemsTable`, `AddQuoteItemDialog`, `EditQuoteItemDialog`, `InlineJobName`, `SetTargetPriceDialog`, `ChangeClientDialog`).
3. **Faza D — side panel**: `QuoteCollaboratorsCard`, `QuoteActivityTimeline`, `QuoteVersionHistory`, `QuoteFloatingPriceSummary`.
4. **Faza E — akcije**: `QuoteStatusActions`, `SendQuoteDialog`, `ImportTenderDialog`, PDF download, dupliranje/nova verzija.

Posle svake faze — build check + kratak vizuelni preview.

## Šta se NE menja u ovom prolazu

- Backend schema (quotes / quote_items / quote_activities / quote_collaborators)
- Edge funkcije (`send-quote-pro-email`, `parse-tender-text`, `extract-quote-item`, `notify-expiring-quotes`)
- Ostali moduli (work-orders, checklist, digital, film, CTP)
- Konvertovanje ponude u radni nalog (ostavlja se placeholder)
- Digital jobs pipeline unutar ponude (posebna faza)
