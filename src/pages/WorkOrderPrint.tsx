import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WorkOrderData {
  id: string;
  order_number: string;
  display_order_number: string;
  kind: string;
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

export default function WorkOrderPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<WorkOrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkOrder();
  }, [id]);

  const fetchWorkOrder = async () => {
    try {
      // First fetch work order
      const { data: workOrder, error: woError } = await supabase
        .from('work_orders')
        .select('id, order_number, display_order_number, kind, order_type, status, created_at, closed_at, notes, client_id')
        .eq('id', id)
        .maybeSingle();

      if (woError) throw woError;
      if (!workOrder) throw new Error('Work order not found');

      // Then fetch client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('name, email, pib')
        .eq('id', workOrder.client_id)
        .maybeSingle();

      if (clientError) throw clientError;

      let items: any[] = [];
      const orderKind = workOrder.kind || 'CTP';

      if (orderKind === 'CTP') {
        const { data: entries } = await supabase
          .from('file_entries')
          .select('*, plate_formats(format_name)')
          .eq('work_order_id', id)
          .order('created_at', { ascending: true });
        items = entries || [];
      } else if (orderKind === 'FILMOVANJE') {
        const { data: filmJobs } = await supabase
          .from('film_jobs')
          .select('*')
          .eq('work_order_id', id)
          .order('created_at', { ascending: true });
        items = filmJobs || [];
      } else if (orderKind === 'DIGITALA') {
        const { data: digitalJobs } = await supabase
          .from('digital_jobs')
          .select('*')
          .eq('work_order_id', id)
          .order('order_index', { ascending: true });
        items = digitalJobs || [];
      }

      setData({
        id: workOrder.id,
        order_number: workOrder.order_number,
        display_order_number: workOrder.display_order_number,
        kind: workOrder.kind,
        order_type: workOrder.order_type,
        status: workOrder.status,
        created_at: workOrder.created_at,
        closed_at: workOrder.closed_at,
        notes: workOrder.notes,
        client_name: client?.name || '',
        client_email: client?.email || null,
        client_pib: client?.pib || null,
        items,
      });
    } catch (error: any) {
      console.error('Error loading work order:', error);
      // Don't show toast - we'll show a clean "not found" message instead
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('sr-RS');
  };

  const getDetailsText = (item: any, kind: string) => {
    if (kind === 'CTP') {
      return item.plate_formats?.format_name || 'Format ploče';
    }
    if (kind === 'FILMOVANJE') {
      const totalM = Number(item.computed_total_m ?? 0);
      return `Potrošeno: ${totalM.toFixed(2)} m`;
    }
    if (kind === 'DIGITALA') {
      if (item.finished_w_mm && item.finished_h_mm) {
        return `${item.finished_w_mm}×${item.finished_h_mm} mm`;
      }
      return 'N/A';
    }
    return 'N/A';
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

  return (
    <>
      <style>{`
        @page { 
          size: A4 portrait; 
          margin: 14mm; 
        }
        @media print {
          .no-print { 
            display: none !important; 
          }
          body {
            background: white;
          }
        }
      `}</style>
      
      <div className="min-h-screen bg-background">
        <div className="no-print border-b bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Nazad
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Sačuvaj kao PDF
            </Button>
          </div>
        </div>
        <div className="no-print container mx-auto px-4 py-3 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Ovo je pregled radnog naloga za štampu. Izmene nisu moguće.
          </p>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="bg-white shadow-lg max-w-[210mm] mx-auto" style={{ minHeight: '297mm' }}>
            <div className="p-8">
              {/* Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="w-32 h-16 bg-primary/10 flex items-center justify-center mb-4">
                    <span className="text-primary font-bold text-xl">LOGO</span>
                  </div>
                  <h1 className="text-3xl font-bold mb-2">RADNI NALOG</h1>
                </div>
                <div className="text-right">
                  <div className="mb-2">
                    <p className="font-semibold text-lg">{data.client_name}</p>
                    {data.client_email && (
                      <p className="text-sm text-muted-foreground">{data.client_email}</p>
                    )}
                    {data.client_pib && (
                      <p className="text-sm text-muted-foreground">PIB: {data.client_pib}</p>
                    )}
                  </div>
                  <div className="mt-4 space-y-1 text-sm">
                    <p><span className="font-semibold">Broj naloga:</span> {data.display_order_number || data.order_number}</p>
                    <p><span className="font-semibold">Datum otvaranja:</span> {formatDate(data.created_at)}</p>
                    {data.closed_at && (
                      <p><span className="font-semibold">Datum zatvaranja:</span> {formatDate(data.closed_at)}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Stavke naloga</h2>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border border-border p-2 text-left w-12">R.br</th>
                      <th className="border border-border p-2 text-left">Naziv fajla</th>
                      <th className="border border-border p-2 text-left">Detalji</th>
                      <th className="border border-border p-2 text-right w-24">Količina</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="border border-border p-2 text-center">{idx + 1}</td>
                        <td className="border border-border p-2">{item.file_name || item.filename || '—'}</td>
                        <td className="border border-border p-2">{getDetailsText(item, data.kind)}</td>
                        <td className="border border-border p-2 text-right">{item.qty || item.quantity || 1}</td>
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
