import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { computeFilmUsage } from "@/lib/filmUsage";

interface WorkOrderData {
  id: string;
  order_number: string;
  display_order_number: string;
  order_type: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  notes: string | null;
  client_name: string;
  client_email: string | null;
  client_pib: string | null;
  items: any[];
}

interface PreparedRow {
  rbr: number;
  name: string;
  details: string;
  qty: number;
}

export default function WorkOrderPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<WorkOrderData | null>(null);
  const [loading, setLoading] = useState(true);

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

      setData(result as unknown as WorkOrderData);
    } catch (error: any) {
      console.error('Error loading work order:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('sr-RS');
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
          details: `Potrošeno: ${fit.totalM.toFixed(2)} m`,
          qty: Number(item.qty ?? item.quantity ?? 1),
        };
      });
    }

    if (data.order_type === 'ctp') {
      return data.items.map((item: any, i: number) => ({
        rbr: i + 1,
        name: item.filename ?? item.file_name ?? item.name ?? 'N/A',
        details: item.plate_formats?.format_name ?? item.format_name ?? 'Format ploče',
        qty: Number(item.quantity ?? item.qty ?? 1),
      }));
    }

    if (data.order_type === 'digital') {
      return data.items.map((item: any, i: number) => ({
        rbr: i + 1,
        name: item.file_name ?? item.name ?? 'N/A',
        details: `Format: ${item.finished_w_mm}×${item.finished_h_mm}mm; Štampa: ${item.print_sides ?? 'N/A'}`,
        qty: Number(item.qty ?? item.quantity ?? 1),
      }));
    }

    return [];
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

  return (
    <>
      <style>{PRINT_CSS}</style>
      
      <div className="min-h-screen bg-background">
        <div className="no-print border-b bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Nazad
            </Button>
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
            <div className="p-8">
              {/* Header */}
              <div className="page-header">
                <div className="brand-section">
                  <div className="logo-placeholder">
                    <span className="text-primary font-bold text-xl">GAMA UNITED</span>
                  </div>
                  <div className="company-info">
                    <strong>GAMA UNITED d.o.o.</strong><br />
                    Veljka Milićevića 2/10, Beograd<br />
                    PIB: 1114876455
                  </div>
                </div>
                <div className="meta-section">
                  <h1 className="document-title">RADNI NALOG</h1>
                  <div className="document-meta">
                    <div><strong>Broj naloga:</strong> {data.display_order_number || data.order_number}</div>
                    <div><strong>Datum otvaranja:</strong> {formatDate(data.created_at)}</div>
                    {data.closed_at && (
                      <div><strong>Datum zatvaranja:</strong> {formatDate(data.closed_at)}</div>
                    )}
                  </div>
                  <div className="client-info">
                    <strong>Klijent:</strong> {data.client_name}
                    {data.client_email && <><br />{data.client_email}</>}
                    {data.client_pib && <><br />PIB: {data.client_pib}</>}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-8">
                <table className="items-table">
                  <thead>
                    <tr>
                      <th style={{ width: '8%' }}>R.br</th>
                      <th>Naziv fajla</th>
                      <th style={{ width: '28%' }}>Detalji</th>
                      <th style={{ width: '10%' }}>Količina</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rbr}>
                        <td>{row.rbr}</td>
                        <td>{row.name}</td>
                        <td>{row.details}</td>
                        <td>{row.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              {data.notes && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold mb-2">Napomene</h2>
                  <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
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

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 12px;
  margin-bottom: 16px;
}

.brand-section {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.logo-placeholder {
  min-width: 80px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 11px;
  padding: 4px 8px;
}

.company-info {
  font-size: 11px;
  line-height: 1.4;
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
}

.document-meta {
  margin-bottom: 12px;
  line-height: 1.6;
}

.client-info {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #e5e7eb;
  line-height: 1.5;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  margin-bottom: 24px;
}

.items-table thead th {
  text-align: left;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  padding: 8px 10px;
  font-weight: 600;
}

.items-table tbody td {
  border: 1px solid #e5e7eb;
  padding: 8px 10px;
  vertical-align: top;
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
`;
