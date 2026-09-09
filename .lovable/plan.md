# Mesečni CTP izveštaj klijentima

Svakog 1. u mesecu svaki klijent koji koristi CTP dobija automatski mejl sa svojom potrošnjom ploča po mesecima, od januara tekuće godine do prethodnog meseca.

## Šta klijent dobija u mejlu

- Stubasti grafikon: broj ploča po mesecima (januar → prethodni mesec).
- Tabela po mesecima, a ako klijent koristi više formata ploča — razdvojeno po formatima.
- Poređenje sa prethodnim mesecom u procentima (rast ili pad, sa jasnom oznakom + / −).
- Prosečna mesečna potrošnja i ukupno od početka godine.
- Poređenje sa istim mesecom prošle godine: priprema se sada, ali se u mejlu prikazuje tek od januara 2027, jer podaci postoje tek od decembra 2025. Do tada se taj red jednostavno ne prikazuje.
- Link za odjavu (obavezno za ovakvu vrstu mejla).

## Kome se šalje

Svim kontaktima klijenta: glavni mejl klijenta, dodatni mejlovi za obaveštenja (do 3) i aktivni kontakti/komercijalisti iz liste kontakata. Duplikati se izbacuju, klijent bez ijedne CTP ploče u tekućoj godini se preskače.

## Kako radi

- Slanje je automatsko, 1. u mesecu ujutru (predlog: 07:00 po Beogradu).
- Šalje se jednom mesečno; ako je već poslato za taj mesec, ponovno pokretanje ne šalje duplikat.
- U aplikaciji (CTP Statistika) dobijate dugme „Pregled mesečnog izveštaja“ gde možete da vidite kako mejl izgleda za bilo kog klijenta i da po potrebi ručno pošaljete/ponovite slanje.
- Evidencija slanja se čuva, pa se vidi kome je i kada poslato i da li je nešto palo.

## Moji dodatni predlozi (uključeni u plan)

- Grafikon kao slika u mejlu (bez skripti), da se ispravno prikaže u Outlooku i Gmailu.
- Kratka rečenica-zaključak na vrhu, npr. „U avgustu ste potrošili 320 ploča, 12% manje nego u julu.“
- Automatsko preskakanje klijenata sa vrlo malom potrošnjom (npr. ispod 5 ploča godišnje), da ne dobijaju prazan izveštaj — prag možete promeniti.

## Tehnički deo

- Nova baza: `ctp_monthly_report_log` (client_id, period, status, recipients, error) sa RLS-om i GRANT-ovima; jedinstveni ključ (client_id, period) sprečava duplo slanje.
- Nova RPC funkcija `get_client_ctp_monthly(p_client_id, p_year)` — agregacija po mesecu i formatu direktno u bazi (join `work_orders` + `file_entries` + `plate_formats`, `order_type='ctp'`, isključeni `deleted_at`/`invalidated_at`), po uzoru na postojeće `get_ctp_*` funkcije.
- Nova edge funkcija `send-ctp-monthly-report`: iterira CTP klijente, poziva RPC, generiše HTML (grafikon kao inline SVG/table-bar, u skladu sa postojećim newsletter stilom i logotipom), šalje preko Resend-a uz postojeći `FROM_EMAIL`/`ARCHIVE_EMAIL` obrazac i throttle ~1.1 s po mejlu, upisuje u log i `email_log`.
- Autorizacija: CRON_SECRET za automatsko pokretanje, superuser za ručno slanje/pregled iz UI-ja.
- `pg_cron` posao: `0 5 1 * *` UTC (07:00 Beograd) poziva funkciju preko `pg_net`. Jednom mesečno, bez opterećenja baze.
- UI: nova sekcija u `CtpStats.tsx` (dugme + dijalog sa pregledom i ručnim slanjem), vidljivo superuser/admin_plus.
- Odjava se veže na postojeći `newsletter-unsubscribe` mehanizam.
