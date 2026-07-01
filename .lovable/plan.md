## Cilj

Nova sekcija **Godišnji odmori** (ruta `/vacations`) dostupna svim internim korisnicima. Zaposleni podnose zahteve, Superuser/Admin Plus odobravaju/odbijaju. Sistem prati kvote (21 dan/godišnje), prenos iz prethodne godine (rok 30.06.), državne praznike RS i pravila najave (min. 7 dana ranije).

## UX / Prikazi

Stranica ima 3 taba na vrhu + sticky "Novi zahtev" dugme:

1. **Tim kalendar (default)** — mesečni grid (react-day-picker custom): svaki zaposleni = obojena traka preko dana odsustva; hover = tooltip sa imenom, statusom (Odobreno/Na čekanju), tipom. Filteri: mesec/godina, status. Vikend i praznici blago osenčeni. Legenda boja po osobi.
2. **Vremenska osa (Gantt)** — horizontalna godišnja skala (jan–dec), zaposleni u vrstama, blokovi po zahtevu. Odmah se vidi preklapanje po timovima. Klik na blok = detalj drawer.
3. **Moji zahtevi / Svi zahtevi** — tabela (datumi, dana, status, komentar odobravaoca, akcije: otkaži dok je pending). Za Superuser/Admin Plus još i dugmad "Odobri / Odbij + razlog".

Sticky desno gore: **kartica bilansa** — "Preostalo 2026: 14 dana · Preneseno iz 2025: 3 (istiće 30.06.) · Na čekanju: 5".

Novi zahtev dijalog: date-range picker (shadcn Calendar mode="range", `pointer-events-auto`), auto-računanje kalendarskih dana bez praznika RS, live upozorenja:
- crveno ako **start < today + 7 dana** (blokirano, osim ako Superuser override checkbox);
- crveno ako **traženo > preostalo**;
- žuto info: "Koristi X dana iz 2025 (prenos), Y iz 2026".

Vizuelno: pastelne trake po osobi (deterministički hash → HSL iz semantic tokena), rounded-md, status ikonice (Check/Clock/X iz lucide), meke senke — dosledno postojećem shadcn stilu app-a.

## Data model (nova migracija)

```
public.vacation_settings (singleton)
  annual_days int default 21
  min_notice_days int default 7
  carryover_deadline_month int default 6  -- 30.06.
  carryover_deadline_day int default 30

public.vacation_holidays  -- praznici RS
  id, holiday_date date unique, name text, is_active bool

public.vacation_requests
  id, user_id (profiles.id), start_date, end_date,
  days_count int,           -- pre-computed kalendarski minus praznici (u opsegu)
  used_from_previous int default 0,
  used_from_current int default 0,
  status enum('pending','approved','rejected','cancelled') default 'pending',
  reason text,              -- napomena zaposlenog
  reviewer_id, reviewed_at, reviewer_note,
  created_at, updated_at

public.vacation_balances   -- godišnji obračun po korisniku
  user_id, year int, allocated int, used int, carried_over int,
  carryover_expires_on date, PK(user_id, year)
```

GRANT-i: SELECT za `authenticated` (svi vide timski kalendar), INSERT/UPDATE svog zahteva za `authenticated`, `service_role` ALL. Za approve/reject → RPC `vacation_review(request_id, decision, note)` sa `has_admin_plus_access` check.

RLS: 
- `vacation_requests` SELECT za internal users (ne client_user), INSERT svoj, UPDATE svoj samo dok je pending (za cancel), review preko SECURITY DEFINER RPC.
- `vacation_balances` SELECT: svoj + admin_plus vidi sve.
- `vacation_holidays` SELECT za authenticated, upravlja Superuser.

Seed: državni praznici RS 2026/2027 (Nova godina 1-2.1, Božić 7.1, Sretenje 15-16.2, Uskrs pomični, Praznik rada 1-2.5, Dan primirja 11.11).

## Business logika (RPC-ovi)

`vacation_calculate_days(p_start, p_end)` → int (kalendarski dani u opsegu minus datumi iz `vacation_holidays`).

`vacation_submit(p_start, p_end, p_reason)`:
- validira start ≥ today + 7 (min_notice_days iz settings);
- računa days;
- proverava bilans (prvo troši `carried_over` ako još važi, pa `allocated`);
- INSERT pending zahtev.

`vacation_review(p_id, p_decision, p_note)` — samo admin_plus+; ako approved: umanjuje balans u `vacation_balances` (upsert za godinu starta); insert log; okida notifikaciju.

`vacation_expire_carryover()` — cron 1.7. svake godine (pg_cron + pg_net): za sve `vacation_balances` gde `carryover_expires_on < today` i `carried_over > 0`, postavi `carried_over = 0` i enqueue email upozorenja preko `email_outbox` ("Izgubili ste N dana prenosa").

`vacation_year_rollover()` — cron 1.1: kreira novi red bilansa (allocated=21, carried_over = prošlogodišnji unused, carryover_expires_on = 30.06. tekuće).

## Notifikacije

- Novi zahtev → email Superuser + Admin Plus (edge function `notify-vacation-request`, koristi postojeći `email_outbox`/Resend).
- Odluka → email podnosiocu.
- 15 dana pre 30.06. → podsetnik zaposlenima sa neiskorišćenim prenosom.
- U app-u: `PortalNotificationBell` slična komponenta u AppHeader-u — badge sa brojem pending zahteva (za admine) i statusa (za sve).

## Rute i navigacija

- `/vacations` — glavna stranica (lazy route u `App.tsx`).
- Link u `AppHeader` i `MobileNav` "Godišnji odmori" (ikona Palmtree iz lucide).
- Dashboard widget: mala kartica "Ko je na odmoru danas + sledećih 7 dana".

## Fajlovi za izmenu/kreiranje

Novi:
- `src/pages/Vacations.tsx` (tabovi + header bilansa)
- `src/components/vacations/TeamCalendar.tsx`
- `src/components/vacations/VacationGantt.tsx`
- `src/components/vacations/RequestsTable.tsx`
- `src/components/vacations/NewRequestDialog.tsx`
- `src/components/vacations/ReviewDialog.tsx`
- `src/components/vacations/BalanceCard.tsx`
- `src/hooks/useVacations.ts`, `useVacationBalance.ts`, `useVacationHolidays.ts`
- `src/lib/vacationCalc.ts` (računanje dana klijentski, ogledalo RPC-a)
- `supabase/functions/notify-vacation-request/index.ts`
- `supabase/functions/vacation-cron/index.ts` (poziva expire + rollover; zaštita CRON_SECRET)
- Migracije: tabele, RPC-ovi, RLS, seed praznika

Izmene:
- `src/App.tsx` — lazy route
- `src/components/layout/AppHeader.tsx`, `MobileNav.tsx` — link
- `src/components/dashboard/*` — mini widget "Ko je na odmoru"

## Redosled implementacije

1. Migracija (tabele, RPC-ovi, RLS, seed praznika 2026/27, pg_cron 1.1. i 1.7.).
2. Hooks + `vacationCalc.ts`.
3. `NewRequestDialog` + `BalanceCard` + `RequestsTable` (moji).
4. `TeamCalendar` (mesečni prikaz sa trakama).
5. `VacationGantt` godišnji.
6. Approve/Reject workflow + edge function za email.
7. AppHeader badge + Dashboard mini widget.
8. Testiranje ivičnih slučajeva (praznici u opsegu, prenos, 7 dana notice, override).

Kad odobriš, krećem redom od migracije.