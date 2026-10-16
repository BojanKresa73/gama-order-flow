# Slanje opomena – Finansije

## Šta pravimo
Nova kartica **„Slanje opomena"** na stranici Finansije (vide je samo Bojan i Natalija).

1. **Spisak dužnika** – svi kupci sa otvorenim izlaznim fakturama iz Minimaxa (org 79412):
   - ukupan dug, **dug van valute** (rok plaćanja prošao), broj faktura, najstarija dospela faktura i broj dana kašnjenja
   - kontakt osoba i email iz naše baze klijenata (povezivanje po nazivu/PIB-u); ako email ne postoji – oznaka „Nema email-a"
   - podrazumevano sortirano po dugu van valute; filter „samo van valute", pretraga, štikliranje klijenata
2. **Detalj klijenta** – lista otvorenih faktura (broj, datum, rok, iznos, otvoreno, dana kašnjenja) i **grafikon po mesecima (poslednjih 12)**: koliko je fakturisano i koliko je uplaćeno u tom mesecu.
3. **Opomena (email)** – lepo oblikovan email u stilu Gama United newslettera (logo, boje):
   - „Poštovani {ime kontakt osobe}," 
   - ljubazan tekst: vaša dugovanja prema Gama United-u van valute iznose **X RSD**; molimo da izvršite uplatu kako bismo nastavili da radimo na visokom nivou na koji ste navikli; zahvalnost za saradnju; ako je uplata već izvršena, zanemarite poruku
   - tabela dospelih faktura, mali grafikon fakturisano/uplaćeno po mesecima, podaci za uplatu (tekući račun, poziv na broj = broj fakture), kontakt
   - pregled pre slanja, dugme „Pošalji izabranima" uz potvrdu; svako slanje se beleži (kome, kada, koliki iznos)
4. **Probno slanje** – dugme „Pošalji meni probu"; prvu probu šaljem na Bojanov email sa podacima za **SIMprint d.o.o.** (kontakt: Miloš): trenutno 39 otvorenih faktura, 1.490.538,49 RSD otvoreno, od toga **1.249.802,63 RSD van valute**. Pravim klijentima se ništa ne šalje bez vašeg klika.

## Važne napomene
- Iznosi su iz otvorenih faktura. **Stari dug iz početnog stanja 2025. (kod SIMprinta ~1,03 mil.) ne ulazi u opomenu** dok ga knjigovođa ne potvrdi – da ne opominjemo za nepotvrđen iznos.
- U Minimaxu se ništa ne menja.
- Broj tekućeg računa za uplatu uzimam iz podataka firme u aplikaciji; proverite ga na probnom mailu.

## Tehnički detalji
- RPC `mm_receivables_aging()` (SECURITY DEFINER, `has_finance_access()`): po partneru open/overdue/dani, fakture, mesečno fakturisano (issued fakture po `doc_date`) i uplate (potražna strana konta 204 iz `mm_ledger_clean()` po mesecu).
- Povezivanje partner ↔ `clients` po PIB-u iz `mm_partners.raw`, rezervno po normalizovanom nazivu.
- Tabela `mm_dunning_log` (partner, email, iznos van valute, poslao, vreme, test flag), RLS preko `has_finance_access()`.
- Edge funkcija `send-dunning` (JWT + `has_finance_access()`), postojeća email infrastruktura (Resend/SMTP); grafikon u emailu kao HTML tabela sa trakama (radi u svim email klijentima).
- Komponenta `src/components/finance/DunningTab.tsx` (recharts grafikon); test za pravilo „van valute = rok < danas i otvoreno > 0".
