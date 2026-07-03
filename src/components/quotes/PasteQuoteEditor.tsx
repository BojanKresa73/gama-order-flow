import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Printer,
  Eraser,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const exec = (cmd: string, val?: string) => {
  document.execCommand(cmd, false, val);
};

export function PasteQuoteEditor({ open, onOpenChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && ref.current && !ref.current.innerHTML) {
      ref.current.innerHTML = "<p>Nalepite tekst ponude ovde (Ctrl+V)…</p>";
    }
  }, [open]);

  const handlePrint = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ponuda</title>
      <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; color: #111; line-height: 1.5; }
        h1,h2,h3 { margin: 0.6em 0 0.3em; }
        p { margin: 0 0 0.5em; }
        table { border-collapse: collapse; }
        table, th, td { border: 1px solid #999; padding: 4px 8px; }
      </style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const clear = () => {
    if (ref.current) ref.current.innerHTML = "<p><br></p>";
  };

  const btn = "h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nova ponuda — nalepi tekst</DialogTitle>
        </DialogHeader>

        <div className="border rounded-md">
          <div className="flex flex-wrap items-center gap-1 border-b p-1 bg-muted/30">
            <button type="button" className={btn} title="Podebljano" onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}>
              <Bold className="h-4 w-4" />
            </button>
            <button type="button" className={btn} title="Kurziv" onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}>
              <Italic className="h-4 w-4" />
            </button>
            <button type="button" className={btn} title="Podvučeno" onMouseDown={(e) => { e.preventDefault(); exec("underline"); }}>
              <Underline className="h-4 w-4" />
            </button>
            <span className="mx-1 h-5 w-px bg-border" />
            <select
              className="h-8 text-sm bg-transparent border rounded px-1"
              onChange={(e) => { exec("formatBlock", e.target.value); e.currentTarget.value = ""; }}
              defaultValue=""
              title="Stil"
            >
              <option value="" disabled>Stil</option>
              <option value="H1">Naslov 1</option>
              <option value="H2">Naslov 2</option>
              <option value="H3">Naslov 3</option>
              <option value="P">Paragraf</option>
            </select>
            <span className="mx-1 h-5 w-px bg-border" />
            <button type="button" className={btn} title="Lista" onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}>
              <List className="h-4 w-4" />
            </button>
            <button type="button" className={btn} title="Numerisano" onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}>
              <ListOrdered className="h-4 w-4" />
            </button>
            <span className="mx-1 h-5 w-px bg-border" />
            <button type="button" className={btn} title="Levo" onMouseDown={(e) => { e.preventDefault(); exec("justifyLeft"); }}>
              <AlignLeft className="h-4 w-4" />
            </button>
            <button type="button" className={btn} title="Sredina" onMouseDown={(e) => { e.preventDefault(); exec("justifyCenter"); }}>
              <AlignCenter className="h-4 w-4" />
            </button>
            <button type="button" className={btn} title="Desno" onMouseDown={(e) => { e.preventDefault(); exec("justifyRight"); }}>
              <AlignRight className="h-4 w-4" />
            </button>
            <span className="mx-1 h-5 w-px bg-border" />
            <button type="button" className={btn} title="Poništi" onMouseDown={(e) => { e.preventDefault(); exec("undo"); }}>
              <Undo2 className="h-4 w-4" />
            </button>
            <button type="button" className={btn} title="Ponovi" onMouseDown={(e) => { e.preventDefault(); exec("redo"); }}>
              <Redo2 className="h-4 w-4" />
            </button>
            <span className="mx-1 h-5 w-px bg-border" />
            <button
              type="button"
              className={btn}
              title="Ukloni formatiranje"
              onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); }}
            >
              <Eraser className="h-4 w-4" />
            </button>
            <div className="ml-auto flex items-center gap-1 pr-1">
              <Button size="sm" variant="ghost" onClick={clear}>Obriši</Button>
              <Button size="sm" variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" /> Štampa / PDF
              </Button>
            </div>
          </div>

          <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[420px] max-h-[60vh] overflow-y-auto p-4 outline-none prose prose-sm max-w-none dark:prose-invert focus:ring-0"
            style={{ lineHeight: 1.5 }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zatvori</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
