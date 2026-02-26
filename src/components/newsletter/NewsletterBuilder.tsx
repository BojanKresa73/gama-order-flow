import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowUp, ArrowDown, Eye, Type, Image, RectangleHorizontal, Phone, Minus, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type BlockType = "heading" | "text" | "image" | "button" | "divider" | "contact";

interface Block {
  id: string;
  type: BlockType;
  content: Record<string, string>;
}

const DEFAULT_BLOCKS: Block[] = [
  { id: "1", type: "heading", content: { text: "Poštovani klijenti," } },
  { id: "2", type: "text", content: { text: "Obaveštavamo Vas o novostima iz naše kompanije." } },
  { id: "3", type: "divider", content: {} },
  { id: "4", type: "text", content: { text: "Srdačan pozdrav,\nVaš tim — Gama United" } },
];

const TEMPLATES: { name: string; blocks: Block[] }[] = [
  {
    name: "Praznik / Čestitka",
    blocks: [
      { id: "t1-1", type: "heading", content: { text: "🎉 Srećan praznik!" } },
      { id: "t1-2", type: "text", content: { text: "Poštovani klijenti i partneri,\n\nPovodom predstojećeg praznika, obaveštavamo Vas da naša kompanija neće raditi u periodu od [datum] do [datum]." } },
      { id: "t1-3", type: "text", content: { text: "Redovan rad nastavljamo [datum]." } },
      { id: "t1-4", type: "contact", content: { label: "Za hitne slučajeve", phone: "063 / 237 - 226" } },
      { id: "t1-5", type: "divider", content: {} },
      { id: "t1-6", type: "text", content: { text: "Želimo Vam srećan praznik!\nVaš tim — Gama United" } },
    ],
  },
  {
    name: "Obaveštenje",
    blocks: [
      { id: "t2-1", type: "heading", content: { text: "Obaveštenje" } },
      { id: "t2-2", type: "text", content: { text: "Poštovani,\n\nŽeleli bismo da Vas obavestimo o sledećem:" } },
      { id: "t2-3", type: "text", content: { text: "Unesite ovde detalje obaveštenja..." } },
      { id: "t2-4", type: "button", content: { text: "Saznajte više", url: "https://gamaunited.rs" } },
      { id: "t2-5", type: "divider", content: {} },
      { id: "t2-6", type: "text", content: { text: "Srdačan pozdrav,\nGama United" } },
    ],
  },
  {
    name: "Promocija / Ponuda",
    blocks: [
      { id: "t3-1", type: "heading", content: { text: "Specijalna ponuda! 🔥" } },
      { id: "t3-2", type: "image", content: { url: "", alt: "Slika ponude" } },
      { id: "t3-3", type: "text", content: { text: "Poštovani,\n\nImamo specijalnu ponudu za Vas! Unesite ovde detalje ponude..." } },
      { id: "t3-4", type: "button", content: { text: "Iskoristite ponudu", url: "https://gamaunited.rs" } },
      { id: "t3-5", type: "divider", content: {} },
      { id: "t3-6", type: "text", content: { text: "Vaš tim — Gama United" } },
    ],
  },
  {
    name: "Prazan šablon",
    blocks: [...DEFAULT_BLOCKS],
  },
];

const BRAND = {
  primary: "#1a2366",
  accent: "#C6363C",
  bg: "#f8f9fa",
  white: "#ffffff",
  text: "#333333",
  muted: "#666666",
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function blockToHtml(block: Block): string {
  switch (block.type) {
    case "heading":
      return `<h1 style="color:${BRAND.primary};font-size:24px;font-weight:700;margin:0 0 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${(block.content.text || "").replace(/\n/g, "<br>")}</h1>`;
    case "text":
      return `<p style="color:${BRAND.text};font-size:16px;line-height:1.6;margin:0 0 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${(block.content.text || "").replace(/\n/g, "<br>")}</p>`;
    case "image":
      if (!block.content.url) return "";
      return `<div style="margin:0 0 16px;text-align:center;"><img src="${block.content.url}" alt="${block.content.alt || ""}" style="max-width:100%;height:auto;border-radius:8px;" /></div>`;
    case "button":
      return `<div style="margin:24px 0;text-align:center;"><a href="${block.content.url || "#"}" style="display:inline-block;background:${BRAND.accent};color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${block.content.text || "Kliknite ovde"}</a></div>`;
    case "divider":
      return `<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />`;
    case "contact":
      return `<div style="background:${BRAND.primary};border-radius:8px;padding:20px;text-align:center;margin:16px 0;"><p style="color:#ffffff;margin:0 0 8px;font-size:14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${block.content.label || "Kontakt"}</p><p style="color:#ffffff;margin:0;font-size:22px;font-weight:700;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${block.content.phone || ""}</p></div>`;
    default:
      return "";
  }
}

export function blocksToFullHtml(blocks: Block[]): string {
  const bodyHtml = blocks.map(blockToHtml).join("\n");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
  <!-- Header -->
  <div style="background:${BRAND.primary};border-radius:12px 12px 0 0;padding:24px;text-align:center;">
    <img src="https://ytophmlfbrnhmqtwpijn.supabase.co/storage/v1/object/public/assets/gama-united-logo-white.png" alt="Gama United" style="height:40px;" onerror="this.style.display='none'" />
    <h2 style="color:#ffffff;margin:8px 0 0;font-size:18px;font-weight:600;">Gama United</h2>
  </div>
  <!-- Content -->
  <div style="background:${BRAND.white};padding:32px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
    ${bodyHtml}
  </div>
  <!-- Footer -->
  <div style="background:${BRAND.primary};border-radius:0 0 12px 12px;padding:20px;text-align:center;">
    <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">© ${new Date().getFullYear()} Gama United · Veljka Milićevića 2/10, Beograd</p>
  </div>
</div>
</body>
</html>`;
}

const BLOCK_ICONS: Record<BlockType, any> = {
  heading: Type,
  text: Type,
  image: Image,
  button: RectangleHorizontal,
  divider: Minus,
  contact: Phone,
};

const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Naslov",
  text: "Tekst",
  image: "Slika",
  button: "Dugme",
  divider: "Razdvajač",
  contact: "Kontakt / Telefon",
};

function BlockEditor({ block, onChange }: { block: Block; onChange: (c: Record<string, string>) => void }) {
  const c = block.content;
  switch (block.type) {
    case "heading":
    case "text":
      return (
        <Textarea
          value={c.text || ""}
          onChange={(e) => onChange({ ...c, text: e.target.value })}
          placeholder={block.type === "heading" ? "Naslov..." : "Tekst paragrafa..."}
          className={block.type === "heading" ? "font-bold text-lg" : ""}
          rows={block.type === "heading" ? 2 : 4}
        />
      );
    case "image":
      return <ImageBlockEditor content={c} onChange={onChange} />;
    case "button":
      return (
        <div className="space-y-2">
          <Input value={c.text || ""} onChange={(e) => onChange({ ...c, text: e.target.value })} placeholder="Tekst dugmeta" />
          <Input value={c.url || ""} onChange={(e) => onChange({ ...c, url: e.target.value })} placeholder="URL linka (https://...)" />
        </div>
      );
    case "contact":
      return (
        <div className="space-y-2">
          <Input value={c.label || ""} onChange={(e) => onChange({ ...c, label: e.target.value })} placeholder="Label (npr: Za hitne slučajeve)" />
          <Input value={c.phone || ""} onChange={(e) => onChange({ ...c, phone: e.target.value })} placeholder="Telefon" />
        </div>
      );
    case "divider":
      return <p className="text-sm text-muted-foreground">Horizontalna linija — bez podešavanja</p>;
    default:
      return null;
  }
}

function ImageBlockEditor({ content, onChange }: { content: Record<string, string>; onChange: (c: Record<string, string>) => void }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Samo slike su dozvoljene", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("newsletter-assets").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("newsletter-assets").getPublicUrl(path);
      onChange({ ...content, url: urlData.publicUrl });
      toast({ title: "Slika uploadovana!" });
    } catch (err: any) {
      toast({ title: "Greška pri uploadu", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <Input value={content.url || ""} onChange={(e) => onChange({ ...content, url: e.target.value })} placeholder="URL slike ili uploaduj" className="flex-1" />
        <label className="cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          <Button variant="outline" size="sm" asChild disabled={uploading}>
            <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</span>
          </Button>
        </label>
      </div>
      <Input value={content.alt || ""} onChange={(e) => onChange({ ...content, alt: e.target.value })} placeholder="Opis slike (alt tekst)" />
      {content.url && (
        <div className="border rounded p-2 bg-muted/30">
          <img src={content.url} alt={content.alt || ""} className="max-h-[120px] mx-auto rounded" />
        </div>
      )}
    </div>
  );
}

interface Props {
  onHtmlChange: (html: string) => void;
}

export default function NewsletterBuilder({ onHtmlChange }: Props) {
  const [blocks, setBlocks] = useState<Block[]>([...DEFAULT_BLOCKS]);
  const [activeTab, setActiveTab] = useState("edit");

  const updateBlocks = (newBlocks: Block[]) => {
    setBlocks(newBlocks);
    onHtmlChange(blocksToFullHtml(newBlocks));
  };

  const addBlock = (type: BlockType) => {
    const defaults: Record<BlockType, Record<string, string>> = {
      heading: { text: "Novi naslov" },
      text: { text: "Novi paragraf teksta..." },
      image: { url: "", alt: "" },
      button: { text: "Kliknite ovde", url: "https://gamaunited.rs" },
      divider: {},
      contact: { label: "Kontakt", phone: "" },
    };
    updateBlocks([...blocks, { id: generateId(), type, content: defaults[type] }]);
  };

  const removeBlock = (id: string) => updateBlocks(blocks.filter((b) => b.id !== id));

  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if ((dir === -1 && idx === 0) || (dir === 1 && idx === blocks.length - 1)) return;
    const next = [...blocks];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    updateBlocks(next);
  };

  const updateBlock = (id: string, content: Record<string, string>) => {
    updateBlocks(blocks.map((b) => (b.id === id ? { ...b, content } : b)));
  };

  const loadTemplate = (tplIdx: number) => {
    const tpl = TEMPLATES[tplIdx];
    const newBlocks = tpl.blocks.map((b) => ({ ...b, id: generateId() }));
    updateBlocks(newBlocks);
  };

  const html = blocksToFullHtml(blocks);

  return (
    <div className="space-y-4">
      {/* Template selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <Label className="text-sm font-medium">Šablon:</Label>
        {TEMPLATES.map((t, i) => (
          <Button key={i} variant="outline" size="sm" onClick={() => loadTemplate(i)}>
            {t.name}
          </Button>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="edit">Uređivač</TabsTrigger>
          <TabsTrigger value="preview" className="gap-1"><Eye className="h-4 w-4" />Pregled</TabsTrigger>
          <TabsTrigger value="html">HTML</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-3">
          {blocks.map((block, idx) => {
            const Icon = BLOCK_ICONS[block.type];
            return (
              <Card key={block.id} className="relative">
                <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase">{BLOCK_LABELS[block.type]}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveBlock(block.id, -1)} disabled={idx === 0}><ArrowUp className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveBlock(block.id, 1)} disabled={idx === blocks.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBlock(block.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-3 px-3">
                  <BlockEditor block={block} onChange={(c) => updateBlock(block.id, c)} />
                </CardContent>
              </Card>
            );
          })}

          {/* Add block buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="text-sm text-muted-foreground self-center">Dodaj:</span>
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => {
              const Icon = BLOCK_ICONS[type];
              return (
                <Button key={type} variant="outline" size="sm" onClick={() => addBlock(type)} className="gap-1">
                  <Icon className="h-3 w-3" />{BLOCK_LABELS[type]}
                </Button>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <div className="border rounded-lg overflow-hidden bg-[#f8f9fa]">
            <iframe
              srcDoc={html}
              className="w-full min-h-[500px] border-0"
              title="Newsletter preview"
              sandbox=""
            />
          </div>
        </TabsContent>

        <TabsContent value="html">
          <Textarea value={html} readOnly className="font-mono text-xs min-h-[400px]" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
