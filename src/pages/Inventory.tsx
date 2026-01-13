import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Package, AlertTriangle, Plus, Trash2 } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newFormatName, setNewFormatName] = useState("");
  const [newLowStockThreshold, setNewLowStockThreshold] = useState(10);
  const [newCurrentStock, setNewCurrentStock] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchPlateFormats();
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

  const updateStock = async (id: string, newStock: number) => {
    try {
      const { error } = await supabase
        .from("plate_formats")
        .update({ current_stock: newStock })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Uspeh",
        description: "Stanje je ažurirano",
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
                  <Button className="gap-2">
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
                  <TableHead>Minimalno stanje</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plateFormats.map((format) => (
                  <TableRow key={format.id}>
                    <TableCell className="font-medium">{format.format_name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={format.current_stock}
                        onChange={(e) => updateStock(format.id, parseInt(e.target.value))}
                        className="w-24"
                      />
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
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStock(format.id, format.current_stock + 10)}
                        >
                          +10
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStock(format.id, Math.max(0, format.current_stock - 10))}
                        >
                          -10
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteFormat(format.id, format.format_name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {plateFormats.length > 0 && (
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Ukupno formata: {plateFormats.length}</span>
                <span className="text-lg font-semibold">
                  Ukupno ploča: {plateFormats.reduce((sum, f) => sum + (f.current_stock || 0), 0).toLocaleString('sr-RS')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Inventory;