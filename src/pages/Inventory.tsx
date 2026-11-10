import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Package, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useAuthz } from "@/hooks/useAuthz";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const Inventory = () => {
  const [plateFormats, setPlateFormats] = useState<any[]>([]);
  const [pendingByFormat, setPendingByFormat] = useState<Record<string, { qty: number; nextEta: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newFormatName, setNewFormatName] = useState("");
  const [newLowStockThreshold, setNewLowStockThreshold] = useState(10);
  const [newCurrentStock, setNewCurrentStock] = useState(0);
  const [adjustment, setAdjustment] = useState<any>(null);
  const [quantity, setQuantity] = useState(0);
  const [kind, setKind] = useState("receipt");
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const { isAdmin, isOp } = useAuthz();
  const canManage = isAdmin || isOp;
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchPlateFormats();
    fetchPending();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
    }
  };

  const fetchPlateFormats = async () => {
    try {
      const { data, error } = await supabase
        .from("plate_formats")
        .select("*")
        .order("format_name", { ascending: true });

      if (error) throw error;
      setPlateFormats(data || []);
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPending = async () => {
    const { data } = await supabase
      .from("procurement_orders")
      .select("status, expected_arrival_date, procurement_order_items(plate_format_id, quantity)")
      .not("status", "in", "(arrived,cancelled)");

    const map: Record<string, { qty: number; nextEta: string | null }> = {};
    (data || []).forEach((o: any) => {
      (o.procurement_order_items || []).forEach((i: any) => {
        if (!i.plate_format_id) return;
        const cur = map[i.plate_format_id] || { qty: 0, nextEta: null };
        cur.qty += i.quantity || 0;
        if (o.expected_arrival_date && (!cur.nextEta || o.expected_arrival_date < cur.nextEta)) {
          cur.nextEta = o.expected_arrival_date;
        }
        map[i.plate_format_id] = cur;
      });
    });
    setPendingByFormat(map);
  };

  const saveAdjustment = async () => {
    if (!adjustment || !Number.isInteger(quantity) || quantity < 0 || reason.trim().length < 3) {
      toast({ title: "Unesite ispravnu količinu i razlog", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("adjust_plate_stock" as any, {
        p_id: adjustment.id, p_expected: adjustment.current_stock, p_quantity: quantity,
        p_kind: kind, p_reason: reason.trim(), p_target: kind === "cut" ? target : null,
      });
      if (error) throw error;
      setAdjustment(null);
      await fetchPlateFormats();
      toast({ title: "Promena lagera sačuvana sa razlogom" });
    } catch (e: any) { toast({ title: "Promena nije sačuvana", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const deleteFormat = async (id: string, formatName: string) => {
    if (!confirm(`Da li ste sigurni da želite da obrišete format "${formatName}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("plate_formats")
        .delete()
        .eq("id", id);

      if (error) {
        if (error.code === '23503') {
          toast({
            title: "Nije moguće obrisati",
            description: "Ovaj format je korišćen u radnim nalozima i ne može se obrisati",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Uspeh",
        description: "Format je obrisan",
      });

      fetchPlateFormats();
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isLowStock = (format: any) => {
    return format.current_stock <= format.low_stock_threshold;
  };

  const addNewFormat = async () => {
    if (!newFormatName.trim()) {
      toast({
        title: "Greška",
        description: "Naziv formata je obavezan",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("plate_formats")
        .insert({
          format_name: newFormatName.trim(),
          low_stock_threshold: newLowStockThreshold,
          current_stock: newCurrentStock,
        });

      if (error) throw error;

      toast({
        title: "Uspeh",
        description: "Format je uspešno dodat",
      });

      setDialogOpen(false);
      setNewFormatName("");
      setNewLowStockThreshold(10);
      setNewCurrentStock(0);
      fetchPlateFormats();
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Učitavanje...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Inventar - Plate formati</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/checklist")}>
              Checklist
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Stanje zaliha
              </CardTitle>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2" disabled={!canManage}>
                    <Plus className="h-4 w-4" />
                    Dodaj novi format
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dodaj novi format ploče</DialogTitle>
                    <DialogDescription>
                      Unesite podatke za novi format ploče
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="format-name">Naziv formata</Label>
                      <Input
                        id="format-name"
                        value={newFormatName}
                        onChange={(e) => setNewFormatName(e.target.value)}
                        placeholder="npr. 70x100"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="current-stock">Trenutno stanje</Label>
                      <Input
                        id="current-stock"
                        type="number"
                        value={newCurrentStock}
                        onChange={(e) => setNewCurrentStock(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="low-stock">Minimalno stanje</Label>
                      <Input
                        id="low-stock"
                        type="number"
                        value={newLowStockThreshold}
                        onChange={(e) => setNewLowStockThreshold(parseInt(e.target.value) || 10)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Otkaži
                    </Button>
                    <Button onClick={addNewFormat}>Dodaj</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Format</TableHead>
                  <TableHead>Trenutno stanje</TableHead>
                  <TableHead>Na putu (Kina)</TableHead>
                  <TableHead>Lager + naručeno</TableHead>
                  <TableHead>Minimalno stanje</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plateFormats.map((format) => {
                  const pending = pendingByFormat[format.id];
                  const pendingQty = pending?.qty || 0;
                  const available = (format.current_stock || 0) + pendingQty;
                  return (
                  <TableRow key={format.id}>
                    <TableCell className="font-medium">{format.format_name}</TableCell>
                    <TableCell>
                      {format.current_stock.toLocaleString("sr-RS")}
                    </TableCell>
                    <TableCell>
                      {pendingQty > 0 ? (
                        <div>
                          <div className="font-medium text-blue-600">{pendingQty.toLocaleString('sr-RS')}</div>
                          {pending?.nextEta && (
                            <div className="text-xs text-muted-foreground">
                              ETA: {new Date(pending.nextEta).toLocaleDateString('sr-Latn')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {available.toLocaleString('sr-RS')}
                    </TableCell>
                    <TableCell>{format.low_stock_threshold}</TableCell>
                    <TableCell>
                      {isLowStock(format) ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <AlertTriangle className="h-3 w-3" />
                          Niska zaliha
                        </Badge>
                      ) : (
                        <Badge variant="default">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {canManage && <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setAdjustment({...format}); setQuantity(0); setKind("receipt"); setReason(""); setTarget(""); }}>Promena lagera</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteFormat(format.id, format.format_name)}><Trash2 className="h-4 w-4" /></Button>
                      </div>}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {plateFormats.length > 0 && (
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-6 justify-between items-center">
                <span className="text-sm text-muted-foreground">Ukupno formata: {plateFormats.length}</span>
                <div className="flex gap-6 text-sm">
                  <span>
                    Lager: <strong>{plateFormats.reduce((sum, f) => sum + (f.current_stock || 0), 0).toLocaleString('sr-RS')}</strong>
                  </span>
                  <span className="text-blue-600">
                    Na putu: <strong>{Object.values(pendingByFormat).reduce((s, p) => s + p.qty, 0).toLocaleString('sr-RS')}</strong>
                  </span>
                  <span className="text-lg font-semibold">
                    Lager + naručeno: {(plateFormats.reduce((sum, f) => sum + (f.current_stock || 0), 0) + Object.values(pendingByFormat).reduce((s, p) => s + p.qty, 0)).toLocaleString('sr-RS')}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Dialog open={!!adjustment} onOpenChange={(open) => !open && !saving && setAdjustment(null)}>
          <DialogContent><DialogHeader><DialogTitle>Promena lagera — {adjustment?.format_name}</DialogTitle><DialogDescription>Trenutno: {adjustment?.current_stock}. Prijem robe evidentirajte jednom; status „Stiglo” u nabavci sam ne povećava lager.</DialogDescription></DialogHeader>
            <Label>Vrsta promene</Label><select className="border rounded p-2 bg-background" value={kind} onChange={e=>setKind(e.target.value)}>
              <option value="receipt">Prijem</option><option value="count">Popis — novo ukupno stanje</option><option value="waste">Škart</option><option value="cut">Sečenje 1:1 u drugi format</option>
            </select>
            {kind === "cut" && <><Label>Ciljni format (jedna ploča daje jednu ploču)</Label><select className="border rounded p-2 bg-background" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Izaberite</option>{plateFormats.filter(f=>f.id!==adjustment?.id).map(f=><option key={f.id} value={f.id}>{f.format_name}</option>)}</select></>}
            <Label>{kind === "count" ? "Prebrojano ukupno stanje" : "Količina promene"}</Label><Input type="number" min="0" step="1" value={quantity} onChange={e=>setQuantity(Number(e.target.value))} />
            <Label>Razlog / broj prijemnice</Label><Input value={reason} onChange={e=>setReason(e.target.value)} />
            <DialogFooter><Button disabled={saving || (kind === "cut" && !target)} onClick={saveAdjustment}>{saving ? "Čuvanje…" : "Sačuvaj promenu"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Inventory;