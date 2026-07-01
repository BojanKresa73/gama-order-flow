import { format } from "date-fns";
import { getMinimaxStrankaSifra, getClientShortName } from "./minimaxMapping";

/**
 * Minimax XML Export za FILMOVANJE radne naloge
 * 
 * Generiše XML u formatu Minimax porudžbine (Naročilo) za uvoz u računovodstveni sistem.
 * Cena filma: 22 EUR/m, konvertuje se u RSD po kursu NBS.
 */

const MINIMAX_NAMESPACE = "https://moj.minimax.rs/RS/CommonWeb/documents/schemas/miniMAXUvozKnjigovodstvo";

// Film artikal u Minimaxu
const FILM_ARTIKAL = {
  sifra: "16M03",
  naziv: "Filmovanje: Rolna 500mm",
  jedinica: "m",
};


// Tipovi za film stavke
export interface FilmJobEntry {
  id: string;
  file_name: string;
  width_mm: number;
  height_mm: number;
  qty: number;
  computed_total_m?: number | null;
  note?: string | null;
}

// Podaci o klijentu
export interface ClientData {
  name: string;
  pib?: string | null;
  adresa?: string | null;
  grad?: string | null;
  postanski_broj?: string | null;
  email?: string | null;
  telefon?: string | null;
}

// Podaci o radnom nalogu za film
export interface FilmWorkOrderData {
  id: string;
  display_order_number?: string;
  order_number?: string;
  order_type: string;
  created_at: string;
  closed_at?: string | null;
  notes?: string | null;
  clients: ClientData;
  film_jobs: FilmJobEntry[];
  nbs_rate?: number;
  price_eur_per_m?: number; // cena za datum naloga (iz film_price_versions), fallback 22
}

// Pomoćna funkcija za escape XML specijalnih karaktera
function escapeXml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Skraćivanje stringa na maksimalnu dužinu
function truncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) : text;
}

// Formatiranje cene za XML (4 decimale)
function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined || price <= 0) return "0.0000";
  return Number(price).toFixed(4);
}

// Formatiranje količine za XML (6 decimala)
function formatQuantity(qty: number | null | undefined): string {
  if (qty === null || qty === undefined || qty <= 0) return "0.000000";
  return Number(qty).toFixed(6);
}

// Generate Minimax XML for Film work order
export function generateMinimaxFilmXml(workOrder: FilmWorkOrderData): string {
  const nbsRate = workOrder.nbs_rate || 117.0;
  const orderNumber = workOrder.display_order_number || workOrder.order_number || workOrder.id;
  const orderDate = format(new Date(workOrder.created_at), "yyyy-MM-dd");
  const client = workOrder.clients;

  // Dobij Minimax šifru stranke iz PIB-a
  const minimaxStrankaSifra = getMinimaxStrankaSifra(client.pib);
  
  const clientSifra = minimaxStrankaSifra || 
    (client.pib ? truncate(client.pib.replace(/\D/g, ""), 30) : 
     truncate(client.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase(), 30));

  // Cena filma u RSD (22 EUR × NBS kurs)
  const priceRsd = FILM_ARTIKAL.cenaEur * nbsRate;

  // Build NarociloVrstice - svaki film job je posebna stavka
  const vrsticeXml = workOrder.film_jobs
    .filter(job => job.computed_total_m && job.computed_total_m > 0)
    .map(job => {
      const totalMeters = job.computed_total_m || 0;
      
      // Opis: "Usluga: [klijent] [dimenzije] [broj naloga] [naziv fajla]"
      const clientShort = getClientShortName(client.name);
      const dimensions = `${job.width_mm}×${job.height_mm}mm`;
      const posaoOpis = `Usluga: ${clientShort} ${dimensions} ${orderNumber} ${truncate(job.file_name, 50)}`;
      
      return `
      <NarociloVrstica>
        <SifraArtikla>${escapeXml(FILM_ARTIKAL.sifra)}</SifraArtikla>
        <NazivArtikla>${escapeXml(FILM_ARTIKAL.naziv)}</NazivArtikla>
        <MerskaEnota>${escapeXml(FILM_ARTIKAL.jedinica)}</MerskaEnota>
        <Opis>${escapeXml(posaoOpis)}</Opis>
        <Kolicina>${formatQuantity(totalMeters)}</Kolicina>
        <OdstotekPopusta>0.00</OdstotekPopusta>
        <Cena>${formatPrice(priceRsd)}</Cena>
      </NarociloVrstica>`;
    })
    .join("");

  const hasMinimaxClient = minimaxStrankaSifra !== null;
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<miniMAXUvozKnjigovodstvo xmlns="${MINIMAX_NAMESPACE}">
  <Narocila>
    <Narocilo>
      <NarociloGlava>
        <PrejetoIzdano>P</PrejetoIzdano>
        <Datum>${orderDate}</Datum>
        <SifraStranke>${escapeXml(clientSifra)}</SifraStranke>${hasMinimaxClient ? "" : `
        <NazivStranke>${escapeXml(truncate(client.name, 100))}</NazivStranke>${client.adresa ? `
        <NaslovStranke>${escapeXml(truncate(client.adresa, 50))}</NaslovStranke>` : ""}${client.postanski_broj ? `
        <PostnaStevilka>${escapeXml(truncate(client.postanski_broj, 30))}</PostnaStevilka>` : ""}${client.grad ? `
        <NazivPoste>${escapeXml(truncate(client.grad, 250))}</NazivPoste>` : ""}`}
        <Veza>${escapeXml(truncate(orderNumber, 30))}</Veza>
        <SifraDenarneEnote>RSD</SifraDenarneEnote>
        ${workOrder.notes ? `<Opomba>${escapeXml(truncate(workOrder.notes, 1000))}</Opomba>` : ""}
      </NarociloGlava>
      <NarociloVrstice>${vrsticeXml}
      </NarociloVrstice>
    </Narocilo>
  </Narocila>
</miniMAXUvozKnjigovodstvo>`;

  return xml;
}

// Download XML as file
export function downloadMinimaxFilmXml(workOrder: FilmWorkOrderData): void {
  const xml = generateMinimaxFilmXml(workOrder);
  const orderNumber = workOrder.display_order_number || workOrder.order_number || workOrder.id;
  const fileName = `Minimax_Film_${orderNumber.replace(/[^A-Za-z0-9_-]/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.xml`;
  
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
