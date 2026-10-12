# Roadmap

- [x] Naći uzrok usporenja (zaostali newsletter cron zadatak, svaki minut od 24.08.)
- [x] Ugasiti zaostali cron zadatak `newsletter_9113711d`
- [x] Isključiti HIBP proveru lozinke (tajmauti od 10s pri prijavi -> 504)
- [x] Očistiti `cron.job_run_details` (210 MB)
- [ ] `net._http_response` (272 MB bloat) — blokiran lock-om pg_net workera, ne utiče na performanse
- [ ] Sistem zaštite: dnevno automatsko čišćenje logova + auto-gašenje newsletter cron zadataka kada je kampanja završena
- [x] Promeniti ime AI agenta u Natalija (stranica, putanja /natalija, dugme, serverska funkcija `natalija`)
- [ ] Usaglašavanje kupaca: razlika ~7,10 mil. RSD (potraživanja po dokumentima 11,71 mil. vs konto 204 18,81 mil.) — razlike po kupcu od najveće ka najmanjoj, svaka klasifikovana kao objašnjeno / verovatan uzrok / potrebna provera knjigovođe
- [ ] Usaglašavanje dobavljača: 2,67 mil. RSD po dokumentima vs konto 435 4,05 mil. RSD — po dobavljaču i dokumentu
- [ ] Provera 120 ulaznih dokumenata „Potrebna provera" — prioritet: USD faktura 2.340.359,25 RSD, dokument sa osnovicom 153.243 RSD a iznosom 0, PDV neslaganja, dokumenti bez knjiženja
- [ ] Provera dobiti pre prikaza (2025: 8,08 mil., 2026: 16,93 mil. RSD) — potpunost knjiženja, isključena zaključna/otvaranja, prelaz godine, amortizacija i razgraničenja, zbir meseci = rezultat godine
- [ ] Kontrola bankarskih računa
