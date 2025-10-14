import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Package, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button as ButtonIcon } from "@/components/ui/button";

const Inventory = () => {
  const [plateFormats, setPlateFormats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const isLowStock = (format: any) => {
    return format.current_stock <= format.low_stock_threshold;
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
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stanje zaliha
            </CardTitle>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Inventory;