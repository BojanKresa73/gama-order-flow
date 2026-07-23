## Situacija

Nalog **FILM-2026-000245** je zatvoren i otpremnica poslata **07.07.2026** sa starim dimenzijama. U međuvremenu si ručno korigovao film jobs na:

- `717×518 … UV LAK` → sada **717×505 mm**, ukupno **0.74 m**
- `730×353 … UV LAK` → **730×353 mm**, ukupno **0.75 m**

Zapis u `delivery_notes` je već ažuriran na iste vrednosti (verovatno je resnimljen), ali **PDF poslat klijentu i dalje ima stare brojke** — treba ga regenerisati i ponovo poslati.

## Plan (jedan korak, bez izmena koda)

Postoji već ugrađena "resend" logika u `send-delivery-note` edge funkciji (`resend: true` briše postojeći `delivery_notes` red, pravi novi iz trenutnih `film_jobs`, generiše nov PDF, uploaduje ga u storage i šalje mejl na sve `notification_email*` polja klijenta).

Kad odobriš prelazak u build, uraditi jednu stvar:

1. Pozvati `send-delivery-note` edge funkciju sa telom:
   ```json
   { "workOrderId": "0ba319c3-3574-4b9b-962e-2bb0ad0fac8a", "resend": true }
   ```
   preko `supabase.functions.invoke` iz kratke skripte (koristeći tvoj auth token — funkcija zahteva JWT).

2. Verifikovati: proveriti da je novi `delivery_notes.sent_at` timestamp od danas, i da PDF u storage bucket-u `delivery-notes` sadrži nove metraže (0.74 m / 0.75 m).

## Napomena

Ne diram nikakav kod jer resend mehanizam već postoji i radi tačno ono što treba. Ako želiš, umesto jednokratnog poziva mogu da dodam i UI dugme "Ponovo pošalji otpremnicu" na stranicu detalja naloga (`WorkOrderDetails.tsx`) — reci mi ako to hoćeš, pa ću dopuniti plan.