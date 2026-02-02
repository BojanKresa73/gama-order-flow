import { format } from "date-fns";

/**
 * Minimax XML Export za radne naloge
 * 
 * Generiše XML u formatu Minimax porudžbine (Naročilo) za uvoz u računovodstveni sistem.
 * NAPOMENA: XML elementi koriste slovenačke nazive (Narocilo, Stranka, itd.) jer je to
 * obavezan format Minimax XSD šeme - promena naziva bi onemogućila uvoz.
 */

// Minimax XML namespace
const MINIMAX_NAMESPACE = "https://moj.minimax.rs/RS/CommonWeb/documents/schemas/miniMAXUvozKnjigovodstvo";

// Tipovi za stavke radnog naloga
interface WorkOrderItem {
  id: string;
  label: string; // naziv fajla
  qty: number;
  unit: string;
  total?: number;
  details?: string;
  note?: string;
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
  items: WorkOrderItem[];
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

// Dobijanje šifre artikla na osnovu tipa naloga
function getArtikalSifra(orderType: string): string {
  switch (orderType) {
    case "ctp": return "CTP-PLOCE";
    case "digital": return "DIG-STAMPA";
    case "film": return "FILM-STAMPA";
    default: return "USLUGA";
  }
}

// Dobijanje merne jedinice
function getMernaJedinica(orderType: string, unit: string): string {
  switch (orderType) {
    case "ctp": return "kom";
    case "digital": return "tab";
    case "film": return "m";
    default: return unit || "kom";
  }
}

// Generate Minimax XML for work order (as Narocilo - purchase/sales order)
export function generateMinimaxOrderXml(workOrder: WorkOrderData): string {
  const orderNumber = workOrder.display_order_number || workOrder.order_number || workOrder.id;
  const orderDate = format(new Date(workOrder.created_at), "yyyy-MM-dd");
  const client = workOrder.clients;

  // Generate client šifra from PIB or first 30 chars of name
  const clientSifra = client.pib 
    ? truncate(client.pib.replace(/\D/g, ""), 30) 
    : truncate(client.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase(), 30);

  // Build NarociloVrstice (order lines)
  // Build articles and order lines
  const artikliData = workOrder.items.map((item, index) => {
    const artikalSifra = `${getArtikalSifra(workOrder.order_type)}-${(index + 1).toString().padStart(3, "0")}`;
    const fullName = item.details 
      ? `${item.label} (${item.details}${item.note ? " | " + item.note : ""})`
      : item.label;
    return {
      sifra: artikalSifra,
      naziv: truncate(fullName, 250),
      enota: getMernaJedinica(workOrder.order_type, item.unit),
      qty: item.total || item.qty || 1,
    };
  });

  // Build Artikli section (per XSD: SifraArtikla, Naziv, MerskaEnota, Tip, Uporaba)
  const artikliXml = artikliData.map(art => `
    <Artikel>
      <SifraArtikla>${escapeXml(art.sifra)}</SifraArtikla>
      <Naziv>${escapeXml(art.naziv)}</Naziv>
      <MerskaEnota>${escapeXml(art.enota)}</MerskaEnota>
      <Tip>BL</Tip>
      <Uporaba>D</Uporaba>
    </Artikel>`).join("");

  // Build NarociloVrstice
  const vrsticeXml = artikliData.map(art => `
      <NarociloVrstica>
        <SifraArtikla>${escapeXml(art.sifra)}</SifraArtikla>
        <NazivArtikla>${escapeXml(art.naziv)}</NazivArtikla>
        <MerskaEnota>${escapeXml(art.enota)}</MerskaEnota>
        <Kolicina>${art.qty.toFixed(6)}</Kolicina>
      </NarociloVrstica>`).join("");

  // Full XML structure with Artikli section
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<miniMAXUvozKnjigovodstvo xmlns="${MINIMAX_NAMESPACE}">
  <Stranke>
    <Stranka>
      <Sifra>${escapeXml(clientSifra)}</Sifra>
      <Naziv>${escapeXml(truncate(client.name, 250))}</Naziv>
      ${client.adresa ? `<Naslov>${escapeXml(truncate(client.adresa, 250))}</Naslov>` : ""}
      <KraticaDrzave>RS</KraticaDrzave>
      <NazivDrzave>Srbija</NazivDrzave>
      ${client.postanski_broj ? `<PostnaStevilka>${escapeXml(truncate(client.postanski_broj, 30))}</PostnaStevilka>` : ""}
      ${client.grad ? `<NazivPoste>${escapeXml(truncate(client.grad, 250))}</NazivPoste>` : ""}
      <DavcniZavezanec>D</DavcniZavezanec>
      ${client.pib ? `<DavcnaStevilka>${escapeXml(truncate(client.pib, 30))}</DavcnaStevilka>` : ""}
      ${client.telefon ? `<Telefon>${escapeXml(truncate(client.telefon, 30))}</Telefon>` : ""}
      ${client.email ? `<EPosta>${escapeXml(truncate(client.email, 50))}</EPosta>` : ""}
      <Uporaba>D</Uporaba>
    </Stranka>
  </Stranke>
  <Artikli>${artikliXml}
  </Artikli>
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
