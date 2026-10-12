# Roadmap

- [x] Naći uzrok usporenja (zaostali newsletter cron zadatak, svaki minut od 24.08.)
- [x] Ugasiti zaostali cron zadatak `newsletter_9113711d`
- [x] Isključiti HIBP proveru lozinke (tajmauti od 10s pri prijavi -> 504)
- [x] Očistiti `cron.job_run_details` (210 MB)
- [ ] `net._http_response` (272 MB bloat) — blokiran lock-om pg_net workera, ne utiče na performanse
- [ ] Sistem zaštite: dnevno automatsko čišćenje logova + auto-gašenje newsletter cron zadataka kada je kampanja završena
- [x] Promeniti ime AI agenta u Natalija (stranica, putanja /natalija, dugme, serverska funkcija `natalija`)
- [x] Dijagnostika kupaca, dobavljača, 120 dokumenata, dobiti 2026, banaka (izveštaj 12.10.2026)
- [x] Ispravljen zbir konta 204/435 i povezivanje ulaznih dokumenata (120 → 66 spornih)
- [ ] Knjigovođa: stari dugovi kupaca 4,80 mil., 7 dobavljača 0,39 mil., 57 dokumenata, prelazni računi, amortizacija 2026
- [ ] Usaglašavanje banaka — čeka izvode na isti datum
- [x] Ispravka obračuna: kartice Usaglašavanje, Banke, provera dobiti; Natalija koristi iste funkcije; testovi
