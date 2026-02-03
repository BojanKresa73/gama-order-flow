import { format } from "date-fns";
import { 
  getMinimaxArtikalSifra, 
  getMinimaxStrankaSifra, 
  getMinimaxArtikalNaziv 
} from "./minimaxMapping";

/**
 * Minimax XML Export za CTP radne naloge
 * 
 * Generiše XML u formatu Minimax porudžbine (Naročilo) za uvoz u računovodstveni sistem.
 * Koristi postojeće šifre stranaka i artikala iz Minimax-a (mapirane po PIB-u i formatu ploče).
 * 
 * Format: Svaki fajl je posebna stavka sa "Posao:" opisom (kao kod D-BOX kolege)
 */

// Minimax XML namespace
export const MINIMAX_NAMESPACE = "https://moj.minimax.rs/RS/CommonWeb/documents/schemas/miniMAXUvozKnjigovodstvo";

// Tipovi za CTP stavke radnog naloga (file_entries)
export interface FileEntry {
  id: string;
  filename: string;
  quantity: number;
  plate_format_id?: string | null;
  format_name?: string; // joined from plate_formats
  status?: string;
  notes?: string | null;
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

// Cene po formatu za klijenta (u EUR)
export interface ClientPlatePrice {
  plate_format_id: string;
  format_name: string;
  price_eur: number;
}

// Podaci o radnom nalogu
export interface WorkOrderData {
  id: string;
  display_order_number?: string;
  order_number?: string;
  order_type: string;
  created_at: string;
  closed_at?: string | null;
  notes?: string | null;
  clients: ClientData;
  file_entries: FileEntry[];
  client_plate_prices?: ClientPlatePrice[];
  nbs_rate?: number; // EUR to RSD exchange rate from NBS
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

// Formatiranje cene za XML (4 decimale, zaokruženo)
function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined || price <= 0) return "0.0000";
  // Ensure exactly 4 decimal places
  return Number(price).toFixed(4);
}

// Dobavi cenu za format iz cenovnika klijenta (EUR) i konvertuj u RSD
function getPriceForFormat(
  formatName: string | undefined, 
  clientPrices: ClientPlatePrice[] | undefined,
  nbsRate: number
): number {
  if (!formatName || !clientPrices || clientPrices.length === 0) return 0;
  
  const priceEntry = clientPrices.find(p => p.format_name === formatName);
  const priceEur = priceEntry?.price_eur || 0;
  
  // Konvertuj EUR u RSD po kursu NBS
  return priceEur * nbsRate;
}

// Generate Minimax XML for CTP work order
// Format: Svaki fajl je posebna stavka sa "Posao:" opisom
// Cene se konvertuju iz EUR u RSD po kursu NBS
export function generateMinimaxOrderXml(workOrder: WorkOrderData): string {
  const nbsRate = workOrder.nbs_rate || 117.0; // Fallback rate if not provided
  const orderNumber = workOrder.display_order_number || workOrder.order_number || workOrder.id;
  const orderDate = format(new Date(workOrder.created_at), "yyyy-MM-dd");
  const client = workOrder.clients;

  // Dobij Minimax šifru stranke iz PIB-a
  const minimaxStrankaSifra = getMinimaxStrankaSifra(client.pib);
  
  // Ako ne postoji mapiranje, koristi PIB kao šifru (za nove stranke)
  const clientSifra = minimaxStrankaSifra || 
    (client.pib ? truncate(client.pib.replace(/\D/g, ""), 30) : 
     truncate(client.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase(), 30));

  // Build NarociloVrstice - svaki fajl je posebna stavka
  const vrsticeXml = workOrder.file_entries
    .filter(entry => entry.format_name) // samo stavke sa formatom
    .map(entry => {
      const formatName = entry.format_name!;
      const minimaxSifra = getMinimaxArtikalSifra(formatName);
      const minimaxNaziv = getMinimaxArtikalNaziv(formatName);
      
      if (!minimaxSifra || !minimaxNaziv) {
        console.warn(`Minimax mapping not found for format: ${formatName}`);
        return "";
      }
      
      // Cena iz cenovnika klijenta (EUR -> RSD po kursu NBS)
      const priceRsd = getPriceForFormat(formatName, workOrder.client_plate_prices, nbsRate);
      
      // Opis: "Usluga: [naziv klijenta kraci] [format] [broj naloga] [naziv fajla]"
      // Primer: "Usluga: dbox 1060x795 RN-0056-2025 FLAMMAT Kutije za hepo 21mm..."
      const clientShort = truncate(client.name.split(" ")[0].toLowerCase(), 10);
      const posaoOpis = `Usluga: ${clientShort} ${formatName} ${orderNumber} ${truncate(entry.filename, 60)}`;
      
      // Koristi pun Minimax naziv artikla (CTcP QUANTUM PREMIUM PLATE...)
      // Minimax će prikazati i šifru i ovaj naziv
      const artikalDisplay = minimaxNaziv;
      
      return `
      <NarociloVrstica>
        <SifraArtikla>${escapeXml(minimaxSifra)}</SifraArtikla>
        <NazivArtikla>${escapeXml(artikalDisplay)}</NazivArtikla>
        <MerskaEnota>Kom</MerskaEnota>
        <Opis>${escapeXml(posaoOpis)}</Opis>
        <Kolicina>${(entry.quantity || 1).toFixed(6)}</Kolicina>
        <OdstotekPopusta>0.00</OdstotekPopusta>
        <Cena>${formatPrice(priceRsd)}</Cena>
      </NarociloVrstica>`;
    })
    .filter(xml => xml.length > 0)
    .join("");

  // NE uključujemo Stranke sekciju - pretpostavljamo da stranka već postoji u Minimax-u
  // NE uključujemo Artikli sekciju - koristimo postojeće šifre artikala iz Minimax-a
  
  // Ako imamo PIB mapiranje, Minimax već ima klijenta - ne šaljemo naziv/adresu
  // Minimax će koristiti svoje podatke za tog klijenta
  const hasMinimaxClient = minimaxStrankaSifra !== null;
  
  // Full XML structure - samo Narocila sekcija
  // PrejetoIzdano: P = Primljeno (od klijenta)
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
export function downloadMinimaxXml(workOrder: WorkOrderData): void {
  const xml = generateMinimaxOrderXml(workOrder);
  const orderNumber = workOrder.display_order_number || workOrder.order_number || workOrder.id;
  const fileName = `Minimax_${orderNumber.replace(/[^A-Za-z0-9_-]/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.xml`;
  
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
