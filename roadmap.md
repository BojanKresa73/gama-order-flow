# Roadmap

- [x] Naći uzrok usporenja (zaostali newsletter cron zadatak, svaki minut od 24.08.)
- [x] Ugasiti zaostali cron zadatak `newsletter_9113711d`
- [x] Isključiti HIBP proveru lozinke (tajmauti od 10s pri prijavi -> 504)
- [x] Očistiti `cron.job_run_details` (210 MB)
- [ ] `net._http_response` (272 MB bloat) — blokiran lock-om pg_net workera, ne utiče na performanse
- [ ] Sistem zaštite: dnevno automatsko čišćenje logova + auto-gašenje newsletter cron zadataka kada je kampanja završena
