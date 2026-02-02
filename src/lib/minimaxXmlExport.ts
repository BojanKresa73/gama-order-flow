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
 */

// Minimax XML namespace
const MINIMAX_NAMESPACE = "https://moj.minimax.rs/RS/CommonWeb/documents/schemas/miniMAXUvozKnjigovodstvo";

// Tipovi za CTP stavke radnog naloga
interface CtpItem {
  id: string;
  label: string;      // naziv fajla
  qty: number;        // količina
  unit: string;       // jedinica mere
  total?: number;     // ukupno
  details?: string;   // detalji (format, količina)
  note?: string;
  status?: string;
  formatName?: string; // format ploče za mapiranje
}

// Podaci o klijentu
interface ClientData {
  name: string;
  pib?: string | null;
  adresa?: string | null;
  grad?: string | null;
  postanski_broj?: string | null;
  email?: string | null;
  telefon?: string | null;
}

// Podaci o radnom nalogu
interface WorkOrderData {
  id: string;
  display_order_number?: string;
  order_number?: string;
  order_type: string;
  created_at: string;
  closed_at?: string | null;
  notes?: string | null;
  clients: ClientData;
  items: CtpItem[];
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

// Ekstrakcija formata ploče iz details stringa (npr. "1030×790, 4 kom")
function extractFormatFromDetails(details: string | undefined): string | null {
  if (!details) return null;
  
  // Match format poput "1030×790" ili "745x605"
  const match = details.match(/(\d+)[x×](\d+)/i);
  if (match) {
    return `${match[1]}x${match[2]}`;
  }
  return null;
}

/**
 * Grupiše stavke po formatu ploče i sumira količine
 */
function groupItemsByFormat(items: CtpItem[]): Map<string, { qty: number; formatName: string; minimaxSifra: string; minimaxNaziv: string }> {
  const grouped = new Map<string, { qty: number; formatName: string; minimaxSifra: string; minimaxNaziv: string }>();
  
  for (const item of items) {
    const formatName = item.formatName || extractFormatFromDetails(item.details);
    if (!formatName) continue;
    
    const minimaxSifra = getMinimaxArtikalSifra(formatName);
    const minimaxNaziv = getMinimaxArtikalNaziv(formatName);
    
    if (!minimaxSifra || !minimaxNaziv) {
      console.warn(`Minimax mapping not found for format: ${formatName}`);
      continue;
    }
    
    const existing = grouped.get(minimaxSifra);
    if (existing) {
      existing.qty += item.qty || 0;
    } else {
      grouped.set(minimaxSifra, {
        qty: item.qty || 0,
        formatName,
        minimaxSifra,
        minimaxNaziv,
      });
    }
  }
  
  return grouped;
}

// Generate Minimax XML for CTP work order
export function generateMinimaxOrderXml(workOrder: WorkOrderData): string {
  const orderNumber = workOrder.display_order_number || workOrder.order_number || workOrder.id;
  const orderDate = format(new Date(workOrder.created_at), "yyyy-MM-dd");
  const client = workOrder.clients;

  // Dobij Minimax šifru stranke iz PIB-a
  const minimaxStrankaSifra = getMinimaxStrankaSifra(client.pib);
  
  // Ako ne postoji mapiranje, koristi PIB kao šifru (za nove stranke)
  const clientSifra = minimaxStrankaSifra || 
    (client.pib ? truncate(client.pib.replace(/\D/g, ""), 30) : 
     truncate(client.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase(), 30));

  // Grupiši stavke po formatu ploče
  const groupedItems = groupItemsByFormat(workOrder.items);

  // Build NarociloVrstice - samo stavke koje imaju Minimax mapiranje
  const vrsticeXml = Array.from(groupedItems.values()).map(item => `
      <NarociloVrstica>
        <SifraArtikla>${escapeXml(item.minimaxSifra)}</SifraArtikla>
        <NazivArtikla>${escapeXml(item.minimaxNaziv)}</NazivArtikla>
        <MerskaEnota>Kom</MerskaEnota>
        <Kolicina>${item.qty.toFixed(6)}</Kolicina>
      </NarociloVrstica>`).join("");

  // NE uključujemo Stranke sekciju - pretpostavljamo da stranka već postoji u Minimax-u
  // NE uključujemo Artikli sekciju - koristimo postojeće šifre artikala iz Minimax-a
  
  // Full XML structure - samo Narocila sekcija
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<miniMAXUvozKnjigovodstvo xmlns="${MINIMAX_NAMESPACE}">
  <Narocila>
    <Narocilo>
      <NarociloGlava>
        <PrejetoIzdano>I</PrejetoIzdano>
        <Datum>${orderDate}</Datum>
        <SifraStranke>${escapeXml(clientSifra)}</SifraStranke>
        <NazivStranke>${escapeXml(truncate(client.name, 100))}</NazivStranke>
        ${client.adresa ? `<NaslovStranke>${escapeXml(truncate(client.adresa, 50))}</NaslovStranke>` : ""}
        ${client.postanski_broj ? `<PostnaStevilka>${escapeXml(truncate(client.postanski_broj, 30))}</PostnaStevilka>` : ""}
        ${client.grad ? `<NazivPoste>${escapeXml(truncate(client.grad, 250))}</NazivPoste>` : ""}
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
