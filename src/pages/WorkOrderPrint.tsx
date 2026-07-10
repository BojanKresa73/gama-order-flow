import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { computeFilmUsage } from "@/lib/filmUsage";
import { format, differenceInHours, differenceInMinutes } from "date-fns";
import { calculateGroupedPricing, formatTierLabel, type DigitalJobItem } from "@/lib/digitalGroupedPricing";

interface WorkOrderData {
  id: string;
  order_number: string;
  display_order_number: string;
  order_type: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  invalidated_at: string | null;
  invalid_reason: string | null;
  notes: string | null;
  job_name: string | null;
  run_quantity: number | null;
  print_format: string | null;
  binding: string | null;
  lamination: string | null;
  prep_hours: number | null;
  client_name: string;
  client_email: string | null;
  client_pib: string | null;
  created_by: string;
  created_by_name: string | null;
  closed_by: string | null;
  closed_by_name: string | null;
  items: any[];
}

interface CreatorInfo {
  full_name: string | null;
}

interface CloserInfo {
  user_id: string;
  full_name: string;
  items_count: number;
}

interface PreparedRow {
  rbr: number;
  name: string;
  details: string;
  qty: number;
  closedBy?: string;
  piecesCount?: number | null;
}

// Digital Pricing Print Section Component
const DigitalPricingPrintSection = ({ items, prepHours = 0 }: { items: any[]; prepHours?: number }) => {
  const digitalJobs: DigitalJobItem[] = items.map(item => ({
    id: item.id,
    name: item.name || item.file_name,
    file_name: item.file_name,
    obim: item.obim || 1,
    qty: item.qty || 1,
    print_sides: item.print_sides || '4/4',
    machine_sheet_format: item.machine_sheet_format || '488x330',
    paper_type: item.paper_type,
    // Normalize to a strict boolean. Some JSON sources can provide "false" as a string,
    // which would otherwise be treated as truthy and filter out all items.
    is_test_print:
      item.is_test_print === true || item.is_test_print === 1 || item.is_test_print === "true",
    pieces_count: item.pieces_count || null,
  }));

  const pricing = calculateGroupedPricing(digitalJobs, prepHours);
  if (pricing.groups.length === 0) {
    const testCount = digitalJobs.filter(j => j.is_test_print).length;
    return (
      <div className="digital-pricing-section">
        <div className="section-title">Kalkulacija digitale</div>
        <div style={{ fontSize: '11px', color: '#666' }}>
          Nema stavki za obračun{testCount > 0 ? ` (test štampa: ${testCount}/${digitalJobs.length})` : ''}.
        </div>
      </div>
    );
  }

  return (
    <div className="digital-pricing-section">
      <div className="section-title">Kalkulacija digitale</div>
      
      {pricing.groups.map((group) => (
        <div key={`${group.coverage}-${group.format}`} className="pricing-group">
          <div className="pricing-group-header">
            <span className="coverage-badge">{group.coverage}</span>
            <span className="format-badge">{group.format}</span>
            <span className="tier-info">Kategorija: {formatTierLabel(group.tier)}</span>
          </div>
          
          <table className="pricing-items-table">
            <thead>
              <tr>
                <th>Naziv</th>
                <th>Obim</th>
                <th>Tiraž</th>
                <th>Tabaka</th>
                {group.format === '700x330' && <th>× 1.5</th>}
              </tr>
            </thead>
            <tbody>
              {group.items.map((item, idx) => {
                // Calculate price per piece if pieces_count exists
                // pieces_count is the TOTAL number of pieces, not per copy
                const itemPrice = item.sheets * group.pricePerSheetBase * group.formatMultiplier;
                const totalPieces = item.piecesCount || null;
                const pricePerPiece = totalPieces ? itemPrice / totalPieces : null;
                
                return (
                  <tr key={idx}>
                    <td>
                      {item.name}
                      {pricePerPiece !== null && totalPieces && (
                        <div className="price-per-piece">
                          {totalPieces} kom × {pricePerPiece.toFixed(4)} € = {(totalPieces * pricePerPiece).toFixed(2)} €
                        </div>
                      )}
                    </td>
                    <td>{item.obim}</td>
                    <td>{item.qty}</td>
                    <td>{item.sheets}</td>
                    {group.format === '700x330' && <td>{item.sheetsForTier}</td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}><strong>Ukupno {group.coverage} {group.format}</strong></td>
                <td><strong>{group.totalSheets} tab.</strong></td>
                {group.format === '700x330' && <td><strong>{group.totalSheetsForTier}</strong></td>}
              </tr>
            </tfoot>
          </table>
          
          <div className="pricing-calculation">
            <div className="calc-row">
              <span>Cena po tabaku ({group.coverage}):</span>
              <span>{group.pricePerSheetBase.toFixed(2)} €</span>
            </div>
            <div className="calc-row total">
              <span>{group.totalSheets} × {group.pricePerSheetBase.toFixed(2)} €{group.format === '700x330' ? ' × 1.5' : ''}</span>
              <span className="price-value">{group.groupTotal.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      ))}
      
      <div className="pricing-summary">
        {pricing.prepCost > 0 && (
          <div className="summary-row prep-cost">
            <span>Priprema ({prepHours} sati × 25 €):</span>
            <span>{pricing.prepCost.toFixed(2)} €</span>
          </div>
        )}
        <div className="summary-row grand-total">
          <span>UKUPNA CENA:</span>
          <span>{pricing.totalWithPrep.toFixed(2)} €</span>
        </div>
        <div className="summary-row">
          <span>Trošak papira:</span>
          <span>{pricing.totalPaperCost.toFixed(2)} €</span>
        </div>
        <div className="summary-row">
          <span>Trošak klikova (Color: {pricing.totalColorClicks}, Mono: {pricing.totalMonoClicks}):</span>
          <span>{pricing.totalClickCost.toFixed(2)} €</span>
        </div>
        <div className="summary-row">
          <span>Ukupan trošak:</span>
          <span>{pricing.totalCost.toFixed(2)} €</span>
        </div>
        <div className="summary-row ruc">
          <span>RUC (Razlika u ceni):</span>
          <span>{pricing.ruc.toFixed(2)} € ({pricing.rucPercent.toFixed(1)}%)</span>
        </div>
      </div>
    </div>
  );
};

export default function WorkOrderPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Direct role check for print view - ensures role is loaded before rendering pricing
  const [canSeePricing, setCanSeePricing] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  
  const [data, setData] = useState<WorkOrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [closerName, setCloserName] = useState<string | null>(null);
  const [closerDetails, setCloserDetails] = useState<CloserInfo[]>([]);
  const [isMixCloser, setIsMixCloser] = useState(false);

  // Fetch role directly to avoid React Query timing issues in new tab
  useEffect(() => {
    let cancelled = false;
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    (async () => {
      try {
        // When opening /print in a new tab, the auth session can take a moment to
        // hydrate from storage. If we call the role RPC too early it may behave
        // like an unauthenticated request and return "guest".
        for (let i = 0; i < 10; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.access_token) break;
          await sleep(150);
        }

        const { data: role, error } = await supabase.rpc("current_user_role");
        if (error) throw error;
        const r = (role as string) || "guest";
        const allowed = r === "superuser" || r === "admin_plus" || r === "admin";
        if (!cancelled) setCanSeePricing(allowed);
      } catch (e) {
        console.warn("[WorkOrderPrint] Role check failed", e);
        if (!cancelled) setCanSeePricing(false);
      } finally {
        if (!cancelled) setRoleLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (id) {
      fetchWorkOrder();
    }
  }, [id]);

  const fetchWorkOrder = async () => {
    try {
      const { data: result, error } = await supabase
        .rpc('get_work_order_full', { p_identifier: id });

      if (error) throw error;
      if (!result) throw new Error('Work order not found');

      const orderData = result as unknown as WorkOrderData;
      setData(orderData);

      // Use names from RPC result directly (no separate profile queries needed)
      setCreatorName(orderData.created_by_name || null);
      setCloserName(orderData.closed_by_name || null);

      // For CTP/Other orders, check file_entries for individual closers
      if (orderData.order_type === 'ctp' || orderData.order_type === 'other') {
        const { data: files } = await supabase
          .from('file_entries')
          .select('closed_by, profiles:closed_by(full_name)')
          .eq('work_order_id', orderData.id)
          .not('closed_by', 'is', null);

        if (files && files.length > 0) {
          // Group by closer
          const closerMap = new Map<string, { name: string; count: number }>();
          files.forEach(f => {
            if (f.closed_by) {
              const name = (f.profiles as any)?.full_name || 'Nepoznat';
              const existing = closerMap.get(f.closed_by);
              if (existing) {
                existing.count++;
              } else {
                closerMap.set(f.closed_by, { name, count: 1 });
              }
            }
          });

          const details: CloserInfo[] = Array.from(closerMap.entries()).map(([userId, info]) => ({
            user_id: userId,
            full_name: info.name,
            items_count: info.count
          }));

          setCloserDetails(details);
          setIsMixCloser(details.length > 1);
          
          // If no main closer but we have file closers, use the first one
          if (!orderData.closed_by && details.length === 1) {
            setCloserName(details[0].full_name);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading work order:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return format(new Date(dateString), 'dd.MM.yyyy HH:mm');
  };

  const calculateDuration = (start: string, end: string | null) => {
    if (!end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const hours = differenceInHours(endDate, startDate);
    const minutes = differenceInMinutes(endDate, startDate) % 60;
    
    if (hours === 0) {
      return `${minutes} min`;
    }
    return `${hours}h ${minutes}min`;
  };

  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case 'ctp': return 'CTP';
      case 'digital': return 'Digitala';
      case 'film': return 'Filmovanje';
      case 'other': return 'Ostalo';
      case 'large_format': return 'Veliki Format';
      default: return type.toUpperCase();
    }
  };

  const prepareRows = (): PreparedRow[] => {
    if (!data) return [];

    if (data.order_type === 'film') {
      return data.items.map((item: any, i: number) => {
        const fit = computeFilmUsage({
          widthMm: Number(item.width_mm ?? item.width ?? 0),
          heightMm: Number(item.height_mm ?? item.height ?? 0),
          qty: Number(item.qty ?? item.quantity ?? 1),
        });
        return {
          rbr: i + 1,
          name: item.file_name ?? item.name ?? 'N/A',
          details: `${item.width_mm}×${item.height_mm}mm | Potrošeno: ${fit.totalM.toFixed(2)} m`,
          qty: Number(item.qty ?? item.quantity ?? 1),
        };
      });
    }

    if (data.order_type === 'ctp') {
      return data.items.map((item: any, i: number) => ({
        rbr: i + 1,
        name: item.filename ?? item.file_name ?? item.name ?? 'N/A',
        details: item.format_name ?? item.plate_formats?.format_name ?? 'Format ploče',
        qty: Number(item.quantity ?? item.qty ?? 1),
      }));
    }

    if (data.order_type === 'digital') {
      return data.items.map((item: any, i: number) => ({
        rbr: i + 1,
        name: item.file_name ?? item.name ?? 'N/A',
        details: `Format: ${item.machine_sheet_format || '488×330'} | Štampa: ${item.print_sides ?? 'N/A'} | Obim: ${item.obim || 1}${item.pieces_count ? ` | Komada: ${item.pieces_count}` : ''}`,
        qty: Number(item.qty ?? item.quantity ?? 1),
        piecesCount: item.pieces_count || null,
      }));
    }

    // Other/Ostalo
    return data.items.map((item: any, i: number) => ({
      rbr: i + 1,
      name: item.filename ?? item.file_name ?? item.name ?? 'N/A',
      details: item.format_name ?? item.notes ?? '-',
      qty: Number(item.quantity ?? item.qty ?? 1),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Učitavanje...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Radni nalog nije pronađen
      </div>
    );
  }

  const rows = prepareRows();
  const duration = calculateDuration(data.created_at, data.closed_at);

  // Calculate totals based on order type
  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const totalFilmMeters = data.order_type === 'film' 
    ? data.items.reduce((sum: number, item: any) => {
        const fit = computeFilmUsage({
          widthMm: Number(item.width_mm ?? 0),
          heightMm: Number(item.height_mm ?? 0),
          qty: Number(item.qty ?? 1),
        });
        return sum + fit.totalM;
      }, 0)
    : null;

  return (
    <>
      <style>{PRINT_CSS}</style>
      
      <div className="min-h-screen bg-background">
        <div className="no-print border-b bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex justify-end items-center">
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Štampa / Sačuvaj kao PDF
            </Button>
          </div>
        </div>
        <div className="no-print container mx-auto px-4 py-3 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Ovo je pregled radnog naloga za štampu. Izmene nisu moguće.
          </p>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="bg-white shadow-lg max-w-[210mm] mx-auto print-page">
            {data.invalidated_at && (
              <div className="invalid-stamp">NEVAŽEĆE</div>
            )}
            <div className="p-8">
              {/* Header */}
              <div className="page-header">
                <div className="brand-section">
                  <img src="/gama-united-logo.svg" alt="Gama United" className="brand-logo" />
                  <div className="company-info">
                    Veljka Milićevića 2/10, Beograd<br />
                    PIB: 1114876455<br />
                    www.gamaunited.rs
                  </div>
                </div>
                <div className="meta-section">
                  <h1 className="document-title">RADNI NALOG</h1>
                  <div className="document-meta">
                    <div><strong>Broj naloga:</strong> {data.display_order_number || data.order_number}</div>
                    <div><strong>Tip naloga:</strong> {getOrderTypeLabel(data.order_type)}</div>
                    <div><strong>Status:</strong> {data.status === 'closed' ? 'Zatvoren' : 'Otvoren'}</div>
                  </div>
                </div>
              </div>

              {/* Client Info */}
              <div className="client-section">
                <div className="section-title">Klijent</div>
                <div className="client-details">
                  <strong>{data.client_name}</strong>
                  {data.client_email && <div>Email: {data.client_email}</div>}
                  {data.client_pib && <div>PIB: {data.client_pib}</div>}
                </div>
              </div>

              {/* Order Details */}
              <div className="details-grid">
                <div className="detail-box">
                  <div className="detail-label">Datum otvaranja</div>
                  <div className="detail-value">{formatDate(data.created_at)}</div>
                </div>
                <div className="detail-box">
                  <div className="detail-label">Otvorio</div>
                  <div className="detail-value">{creatorName || '-'}</div>
                </div>
                {data.closed_at && (
                  <>
                    <div className="detail-box">
                      <div className="detail-label">Datum zatvaranja</div>
                      <div className="detail-value">{formatDate(data.closed_at)}</div>
                    </div>
                    <div className="detail-box">
                      <div className="detail-label">Zatvorio</div>
                      <div className="detail-value">
                        {isMixCloser ? 'Mix (više radnika)' : (closerName || '-')}
                      </div>
                    </div>
                  </>
                )}
                {duration && (
                  <div className="detail-box highlight">
                    <div className="detail-label">Trajanje</div>
                    <div className="detail-value">{duration}</div>
                  </div>
                )}
              </div>

              {/* Mix Closer Details */}
              {isMixCloser && closerDetails.length > 0 && (
                <div className="closer-details-section">
                  <div className="section-title">Detalji zatvaranja po radniku</div>
                  <table className="closer-table">
                    <thead>
                      <tr>
                        <th>Radnik</th>
                        <th>Broj zatvorenih stavki</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closerDetails.map((closer, idx) => (
                        <tr key={idx}>
                          <td>{closer.full_name}</td>
                          <td>{closer.items_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Job Info for Digital/Other */}
              {(data.job_name || data.run_quantity || data.binding || data.lamination || data.print_format) && (
                <div className="job-info-section">
                  <div className="section-title">Detalji posla</div>
                  <div className="job-details-grid">
                    {data.job_name && (
                      <div className="job-detail">
                        <span className="job-label">Naziv posla:</span>
                        <span className="job-value">{data.job_name}</span>
                      </div>
                    )}
                    {data.run_quantity && (
                      <div className="job-detail">
                        <span className="job-label">Tiraž:</span>
                        <span className="job-value">{data.run_quantity}</span>
                      </div>
                    )}
                    {data.binding && (
                      <div className="job-detail">
                        <span className="job-label">Povez:</span>
                        <span className="job-value">{data.binding}</span>
                      </div>
                    )}
                    {data.lamination && (
                      <div className="job-detail">
                        <span className="job-label">Plastifikacija:</span>
                        <span className="job-value">{data.lamination}</span>
                      </div>
                    )}
                    {data.print_format && (
                      <div className="job-detail">
                        <span className="job-label">Dorada:</span>
                        <span className="job-value">{data.print_format}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="items-section">
                <div className="section-title">Stavke ({rows.length})</div>
                <table className="items-table">
                  <thead>
                    <tr>
                      <th style={{ width: '6%' }}>R.br</th>
                      <th>Naziv</th>
                      <th style={{ width: data.order_type === 'digital' ? '30%' : '35%' }}>Detalji</th>
                      <th style={{ width: '10%' }}>Količina</th>
                      {data.order_type === 'digital' && (
                        <th style={{ width: '10%' }}>Komada</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rbr}>
                        <td>{row.rbr}</td>
                        <td>{row.name}</td>
                        <td>{row.details}</td>
                        <td>{row.qty}</td>
                        {data.order_type === 'digital' && (
                          <td>{row.piecesCount || '-'}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={data.order_type === 'digital' ? 4 : 3} className="text-right"><strong>UKUPNO:</strong></td>
                      <td><strong>{totalQty}</strong></td>
                    </tr>
                    {totalFilmMeters !== null && (
                      <tr>
                        <td colSpan={data.order_type === 'digital' ? 4 : 3} className="text-right"><strong>UKUPNO FILMA:</strong></td>
                        <td><strong>{totalFilmMeters.toFixed(2)} m</strong></td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>

              {/* Digital Pricing Section - only for digital orders and admin/admin_plus/superuser */}
              {data.order_type === 'digital' && data.items.length > 0 && (
                roleLoading ? (
                  <div className="digital-pricing-section" style={{ fontSize: '12px', color: '#666' }}>
                    Učitavanje kalkulacije...
                  </div>
                ) : canSeePricing ? (
                  <DigitalPricingPrintSection items={data.items} prepHours={data.prep_hours || 0} />
                ) : null
              )}

              {/* Notes */}
              {data.notes && (
                <div className="notes-section">
                  <div className="section-title">Napomene</div>
                  <p className="notes-text">{data.notes}</p>
                </div>
              )}

              {/* Signature Section */}
              <div className="signature-section">
                <div className="signature-field">
                  <span className="signature-label">Robu preuzeo</span>
                </div>
                <div className="signature-field">
                  <span className="signature-label">Broj lične karte</span>
                </div>
                <div className="signature-field">
                  <span className="signature-label">Datum</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const PRINT_CSS = `
@page { 
  size: A4 portrait; 
  margin: 12mm; 
}

* { 
  box-sizing: border-box; 
  font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; 
}

body { 
  margin: 0; 
  color: #111; 
}

.invalid-stamp {
  position: fixed;
  top: 10mm;
  right: 10mm;
  padding: 6px 10px;
  border: 2px solid #ef4444;
  color: #ef4444;
  font-weight: 700;
  letter-spacing: 1px;
  font-size: 14px;
  background: white;
  z-index: 1000;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  border-bottom: 2px solid #1e40af;
  padding-bottom: 12px;
  margin-bottom: 16px;
}

.brand-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.brand-logo {
  height: 96px;
  width: auto;
  display: block;
}

.company-info {
  font-size: 11px;
  line-height: 1.5;
}

.meta-section {
  text-align: right;
  font-size: 11px;
}

.document-title {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #1e40af;
}

.document-meta {
  line-height: 1.6;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e5e7eb;
}

.client-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 6px;
}

.client-details {
  font-size: 12px;
  line-height: 1.5;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.detail-box {
  padding: 10px;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 3px solid #e5e7eb;
}

.detail-box.highlight {
  border-left-color: #1e40af;
  background: #eff6ff;
}

.detail-label {
  font-size: 10px;
  color: #666;
  margin-bottom: 4px;
}

.detail-value {
  font-size: 12px;
  font-weight: 600;
}

.closer-details-section {
  margin-bottom: 16px;
}

.closer-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.closer-table th,
.closer-table td {
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  text-align: left;
}

.closer-table th {
  background: #f3f4f6;
  font-weight: 600;
}

.job-info-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #fefce8;
  border-radius: 6px;
}

.job-details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.job-detail {
  font-size: 11px;
}

.job-label {
  color: #666;
}

.job-value {
  font-weight: 600;
  margin-left: 4px;
}

.items-section {
  margin-bottom: 16px;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.items-table thead th {
  text-align: left;
  background: #1e40af;
  color: white;
  border: 1px solid #1e40af;
  padding: 8px 10px;
  font-weight: 600;
}

.items-table tbody td {
  border: 1px solid #e5e7eb;
  padding: 8px 10px;
  vertical-align: top;
}

.items-table tbody tr:nth-child(even) {
  background: #f8fafc;
}

.items-table tfoot td {
  border: 1px solid #e5e7eb;
  padding: 8px 10px;
  background: #f3f4f6;
}

.text-right {
  text-align: right;
}

.notes-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #fef3c7;
  border-radius: 6px;
}

.notes-text {
  font-size: 11px;
  white-space: pre-wrap;
  margin: 0;
}

.signature-section {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
  margin-top: 32px;
  font-size: 11px;
}

.signature-field {
  border-top: 1px solid #111;
  padding-top: 4px;
  text-align: left;
}

.signature-label {
  font-size: 10px;
  color: #666;
}

@media print {
  .no-print {
    display: none !important;
  }
  
  body {
    background: white;
  }
  
  .print-page {
    box-shadow: none !important;
    margin: 0 !important;
    padding: 0 !important;
  }
}

/* Digital Pricing Section Styles */
.digital-pricing-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 2px solid #1e40af;
}

.pricing-group {
  margin-bottom: 16px;
  page-break-inside: avoid;
}

.pricing-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.coverage-badge {
  background: #1e40af;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.format-badge {
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.tier-info {
  font-size: 10px;
  color: #666;
}

.pricing-items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
  margin-bottom: 8px;
}

.pricing-items-table th {
  text-align: left;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  font-weight: 600;
}

.pricing-items-table td {
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  vertical-align: top;
}

.pricing-items-table tfoot td {
  background: #f8fafc;
  font-weight: 600;
}

.price-per-piece {
  font-size: 9px;
  color: #2563eb;
  background: #eff6ff;
  padding: 2px 4px;
  border-radius: 2px;
  margin-top: 2px;
}

.pricing-calculation {
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 10px;
}

.calc-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.calc-row.total {
  border-top: 1px solid #e5e7eb;
  padding-top: 4px;
  margin-top: 4px;
  font-weight: 600;
}

.price-value {
  color: #1e40af;
}

.pricing-summary {
  margin-top: 16px;
  padding: 12px;
  background: #f0f9ff;
  border-radius: 6px;
  border-left: 4px solid #1e40af;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin-bottom: 4px;
}

.summary-row.grand-total {
  font-size: 14px;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #bfdbfe;
}

.summary-row.prep-cost {
  font-weight: 600;
  color: #2563eb;
  background: #eff6ff;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.summary-row.ruc {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #bfdbfe;
  font-weight: 600;
  color: #16a34a;
}
`;
