import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, Tags } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ProductType = {
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  display_order: number;
  default_paper: string | null;
  default_print_sides: string | null;
  default_machine_sheet_format: string | null;
  supports_cover: boolean;
  supports_pages: boolean;
};

type FinishingType = {
  code: string;
  name: string;
  category: string;
  pricing_model: string;
  has_variants: boolean;
  active: boolean;
  display_order: number;
  description: string | null;
};

type FinishingPrice = {
  id: string;
  finishing_code: string;
  variant: string;
  fixed_cost: number;
  unit_price: number;
  min_qty: number;
  max_qty: number | null;
  notes: string | null;
  active: boolean;
  display_order: number;
};

const PRICING_MODELS = [
  { v: "per_copy", l: "Po primerku (per_copy)" },
  { v: "per_item", l: "Po stavci (per_item)" },
  { v: "per_sheet", l: "Po tabaku (per_sheet)" },
  { v: "per_m2", l: "Po m² (per_m2)" },
  { v: "fixed", l: "Fiksno (fixed)" },
  { v: "fixed_plus_per_copy", l: "Fiksno + po primerku" },
];

const CATEGORIES = ["povez", "plastifikacija", "secenje", "numeracija", "ostalo"];

export default function AdminDigitalCatalog() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Šifarnik – Digitalni proizvodi i dorade</h1>
            <p className="text-sm text-muted-foreground">
              Upravljanje tipovima proizvoda, doradama i njihovim cenama
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">Proizvodi</TabsTrigger>
            <TabsTrigger value="finishings">Dorade i cene</TabsTrigger>
          </TabsList>
          <TabsContent value="products" className="mt-4">
            <ProductsTab />
          </TabsContent>
          <TabsContent value="finishings" className="mt-4">
            <FinishingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ============================ PRODUCTS ============================ */

function ProductsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<ProductType | null>(null);
  const [open, setOpen] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-digital-product-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_product_types" as any)
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as unknown as ProductType[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: ProductType) => {
      const { error } = await supabase
        .from("digital_product_types" as any)
        .upsert(p as any, { onConflict: "code" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-digital-product-types"] });
      qc.invalidateQueries({ queryKey: ["digital-product-types"] });
      toast({ title: "Sačuvano" });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) =>
      toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase
        .from("digital_product_types" as any)
        .delete()
        .eq("code", code);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-digital-product-types"] });
      qc.invalidateQueries({ queryKey: ["digital-product-types"] });
      toast({ title: "Obrisano" });
    },
    onError: (e: any) =>
      toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const newProduct = (): ProductType => ({
    code: "",
    name: "",
    description: "",
    active: true,
    display_order: (data[data.length - 1]?.display_order ?? 0) + 10,
    default_paper: "Kunzdruk 135g",
    default_print_sides: "4/4",
    default_machine_sheet_format: "488x330",
    supports_cover: false,
    supports_pages: false,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tipovi proizvoda</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(newProduct())}>
              <Plus className="h-4 w-4 mr-2" /> Novi proizvod
            </Button>
          </DialogTrigger>
          {editing && (
            <ProductDialog
              value={editing}
              isNew={!data.find((d) => d.code === editing.code)}
              onCancel={() => { setOpen(false); setEditing(null); }}
              onSave={(p) => upsert.mutate(p)}
              saving={upsert.isPending}
            />
          )}
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Učitavanje…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead>Default papir</TableHead>
                <TableHead>Strane</TableHead>
                <TableHead>Format mašine</TableHead>
                <TableHead className="text-center">Korice</TableHead>
                <TableHead className="text-center">Strane (pages)</TableHead>
                <TableHead className="text-center">Redosled</TableHead>
                <TableHead className="text-center">Aktivan</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.code}>
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.default_paper}</TableCell>
                  <TableCell>{p.default_print_sides}</TableCell>
                  <TableCell>{p.default_machine_sheet_format}</TableCell>
                  <TableCell className="text-center">{p.supports_cover ? "✓" : "—"}</TableCell>
                  <TableCell className="text-center">{p.supports_pages ? "✓" : "—"}</TableCell>
                  <TableCell className="text-center">{p.display_order}</TableCell>
                  <TableCell className="text-center">{p.active ? "✓" : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setEditing({ ...p }); setOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Obrisati proizvod "${p.name}"?`)) del.mutate(p.code);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ProductDialog({
  value, isNew, onCancel, onSave, saving,
}: {
  value: ProductType;
  isNew: boolean;
  onCancel: () => void;
  onSave: (p: ProductType) => void;
  saving: boolean;
}) {
  const [v, setV] = useState<ProductType>(value);

  const handleSave = () => {
    if (!v.code.trim() || !v.name.trim()) {
      alert("Kod i naziv su obavezni");
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(v.code)) {
      alert("Kod sme sadržati samo mala slova, brojeve, _ i -");
      return;
    }
    onSave(v);
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{isNew ? "Novi proizvod" : `Izmena: ${value.name}`}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Kod *</Label>
          <Input
            value={v.code}
            disabled={!isNew}
            onChange={(e) => setV({ ...v, code: e.target.value.trim().toLowerCase() })}
            placeholder="npr. katalog"
          />
        </div>
        <div>
          <Label>Naziv *</Label>
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div className="col-span-2">
          <Label>Opis</Label>
          <Textarea
            value={v.description ?? ""}
            onChange={(e) => setV({ ...v, description: e.target.value || null })}
            rows={2}
          />
        </div>
        <div>
          <Label>Default papir</Label>
          <Input
            value={v.default_paper ?? ""}
            onChange={(e) => setV({ ...v, default_paper: e.target.value || null })}
          />
        </div>
        <div>
          <Label>Default strane</Label>
          <Select
            value={v.default_print_sides ?? ""}
            onValueChange={(x) => setV({ ...v, default_print_sides: x })}
          >
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {["1/0", "1/1", "4/0", "4/4", "4/1"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Format mašine</Label>
          <Select
            value={v.default_machine_sheet_format ?? ""}
            onValueChange={(x) => setV({ ...v, default_machine_sheet_format: x })}
          >
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="488x330">488x330</SelectItem>
              <SelectItem value="700x330">700x330</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Redosled</Label>
          <Input
            type="number"
            value={v.display_order}
            onChange={(e) => setV({ ...v, display_order: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            checked={v.supports_pages}
            onCheckedChange={(c) => setV({ ...v, supports_pages: c })}
          />
          <Label>Višestrano (page_count)</Label>
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            checked={v.supports_cover}
            onCheckedChange={(c) => setV({ ...v, supports_cover: c })}
          />
          <Label>Podržava posebne korice</Label>
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            checked={v.active}
            onCheckedChange={(c) => setV({ ...v, active: c })}
          />
          <Label>Aktivan</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Otkaži</Button>
        <Button onClick={handleSave} disabled={saving}>Sačuvaj</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ============================ FINISHINGS ============================ */

function FinishingsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<FinishingType | null>(null);
  const [open, setOpen] = useState(false);
  const [pricesFor, setPricesFor] = useState<FinishingType | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-digital-finishing-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_finishing_types" as any)
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as unknown as FinishingType[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: FinishingType) => {
      const { error } = await supabase
        .from("digital_finishing_types" as any)
        .upsert(p as any, { onConflict: "code" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-digital-finishing-types"] });
      qc.invalidateQueries({ queryKey: ["digital-finishing-types"] });
      toast({ title: "Sačuvano" });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) =>
      toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase
        .from("digital_finishing_types" as any)
        .delete()
        .eq("code", code);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-digital-finishing-types"] });
      qc.invalidateQueries({ queryKey: ["digital-finishing-types"] });
      qc.invalidateQueries({ queryKey: ["digital-finishing-prices"] });
      toast({ title: "Obrisano" });
    },
    onError: (e: any) =>
      toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const newFinishing = (): FinishingType => ({
    code: "",
    name: "",
    category: "ostalo",
    pricing_model: "per_copy",
    has_variants: false,
    active: true,
    display_order: (data[data.length - 1]?.display_order ?? 0) + 10,
    description: "",
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tipovi dorada</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(newFinishing())}>
                <Plus className="h-4 w-4 mr-2" /> Nova dorada
              </Button>
            </DialogTrigger>
            {editing && (
              <FinishingDialog
                value={editing}
                isNew={!data.find((d) => d.code === editing.code)}
                onCancel={() => { setOpen(false); setEditing(null); }}
                onSave={(p) => upsert.mutate(p)}
                saving={upsert.isPending}
              />
            )}
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Učitavanje…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead>Kategorija</TableHead>
                  <TableHead>Model cene</TableHead>
                  <TableHead className="text-center">Varijante</TableHead>
                  <TableHead className="text-center">Redosled</TableHead>
                  <TableHead className="text-center">Aktivna</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((f) => (
                  <TableRow key={f.code}>
                    <TableCell className="font-mono text-xs">{f.code}</TableCell>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>{f.category}</TableCell>
                    <TableCell className="text-xs">{f.pricing_model}</TableCell>
                    <TableCell className="text-center">{f.has_variants ? "✓" : "—"}</TableCell>
                    <TableCell className="text-center">{f.display_order}</TableCell>
                    <TableCell className="text-center">{f.active ? "✓" : "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Cene / varijante"
                        onClick={() => setPricesFor(f)}
                      >
                        <Tags className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditing({ ...f }); setOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Obrisati doradu "${f.name}" i sve njene cene?`))
                            del.mutate(f.code);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pricesFor && (
        <PricesDialog finishing={pricesFor} onClose={() => setPricesFor(null)} />
      )}
    </>
  );
}

function FinishingDialog({
  value, isNew, onCancel, onSave, saving,
}: {
  value: FinishingType;
  isNew: boolean;
  onCancel: () => void;
  onSave: (p: FinishingType) => void;
  saving: boolean;
}) {
  const [v, setV] = useState<FinishingType>(value);

  const handleSave = () => {
    if (!v.code.trim() || !v.name.trim()) {
      alert("Kod i naziv su obavezni");
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(v.code)) {
      alert("Kod sme sadržati samo mala slova, brojeve, _ i -");
      return;
    }
    onSave(v);
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{isNew ? "Nova dorada" : `Izmena: ${value.name}`}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Kod *</Label>
          <Input
            value={v.code}
            disabled={!isNew}
            onChange={(e) => setV({ ...v, code: e.target.value.trim().toLowerCase() })}
          />
        </div>
        <div>
          <Label>Naziv *</Label>
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div>
          <Label>Kategorija</Label>
          <Select value={v.category} onValueChange={(x) => setV({ ...v, category: x })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Model cene</Label>
          <Select
            value={v.pricing_model}
            onValueChange={(x) => setV({ ...v, pricing_model: x })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRICING_MODELS.map((m) => (
                <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Opis</Label>
          <Textarea
            value={v.description ?? ""}
            onChange={(e) => setV({ ...v, description: e.target.value || null })}
            rows={2}
          />
        </div>
        <div>
          <Label>Redosled</Label>
          <Input
            type="number"
            value={v.display_order}
            onChange={(e) => setV({ ...v, display_order: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            checked={v.has_variants}
            onCheckedChange={(c) => setV({ ...v, has_variants: c })}
          />
          <Label>Ima varijante</Label>
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            checked={v.active}
            onCheckedChange={(c) => setV({ ...v, active: c })}
          />
          <Label>Aktivna</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Otkaži</Button>
        <Button onClick={handleSave} disabled={saving}>Sačuvaj</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ============================ PRICES ============================ */

function PricesDialog({
  finishing, onClose,
}: { finishing: FinishingType; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-digital-finishing-prices", finishing.code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_finishing_prices" as any)
        .select("*")
        .eq("finishing_code", finishing.code)
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as unknown as FinishingPrice[];
    },
  });

  const [rows, setRows] = useState<FinishingPrice[] | null>(null);
  const list = rows ?? data;

  const update = (id: string, patch: Partial<FinishingPrice>) => {
    setRows(list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const tmp: FinishingPrice = {
      id: `tmp_${Date.now()}`,
      finishing_code: finishing.code,
      variant: finishing.has_variants ? "Nova varijanta" : "",
      fixed_cost: 0,
      unit_price: 0,
      min_qty: 0,
      max_qty: null,
      notes: null,
      active: true,
      display_order: (list[list.length - 1]?.display_order ?? 0) + 10,
    };
    setRows([...list, tmp]);
  };

  const removeRow = (id: string) => setRows(list.filter((r) => r.id !== id));

  const save = useMutation({
    mutationFn: async () => {
      const original = data;
      const toDelete = original.filter((o) => !list.find((r) => r.id === o.id));
      const toUpsert = list.map((r) => {
        const { id, ...rest } = r;
        return id.startsWith("tmp_") ? rest : r;
      });
      if (toDelete.length) {
        const { error } = await supabase
          .from("digital_finishing_prices" as any)
          .delete()
          .in("id", toDelete.map((d) => d.id));
        if (error) throw error;
      }
      if (toUpsert.length) {
        const { error } = await supabase
          .from("digital_finishing_prices" as any)
          .upsert(toUpsert as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-digital-finishing-prices", finishing.code] });
      qc.invalidateQueries({ queryKey: ["digital-finishing-prices"] });
      toast({ title: "Cene sačuvane" });
      setRows(null);
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Cene: {finishing.name}{" "}
            <span className="text-sm text-muted-foreground">({finishing.pricing_model})</span>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-muted-foreground">Učitavanje…</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {finishing.has_variants && <TableHead>Varijanta</TableHead>}
                  <TableHead>Fiksno (€)</TableHead>
                  <TableHead>Jed. cena (€)</TableHead>
                  <TableHead>Min kol.</TableHead>
                  <TableHead>Max kol.</TableHead>
                  <TableHead>Napomena</TableHead>
                  <TableHead>Red.</TableHead>
                  <TableHead className="text-center">Aktivno</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r) => (
                  <TableRow key={r.id}>
                    {finishing.has_variants && (
                      <TableCell>
                        <Input
                          value={r.variant}
                          onChange={(e) => update(r.id, { variant: e.target.value })}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={r.fixed_cost}
                        onChange={(e) =>
                          update(r.id, { fixed_cost: Number(e.target.value) || 0 })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.0001"
                        value={r.unit_price}
                        onChange={(e) =>
                          update(r.id, { unit_price: Number(e.target.value) || 0 })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={r.min_qty}
                        onChange={(e) =>
                          update(r.id, { min_qty: Number(e.target.value) || 0 })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={r.max_qty ?? ""}
                        onChange={(e) =>
                          update(r.id, {
                            max_qty: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={r.notes ?? ""}
                        onChange={(e) => update(r.id, { notes: e.target.value || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-16"
                        value={r.display_order}
                        onChange={(e) =>
                          update(r.id, { display_order: Number(e.target.value) || 0 })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={r.active}
                        onCheckedChange={(c) => update(r.id, { active: c })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(r.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {list.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Nema cena. Dodajte prvu.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <Button variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4 mr-2" /> Dodaj red
            </Button>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Otkaži</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Sačuvaj sve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
