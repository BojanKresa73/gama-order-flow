# Istorijska sinhronizacija Gama United (Minimax 79412) – plan

## Cilj
Read-only preuzimanje istorijskih finansijskih podataka samo za org 79412 (PIB 114876455), etapno, po godinama, bez duplikata, sa karticom „Kontrola podataka" i kasnijim povezivanjem Borisa.

## Bezbednost (nepromenljivo)
- Org 79412 fiksiran na serveru; 52515 i 51495 odbijaju se u svakom zahtevu.
- Prema Minimax-u samo GET. Ne diraju se nalozi, proizvodnja, cenovnici.
- Sve nove tabele privatne: čitanje samo uz `has_finance_access()` (Bojan, Natalija); upis samo server.
- Nepoznate vrednosti ostaju prazne sa statusom „Potrebna provera", nikad nula.
- Bez objavljivanja aplikacije dok ne potvrdite.

## Etape (svaka se pokreće i proverava posebno)
1. Kupci i dobavljači (šifarnik partnera).
2. Izlazni dokumenti: fakture, predračuni, avansni, konačni, storna, knjižna odobrenja kupcima, strane valute.
3. Ulazni dokumenti: fakture, avansi, odobrenja dobavljača, USD; PDV iz PDV evidencije (odbitni / nepriznati odvojeno).
4. Nalozi za knjiženje i stavke glavne knjige, po godinama.
5. Naplata, obaveze, bankarski izvodi.

Svaka etapa radi u paketima po godini, pamti dokle je stigla (nastavak posle prekida), a ponovni uvoz ažurira postojeći zapis po Minimax ID-ju (nema duplikata). Ako odstupanje pređe prag, etapa se zaustavlja i prikazuje dijagnostiku.

## Kontrola podataka (nova kartica u Finansijskom centru)
- Broj dokumenata: baza vs Minimax, po vrsti i godini.
- Zbirovi izlaznih/ulaznih, avansi, odobrenja, valute, status plaćanja.
- Otvorena potraživanja i obaveze; stanja po kontima.
- Neusaglašeno označeno crveno, nikad kao potvrđeno.
- Lista spornih dokumenata (šest iz uzorka + novi): dobavljač, broj, datum, iznos, vrsta problema, povezana knjiženja, predlog provere. Posebno USD faktura ~2,34 mil. RSD i dokument iz 2026. sa iznosom 0 / osnovica 153.243 RSD (bez pretpostavke zatvaranja avansom).

## Dobit
Prihodi, rashodi, zarade i doprinosi, materijal, proizvodne usluge, ostali troškovi računaju se iz klasa konta glavne knjige (ne izlazne minus ulazne). Označavaju se nepotpuni meseci, neproknjiženi dokumenti i nedostajuća amortizacija.

## Boris (posle sinhronizacije)
Novi read-only alati u postojećem Borisu, koji koriste iste serverske obračune kao Finansijski centar. Procene jasno označene.

## Završni izveštaj
Broj partnera, dokumenata, knjiženja po godinama, sporni dokumenti, slaganje zbirova, šta nedostaje, broj prošlih testova.

## Tehnički detalji
- Tabele: `mm_partners`, `mm_documents` (+ `mm_document_rows`, `mm_vat_rows`), `mm_journals`, `mm_ledger_rows`, `mm_bank_rows`, `mm_sync_runs`/`mm_sync_cursor`, `mm_review_items`; jedinstveni ključ (org_id, minimax_id), CHECK org_id = 79412.
- Edge funkcija `minimax-sync` (service role za upis u lokalne tabele, poziv dozvoljen samo uz finance grant), etapa + godina + strana kao parametri; poštuje ograničenja brzine API-ja.
- Klasifikacija i pravila samo iz `src/lib/minimaxFinance.ts` (kopija u `_shared` sa istim testovima); novi testovi za kontrolne zbirove, nepriznati PDV, avanse i dobit po kontima.
- RPC za kontrolu i dobit (security definer, provera `has_finance_access()`), koje koriste i UI i Boris.
