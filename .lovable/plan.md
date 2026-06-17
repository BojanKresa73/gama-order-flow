## Šta predlažem

Cenovnik (`client_plate_prices`) trenutno čuva **samo jednu cenu po klijentu i formatu**, bez datuma. To znači da bi prosto ažuriranje cena promenilo i izračun za stare naloge u XML eksportu (jer XML vuče trenutnu cenu iz cenovnika). Da bi stari nalozi zadržali stare cene, dodaću datum važenja u cenovnik.

## Plan

### 1. Migracija baze
- Dodati kolonu `valid_from DATE NOT NULL DEFAULT '2000-01-01'` u `client_plate_prices`.
- Postojeće cene zadržati kao važeće od `2000-01-01` (osnova).
- Zameniti jedinstveni indeks `(client_id, plate_format_id)` sa `(client_id, plate_format_id, valid_from)`.
- Iz Excel fajla ubaciti **nove cene sa `valid_from = 2026-06-15`** za 41 klijenta (≈70 redova). Nove MONO cene se postavljaju samo gde su date u Excelu (Euro-Dream, SIMPrint, Pekograf).

### 2. XML eksport (batch i pojedinačni)
- U `src/lib/minimaxBatchExport.ts` i `src/pages/WorkOrderDetails.tsx`: dohvatiti sve cene klijenta i po formatu birati red sa **najvećim `valid_from` ≤ `work_order.created_at`**. Tako nalozi otvoreni do 14.06.2026 koriste stare cene, a od 15.06.2026 nove.

### 3. Dijalog "Cenovnik ploča"
- Trenutno `delete + insert` briše istoriju. Preraditi da menja samo **najnoviji** red (max `valid_from`) za dati klijent/format. Novi unos formata se kreira sa `valid_from = today`.
- U dijalog dodati malu napomenu i prikaz datuma važenja trenutno prikazane cene.

### 4. Stats / izveštaji
- `get_ctp_revenue`, `get_ctp_consumption_by_format` (RPC) i `CtpPriceIncreaseAnalysis` koriste cenovnik bez datuma. Ostavljam ih kao "trenutne cene" (najnoviji red), pošto su to analitički prikazi — može se posebno doraditi ako želiš da koriste cenu važeću na datum naloga.

## Stvari koje su mi delovale nelogično u Excel-u

1. **Format `1030×790` (sa znakom ×) vs `1030x790` (sa x)** — u bazi postoji samo `1030×790`. JP Službeni glasnik ima u Excelu i `1050x795` (4811 tabaka) ali u bazi taj format ima drugi klijent. Nije problem, samo upozorenje da mapiranje radi po tačnom nazivu formata iz baze.
2. **Pekograf**: u DB ima MONO cene i za `450x370` i `510x400` (jednake redovnoj 2.20). Excel za njih ne daje novu MONO cenu — pa ću MONO ostaviti na 2.20 (bez povećanja), a nova cena samo za 745×605 (MONO 2.9 → 3.16).
3. **Grafikum d.o.o.** ima skok od **20%** (2.50 → 3.00). Ostalo je 4–12%. Pretpostavljam namerno, ali ti potvrdi.
4. Nekoliko klijenata u Excelu (npr. `Grafo-M`, `Adore Chocolat`, `Matija`, `Typoprint`, `Doubleclick`, `Zlamen`) imaju samo po 1–6 tabaka istorije — povećanje će se primeniti, ali efekat je zanemarljiv.

Potvrdi da krenem (ili reci šta da promenim — npr. drugi datum, drugačije rukovanje Grafikumom, itd).
