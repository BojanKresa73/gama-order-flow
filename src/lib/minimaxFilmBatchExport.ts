import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getMinimaxStrankaSifra, getClientShortName } from "./minimaxMapping";

/**
 * Batch Minimax XML Export za FILMOVANJE radne naloge
 * 
 * Generiše XML u formatu Minimax porudžbine za više Film naloga odjednom.
 * Cena filma: 22 EUR/m, konvertuje se u RSD po kursu NBS.
 */

const MINIMAX_NAMESPACE = "https://moj.minimax.rs/RS/CommonWeb/documents/schemas/miniMAXUvozKnjigovodstvo";

// Film artikal u Minimaxu
const FILM_ARTIKAL = {
  sifra: "16M03",
  naziv: "Filmovanje: Rolna 500mm",
  jedinica: "m",
};

// Cena po m se dobija iz film_price_versions po datumu naloga
function pickPriceForDate(versions: Array<{ price_eur_per_m: number; valid_from: string }>, orderDateIso: string): number {
  const d = orderDateIso.slice(0, 10);
  const applicable = versions
    .filter(v => v.valid_from <= d)
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from));
  return applicable[0]?.price_eur_per_m ?? 22;
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
function formatPrice(price: number): string {
  return Number(price).toFixed(4);
}

// Formatiranje količine za XML (6 decimala)
function formatQuantity(qty: number): string {
  return Number(qty).toFixed(6);
}

interface FilmBatchExportResult {
  success: boolean;
  exportedCount: number;
  skippedCount: number;
  errors: string[];
}

export async function exportFilmBatchToMinimax(orderIds: string[]): Promise<FilmBatchExportResult> {
  const errors: string[] = [];
  
  if (orderIds.length === 0) {
    return { success: false, exportedCount: 0, skippedCount: 0, errors: ["Nema naloga za izvoz."] };
  }

  // Fetch latest NBS exchange rate
  const { data: nbsRate } = await supabase
    .from("nbs_exchange_rates")
    .select("middle_rate")
    .eq("currency_code", "EUR")
    .order("list_date", { ascending: false })
    .limit(1)
    .single();

  const eurToRsd = nbsRate?.middle_rate || 117.0;

  // Fetch film price versions (za odabir cene po datumu naloga)
  const { data: priceVersions } = await supabase
    .from("film_price_versions")
    .select("price_eur_per_m, valid_from");
  const versions = (priceVersions || []).map(v => ({
    price_eur_per_m: Number(v.price_eur_per_m),
    valid_from: String(v.valid_from),
  }));

  // Fetch all work orders with film jobs and client data
  const { data: workOrders, error: woError } = await supabase
    .from("work_orders")
    .select(`
      id,
      order_number,
      order_type,
      created_at,
      closed_at,
      notes,
      clients (
        id,
        name,
        pib,
        adresa,
        grad,
        postanski_broj,
        email,
        telefon
      ),
      film_jobs (
        id,
        file_name,
        width_mm,
        height_mm,
        qty,
        computed_total_m,
        note
      )
    `)
    .in("id", orderIds)
    .eq("order_type", "film")
    .eq("status", "closed")
    .is("deleted_at", null)
    .is("invalidated_at", null);

  if (woError) {
    return { success: false, exportedCount: 0, skippedCount: 0, errors: [woError.message] };
  }

  if (!workOrders || workOrders.length === 0) {
    return { success: false, exportedCount: 0, skippedCount: 0, errors: ["Nema validnih Film naloga za izvoz."] };
  }

  const skippedCount = orderIds.length - workOrders.length;

  // Build Narocila for each work order
  const narocilaXml = workOrders.map(wo => {
    const client = wo.clients as any;
    const filmJobs = wo.film_jobs as any[] || [];
    
    // Get Minimax šifra from PIB mapping
    const minimaxStrankaSifra = getMinimaxStrankaSifra(client?.pib);
    const clientSifra = minimaxStrankaSifra || 
      (client?.pib ? truncate(client.pib.replace(/\D/g, ""), 30) : 
       truncate((client?.name || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase(), 30));

    const orderNumber = wo.order_number || wo.id;
    const orderDate = format(new Date(wo.created_at), "yyyy-MM-dd");
    const hasMinimaxClient = minimaxStrankaSifra !== null;

    // Build NarociloVrstice - each film job is a separate row
    const vrsticeXml = filmJobs
      .filter(job => job.computed_total_m && job.computed_total_m > 0)
      .map(job => {
        const totalMeters = job.computed_total_m || 0;
        
        // Opis format: "Usluga: [klijent] [dimenzije] [broj naloga] [naziv fajla]"
        const clientShort = getClientShortName(client?.name || "");
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

    // Skip orders with no valid film jobs
    if (!vrsticeXml) {
      return null;
    }

    return `
    <Narocilo>
      <NarociloGlava>
        <PrejetoIzdano>P</PrejetoIzdano>
        <Datum>${orderDate}</Datum>
        <SifraStranke>${escapeXml(clientSifra)}</SifraStranke>${hasMinimaxClient ? "" : `
        <NazivStranke>${escapeXml(truncate(client?.name, 100))}</NazivStranke>${client?.adresa ? `
        <NaslovStranke>${escapeXml(truncate(client.adresa, 50))}</NaslovStranke>` : ""}${client?.postanski_broj ? `
        <PostnaStevilka>${escapeXml(truncate(client.postanski_broj, 30))}</PostnaStevilka>` : ""}${client?.grad ? `
        <NazivPoste>${escapeXml(truncate(client.grad, 250))}</NazivPoste>` : ""}`}
        <Veza>${escapeXml(truncate(orderNumber, 30))}</Veza>
        <SifraDenarneEnote>RSD</SifraDenarneEnote>
        ${wo.notes ? `<Opomba>${escapeXml(truncate(wo.notes, 1000))}</Opomba>` : ""}
      </NarociloGlava>
      <NarociloVrstice>${vrsticeXml}
      </NarociloVrstice>
    </Narocilo>`;
  }).filter(Boolean).join("");

  if (!narocilaXml) {
    return { success: false, exportedCount: 0, skippedCount, errors: ["Nijedan nalog nema validne stavke za izvoz."] };
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<miniMAXUvozKnjigovodstvo xmlns="${MINIMAX_NAMESPACE}">
  <Narocila>${narocilaXml}
  </Narocila>
</miniMAXUvozKnjigovodstvo>`;

  // Download the file
  const fileName = `Minimax_Film_Batch_${format(new Date(), "yyyyMMdd_HHmm")}.xml`;
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    success: true,
    exportedCount: workOrders.length,
    skippedCount,
    errors,
  };
}
