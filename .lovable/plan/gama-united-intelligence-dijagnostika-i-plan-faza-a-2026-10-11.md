# Gama United Intelligence — dijagnostika i plan (Faza A)

Ništa nije menjano u bazi ni podacima. Svaka faza počinje tek posle vaše potvrde.

## 1. Šta već postoji (može da se ponovo upotrebi)
- **Proizvodnja:** radni nalozi za CTP, Filmovanje, Digitalu, Ostalo (RAZNO) i Velike formate; stavke, fajlovi, checklist, prioriteti, vremena rada CTP mašina (brzine, ETA).
- **Klijenti:** šifarnik klijenata, kontakti, cenovnik ploča po klijentu, rabati, aktivnosti, portal korisnici, reklamacije.
- **Materijal:** lager ploča po formatima, istorija zaliha, nabavka iz Kine sa prognozom, cene filma po periodima, digitalni šifarnik papira i dorade.
- **Finansije (delimično):** vrednost naloga, oznaka „fakturisano", kursevi NBS, statistike prihoda i marže CTP/filma (samo superuser/admin_plus), ponude.
- **Minimax:** postoji samo **izvoz XML-a** (nalozi kao narudžbine, šifre stranaka). **Nema API veze sa Minimax-om** — fakture, plaćanja i knjiženja trenutno ne ulaze u program.
- **Uloge:** superuser, admin_plus, admin, operator, operator_ctp, client_user.
- **Nedostaje:** UV štampa, dorada i kooperacija kao posebne oblasti (idu kroz „Ostalo"), troškovi mašina/zakupa, bankarski izvodi, ulazne fakture, AI asistent.

## 2. Potrebne izmene baze (Faza B)
- Nove privatne tabele: `finance_access_grants`, `finance_documents` (izlazne/ulazne fakture, knjižna odobrenja, predračuni zasebno), `finance_document_items`, `finance_partners` + veza sa postojećim klijentima, `finance_payments`, `finance_journals` / `finance_journal_entries`, `finance_bank_confirmations`, `finance_planned_payments`, `finance_cash_checks`, `finance_tasks`, `finance_sync_runs`, `ai_conversations` / `ai_messages`.
- Pristup isključivo kroz listu odobrenih korisničkih ID-jeva (Bojan, Natalija), proveravano u bazi i u serverskim funkcijama — ne po ulozi ni po imejlu.
- Postojeće tabele se ne menjaju.

## 3. Plan Minimax integracije (read only)
- Potrebno od vas: API korisnik i lozinka, client ID/secret, organizacija Gama United (naziv, PIB, ID).
- Serverska funkcija koja samo čita: fakture, stavke, partneri, plaćanja/dug, knjižna odobrenja, predračuni, nalozi za knjiženje.
- Prvo probno čitanje nekoliko dokumenata i provera odgovora, pa istorijski uvoz (tek uz vašu dozvolu), pa noćna inkrementalna sinhronizacija posle 23 h.
- Zaštita od duplikata po originalnom Minimax ID-ju; ekran sa poslednjom sinhronizacijom, brojem dokumenata i greškama.
- GDC podaci se nikad ne upisuju kao United.

## 4. Finansijski kontrolni centar (Faza C)
- Pregled za danas, finansijski radar (dospela potraživanja, kupci koji kasne, nefakturisani zatvoreni nalozi), bankarske potvrde, planirana plaćanja, prognoza novca 30/60/90 dana.
- Kontrola fakturisanja: zatvoren nalog bez fakture, faktura bez naloga, razlika u iznosu.
- Svi obračuni na serveru.

## 5. AI arhitektura — Boris (Faza D)
- Serverska funkcija sa AI modelom koji sam bira alate i radi više koraka zaredom.
- Svaki alat je serverski upit nad pravim podacima, sa proverom pristupa; Boris nikad ne piše po bazi.
- Odgovori sa izvorom podataka (nalozi, fakture, periodi) i preporukom.
- Razgovori se čuvaju privatno.

## 6. Analitički alati za United
search_work_orders, get_work_order_details, analyze_production(_comparison), search_customers, analyze_customer, search_materials, analyze_material_costs, compare_suppliers, analyze_invoices, get_open_invoices, get_finance_overview, analyze_cash_flow, analyze_machine_utilization, analyze_work_order_costs, find_anomalies, search_documents. Prvi talas: proizvodnja, klijenti, materijal (već imamo podatke); finansijski alati posle Minimax-a.

## 7. Procena mesečnog troška
- AI: oko 10–40 € mesečno pri 20–50 pitanja dnevno za dve osobe (zavisi od dužine analiza).
- Baza i serverske funkcije: u okviru postojećeg plana; mogući manji rast prostora posle uvoza faktura.

## 8. Rizici
- Minimax API možda ne daje sve (npr. bankarska knjiženja, prilozi) — utvrđuje se probnim čitanjem.
- Opterećenje baze pri istorijskom uvozu — radi se noću, u delovima.
- AI može pogrešno protumačiti pitanje — zato navodi izvore i proračune.
- Pristup finansijama mora ostati vezan za tačno dva naloga.

## 9. Redosled i provere
- **B:** tabele + pristup + Minimax probno čitanje → test da operater ne vidi ništa.
- **C:** kontrolni centar → poređenje zbirova sa Minimax-om.
- **D:** Boris, prvo proizvodnja/klijenti/materijal → probna pitanja sa poznatim odgovorima.
- **E:** napredna proizvodna analitika (norme, troškovi, zakup opreme).
- **F:** pretraga dokumenata, Excel izvoz, upozorenja.
- **G:** kontrolisana veza sa istorijom GDC-a, bez prenosa obaveza.

## Šta mi treba od vas pre Faze B
1. Minimax API pristup za Gama United.
2. Potvrda koji su tačno nalozi Bojana i Natalije u programu.
3. Da li Borisa počinjemo odmah sa proizvodnim podacima (može pre Minimax-a).
