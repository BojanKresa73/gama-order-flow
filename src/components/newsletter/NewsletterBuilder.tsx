import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowUp, ArrowDown, Eye, Type, Image, RectangleHorizontal, Phone, Minus, Upload, Loader2, Palette, AlignLeft, AlignCenter, AlignRight, Bold, Italic } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type BlockType = "heading" | "text" | "image" | "button" | "divider" | "contact";

interface Block {
  id: string;
  type: BlockType;
  content: Record<string, string>;
}

export interface EmailTheme {
  name: string;
  emoji: string;
  description: string;
  primary: string;
  accent: string;
  bg: string;
  white: string;
  text: string;
  muted: string;
  dot: string; // CSS color for the dot preview
}

export const EMAIL_THEMES: EmailTheme[] = [
  { name: "Standard", emoji: "🏢", description: "Klasičan tamno plavi", primary: "#1a2366", accent: "#C6363C", bg: "#f8f9fa", white: "#ffffff", text: "#333333", muted: "#666666", dot: "#1a2366" },
  { name: "Ocean", emoji: "🌊", description: "Duboko plava + tirkizna + bela", primary: "#0c4a6e", accent: "#06b6d4", bg: "#f0f9ff", white: "#ffffff", text: "#1e3a5f", muted: "#64748b", dot: "#0c4a6e" },
  { name: "Sunset", emoji: "🌅", description: "Tamno ljubičasta + narandžasta + roze", primary: "#581c87", accent: "#f97316", bg: "#faf5ff", white: "#ffffff", text: "#3b0764", muted: "#7c3aed", dot: "#581c87" },
  { name: "Forest", emoji: "🌿", description: "Tamno zelena + svetlo zelena + krem", primary: "#14532d", accent: "#22c55e", bg: "#f0fdf4", white: "#ffffff", text: "#1a3a2a", muted: "#4ade80", dot: "#14532d" },
  { name: "Rose Gold", emoji: "🌹", description: "Tamno roze + rose gold + bela", primary: "#831843", accent: "#fb7185", bg: "#fff1f2", white: "#ffffff", text: "#4c0519", muted: "#f43f5e", dot: "#831843" },
  { name: "Midnight", emoji: "🌙", description: "Crna + srebrna + plava", primary: "#0f172a", accent: "#3b82f6", bg: "#f1f5f9", white: "#ffffff", text: "#1e293b", muted: "#94a3b8", dot: "#0f172a" },
  { name: "Kafić / Bistro", emoji: "☕", description: "Krem + tamno zelena + terakota", primary: "#2d3b2d", accent: "#c0704e", bg: "#faf8f5", white: "#ffffff", text: "#3d2b1f", muted: "#8b7355", dot: "#2d3b2d" },
  { name: "Restoran", emoji: "🍽️", description: "Topla bela + braon + zlato", primary: "#44403c", accent: "#d4a054", bg: "#fafaf9", white: "#ffffff", text: "#292524", muted: "#78716c", dot: "#44403c" },
  { name: "Bar / Street Food", emoji: "🍔", description: "Kraft bež + zelena + senf žuta", primary: "#365314", accent: "#eab308", bg: "#fefce8", white: "#ffffff", text: "#3f3f46", muted: "#84cc16", dot: "#365314" },
  { name: "Terracotta", emoji: "🏺", description: "Terakota + krem + braon", primary: "#7c2d12", accent: "#ea580c", bg: "#fff7ed", white: "#ffffff", text: "#431407", muted: "#c2410c", dot: "#7c2d12" },
  { name: "Lavanda", emoji: "💜", description: "Lavanda + tamno ljubičasta + bela", primary: "#3b0764", accent: "#a855f7", bg: "#faf5ff", white: "#ffffff", text: "#2e1065", muted: "#9333ea", dot: "#3b0764" },
  { name: "Coral", emoji: "🐚", description: "Koralna + teal + bela", primary: "#134e4a", accent: "#f43f5e", bg: "#f0fdfa", white: "#ffffff", text: "#1a3a3a", muted: "#2dd4bf", dot: "#134e4a" },
  { name: "Honey", emoji: "🍯", description: "Med žuta + tamno braon + krem", primary: "#451a03", accent: "#f59e0b", bg: "#fffbeb", white: "#ffffff", text: "#422006", muted: "#d97706", dot: "#451a03" },
  { name: "Arctic", emoji: "❄️", description: "Ledeno plava + bela + siva", primary: "#1e3a5f", accent: "#38bdf8", bg: "#f0f9ff", white: "#ffffff", text: "#0c4a6e", muted: "#7dd3fc", dot: "#1e3a5f" },
];

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

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

const FONT_SIZES = [
  { label: "Mali (12px)", value: "12" },
  { label: "Normal (16px)", value: "16" },
  { label: "Srednji (20px)", value: "20" },
  { label: "Veliki (24px)", value: "24" },
  { label: "XL (32px)", value: "32" },
  { label: "XXL (40px)", value: "40" },
];

const TEXT_COLORS = [
  { label: "Podrazumevana", value: "" },
  { label: "Crna", value: "#000000" },
  { label: "Tamno siva", value: "#333333" },
  { label: "Siva", value: "#666666" },
  { label: "Crvena", value: "#dc2626" },
  { label: "Plava", value: "#2563eb" },
  { label: "Zelena", value: "#16a34a" },
  { label: "Narandžasta", value: "#ea580c" },
  { label: "Ljubičasta", value: "#7c3aed" },
  { label: "Roze", value: "#db2777" },
  { label: "Teal", value: "#0d9488" },
  { label: "Braon", value: "#92400e" },
  { label: "Bela", value: "#ffffff" },
];

function blockToHtml(block: Block, theme: EmailTheme): string {
  const c = block.content;
  const align = c.align || "left";
  const bold = c.bold === "true";
  const italic = c.italic === "true";
  const customColor = c.color || "";

  switch (block.type) {
    case "heading": {
      const fontSize = c.fontSize || "24";
      const color = customColor || theme.primary;
      const fontWeight = bold || !c.bold ? "700" : "400"; // headings bold by default
      const fontStyle = italic ? "font-style:italic;" : "";
      return `<h1 style="color:${color};font-size:${fontSize}px;font-weight:${fontWeight};margin:0 0 16px;text-align:${align};${fontStyle}font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">${(c.text || "").replace(/\n/g, "<br>")}</h1>`;
    }
    case "text": {
      const fontSize = c.fontSize || "16";
      const color = customColor || theme.text;
      const fontWeight = bold ? "font-weight:700;" : "";
      const fontStyle = italic ? "font-style:italic;" : "";
      return `<p style="color:${color};font-size:${fontSize}px;line-height:1.6;margin:0 0 16px;text-align:${align};${fontWeight}${fontStyle}font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">${(c.text || "").replace(/\n/g, "<br>")}</p>`;
    }
    case "image":
      if (!c.url) return "";
      return `<div style="margin:0 0 16px;text-align:center;"><img src="${c.url}" alt="${c.alt || ""}" style="max-width:100%;height:auto;border-radius:8px;" /></div>`;
    case "button":
      return `<div style="margin:24px 0;text-align:center;"><a href="${c.url || "#"}" style="display:inline-block;background:${theme.accent};color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">${c.text || "Kliknite ovde"}</a></div>`;
    case "divider":
      return `<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />`;
    case "contact":
      return `<div style="background:${theme.primary};border-radius:8px;padding:20px;text-align:center;margin:16px 0;"><p style="color:#ffffff;margin:0 0 8px;font-size:14px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">${c.label || "Kontakt"}</p><p style="color:#ffffff;margin:0;font-size:22px;font-weight:700;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">${c.phone || ""}</p></div>`;
    default:
      return "";
  }
}

export function blocksToFullHtml(blocks: Block[], theme: EmailTheme = EMAIL_THEMES[0]): string {
  const bodyHtml = blocks.map(b => blockToHtml(b, theme)).join("\n");
  const preheaderText = blocks.find(b => b.type === "text")?.content.text?.substring(0, 120) || "Gama United Newsletter";
  return `<!DOCTYPE html>
<html lang="sr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<meta name="x-apple-disable-message-reformatting">
<title>Gama United</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${theme.bg};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<!-- Preheader (hidden preview text) -->
<div style="display:none;font-size:1px;color:${theme.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheaderText.replace(/"/g, '&quot;')}</div>
<div role="article" aria-roledescription="email" aria-label="Gama United Newsletter" style="max-width:600px;margin:0 auto;padding:20px;">
  <!-- Header -->
  <div style="background:${theme.primary};border-radius:12px 12px 0 0;padding:24px;text-align:center;">
    <img src="https://ytophmlfbrnhmqtwpijn.supabase.co/storage/v1/object/public/newsletter-assets/gama-united-white.png" alt="Gama United" style="height:58px;display:inline-block;" />
  </div>
  <!-- Content -->
  <div style="background:${theme.white};padding:32px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
    ${bodyHtml}
  </div>
  <!-- Footer -->
  <div style="background:${theme.primary};border-radius:0 0 12px 12px;padding:20px;text-align:center;">
    <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">\u00A9 ${new Date().getFullYear()} Gama United \u00B7 Otona \u017Dupan\u010Di\u010Da 19, zgrada Grafi\u010Dko-medijske \u0161kole, Novi Beograd</p>
    <!-- UNSUB_PLACEHOLDER -->
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

// ── Text Formatting Toolbar ──
function TextFormattingToolbar({ content, onChange }: { content: Record<string, string>; onChange: (c: Record<string, string>) => void }) {
  const align = content.align || "left";
  const bold = content.bold === "true";
  const italic = content.italic === "true";
  const fontSize = content.fontSize || "16";
  const color = content.color || "";

  return (
    <div className="flex flex-wrap gap-1 items-center pb-2 border-b mb-2">
      {/* Alignment */}
      <div className="flex border rounded-md overflow-hidden">
        <Button type="button" variant={align === "left" ? "secondary" : "ghost"} size="icon" className="h-7 w-7 rounded-none" onClick={() => onChange({ ...content, align: "left" })}>
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant={align === "center" ? "secondary" : "ghost"} size="icon" className="h-7 w-7 rounded-none" onClick={() => onChange({ ...content, align: "center" })}>
          <AlignCenter className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant={align === "right" ? "secondary" : "ghost"} size="icon" className="h-7 w-7 rounded-none" onClick={() => onChange({ ...content, align: "right" })}>
          <AlignRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Bold / Italic */}
      <div className="flex border rounded-md overflow-hidden">
        <Button type="button" variant={bold ? "secondary" : "ghost"} size="icon" className="h-7 w-7 rounded-none" onClick={() => onChange({ ...content, bold: bold ? "" : "true" })}>
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant={italic ? "secondary" : "ghost"} size="icon" className="h-7 w-7 rounded-none" onClick={() => onChange({ ...content, italic: italic ? "" : "true" })}>
          <Italic className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Font size */}
      <Select value={fontSize} onValueChange={(v) => onChange({ ...content, fontSize: v })}>
        <SelectTrigger className="h-7 w-[110px] text-xs">
          <SelectValue placeholder="Veličina" />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Color picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2">
            <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: color || "#333" }} />
            Boja
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-4 gap-1">
            {TEXT_COLORS.map((tc) => (
              <button
                key={tc.value || "default"}
                onClick={() => onChange({ ...content, color: tc.value })}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-muted transition-colors ${color === tc.value ? "bg-muted font-medium" : ""}`}
                title={tc.label}
              >
                <span
                  className="w-3 h-3 rounded-full border shrink-0"
                  style={{ backgroundColor: tc.value || "#333" }}
                />
                <span className="truncate">{tc.label}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function BlockEditor({ block, onChange }: { block: Block; onChange: (c: Record<string, string>) => void }) {
  const c = block.content;
  switch (block.type) {
    case "heading":
    case "text":
      return (
        <div>
          <TextFormattingToolbar content={c} onChange={onChange} />
          <Textarea
            value={c.text || ""}
            onChange={(e) => onChange({ ...c, text: e.target.value })}
            placeholder={block.type === "heading" ? "Naslov..." : "Tekst paragrafa..."}
            className={`${c.bold === "true" ? "font-bold" : ""} ${c.italic === "true" ? "italic" : ""}`}
            style={{
              textAlign: (c.align as any) || "left",
              fontSize: `${c.fontSize || (block.type === "heading" ? "24" : "16")}px`,
              fontWeight: block.type === "heading" && c.bold !== "false" ? 700 : undefined,
            }}
            rows={block.type === "heading" ? 2 : 4}
          />
        </div>
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

// ── Theme Picker ──
export function ThemePicker({ selectedTheme, onSelect }: { selectedTheme: EmailTheme; onSelect: (t: EmailTheme) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full text-left py-2 hover:bg-muted/50 rounded-md px-2 transition-colors">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Stil email šablona</span>
          <ArrowDown className={`h-3 w-3 ml-auto text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {EMAIL_THEMES.map((theme) => (
            <button
              key={theme.name}
              onClick={() => onSelect(theme)}
              className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all text-xs ${
                selectedTheme.name === theme.name
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
              }`}
            >
              <span
                className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                style={{ backgroundColor: theme.dot }}
              />
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-1">
                  <span>{theme.emoji}</span>
                  <span className="truncate">{theme.name}</span>
                </div>
                <div className="text-muted-foreground text-[11px] leading-tight mt-0.5">{theme.description}</div>
              </div>
            </button>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface Props {
  onHtmlChange: (html: string) => void;
  theme?: EmailTheme;
  initialBlocks?: Block[];
  onBlocksChange?: (blocks: Block[]) => void;
}

export type { Block, BlockType };

export default function NewsletterBuilder({ onHtmlChange, theme = EMAIL_THEMES[0], initialBlocks, onBlocksChange }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => {
    const initial = initialBlocks || [...DEFAULT_BLOCKS];
    return initial;
  });
  const [activeTab, setActiveTab] = useState("edit");
  const mountedRef = useRef(false);

  // Emit initial blocks on mount so parent has the correct state
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      onBlocksChange?.(blocks);
      onHtmlChange(blocksToFullHtml(blocks, theme));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const emitBlocks = (newBlocks: Block[]) => {
    setBlocks(newBlocks);
    onHtmlChange(blocksToFullHtml(newBlocks, theme));
    onBlocksChange?.(newBlocks);
  };

  // Re-generate HTML when theme changes
  const html = blocksToFullHtml(blocks, theme);

  const addBlock = (type: BlockType) => {
    const defaults: Record<BlockType, Record<string, string>> = {
      heading: { text: "Novi naslov" },
      text: { text: "Novi paragraf teksta..." },
      image: { url: "", alt: "" },
      button: { text: "Kliknite ovde", url: "https://gamaunited.rs" },
      divider: {},
      contact: { label: "Kontakt", phone: "" },
    };
    emitBlocks([...blocks, { id: generateId(), type, content: defaults[type] }]);
  };

  const removeBlock = (id: string) => {
    emitBlocks(blocks.filter((b) => b.id !== id));
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if ((dir === -1 && idx === 0) || (dir === 1 && idx === blocks.length - 1)) return;
    const next = [...blocks];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    emitBlocks(next);
  };

  const updateBlock = (id: string, content: Record<string, string>) => {
    emitBlocks(blocks.map((b) => (b.id === id ? { ...b, content } : b)));
  };

  const loadTemplate = (tplIdx: number) => {
    const tpl = TEMPLATES[tplIdx];
    emitBlocks(tpl.blocks.map((b) => ({ ...b, id: generateId() })));
  };

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
