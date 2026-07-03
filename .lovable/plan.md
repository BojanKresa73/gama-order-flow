## Cilj

Dodati **Brzi kalkulator** (isti kao u GDC Order) na naš sajt. Vidljiv samo za `admin`, `admin_plus`, `superuser`. Cene materijala se čitaju **uživo iz GDC Order baze**.

## Kako će raditi

- Novi drugi Supabase klijent (`supabaseGDC`) — čita samo tabele cenovnika iz GDC Order projekta (anon key, read-only za frontend, RLS mora dozvoliti čitanje).
- Kompletna komponenta `QuickPriceCalculator` sa: unos dimenzija, količina, materijal, štampa 4/0÷4/4, marža, dorada, kasiranje, custom cena, tabovi Kalkulator / Lista stavki / Istorija, sačuvane liste u localStorage, izračun profita, kopiranje rezultata, dugme „Napravi ponudu".
- **Istorija** (`quick_calc_history`) se čuva u našoj bazi (per-user, RLS).
- **„Napravi ponudu"** — ovaj projekat trenutno nema modul Ponuda. Predložena varijanta: dugme otvara nov nalog `/work-orders/new` sa predpopunjenim stavkama iz sessionStorage, ili — ako želiš — samo se skloni. **Ovo mi treba potvrda pre finalne implementacije.**
- Pristup: dugme se pojavljuje u sidebar-u / na dashboardu samo ako je uloga admin+.

## Šta mi treba od tebe

1. **Supabase URL i anon key GDC Order projekta** (postavi kao secret: `GDC_SUPABASE_URL` i `GDC_SUPABASE_ANON_KEY`, ili ih prosledi meni). Bez ovoga kalkulator ne može da čita cene.
2. Potvrda da RLS na GDC Order tabelama (`large_format_materials`, `large_format_prices`, `kasiranje_settings`, `digital_paper_types`, itd.) **dozvoljava anonimno čitanje** — inače moraš omogućiti `SELECT` za `anon` na tim tabelama u GDC Order projektu (to se radi tamo, ne ovde).
3. Odluka o dugmetu „Napravi ponudu" (vidi gore).

## Tehnički koraci (redom)

```text
1. Migracija: tabela quick_calc_history (per-user, RLS auth-only) + GRANT
2. src/integrations/supabase/gdc-client.ts  — drugi Supabase klijent (VITE_GDC_SUPABASE_URL, VITE_GDC_SUPABASE_ANON_KEY)
3. Kopiraj iz GDC Order:
   - src/lib/quotePricing.ts, kasiranjeCost.ts, auth/quickCalcAccess.ts
   - src/hooks/useLargeFormatPricing.ts, useKasiranjeSettings.ts  (izmeni da koriste supabaseGDC)
   - src/components/quotes/MaterialCombobox.tsx
   - src/components/calculator/QuickPriceCalculator.tsx  (izmeni: history koristi naš supabase, /quotes/new prilagoditi)
4. Ugradi u DashboardQuickActions.tsx (dugme za admin+)
5. Ugradi trigger u AppHeader-u (globalno dostupno)
6. Test: forma se otvara, materijali se učitavaju iz GDC baze, cena se računa, kopiranje radi, istorija pamti
```

## Datoteke koje se prave / menjaju

- `supabase/migrations/…_quick_calc_history.sql` (nova)
- `src/integrations/supabase/gdc-client.ts` (nova)
- `src/lib/quotePricing.ts`, `src/lib/kasiranjeCost.ts`, `src/lib/auth/quickCalcAccess.ts` (kopije)
- `src/hooks/useLargeFormatPricing.ts`, `src/hooks/useKasiranjeSettings.ts` (kopije + prebačeno na `supabaseGDC`)
- `src/components/quotes/MaterialCombobox.tsx` (kopija)
- `src/components/calculator/QuickPriceCalculator.tsx` (kopija + izmene)
- `src/components/dashboard/DashboardQuickActions.tsx` (dugme)
- `src/components/layout/AppHeader.tsx` (globalni trigger — opciono)
- `.env` dobija `VITE_GDC_SUPABASE_URL` i `VITE_GDC_SUPABASE_ANON_KEY` (kroz secrets)

## Napomena o rizicima

- Ako GDC Order jednog dana promeni šemu tabela cenovnika, ovaj kalkulator će pući ovde. Preporučeni pravac dugoročno: nightly cron koji sinhronizuje cene u našu bazu. Ali za sada — direktno čitanje kako si tražio.
