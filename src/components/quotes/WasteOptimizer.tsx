import { useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

/**
 * Guillotine 2D bin packing heuristic (single sheet, one orientation swap).
 * Namenjeno grubloj proceni iskorišćenja tabaka / rolne za LFP i sitnu štampu.
 */
interface Piece {
  w: number;
  h: number;
  qty: number;
  label?: string;
}

function packSheet(sheetW: number, sheetH: number, pieces: Piece[]) {
  const remaining = pieces.flatMap((p) =>
    Array.from({ length: p.qty }, () => ({ w: p.w, h: p.h, label: p.label ?? "" }))
  );
  remaining.sort((a, b) => b.w * b.h - a.w * a.h);

  const placed: { x: number; y: number; w: number; h: number; label: string }[] = [];
  let free = [{ x: 0, y: 0, w: sheetW, h: sheetH }];
  const unplaced: typeof remaining = [];

  for (const p of remaining) {
    let bestIdx = -1;
    let bestScore = Infinity;
    let rotate = false;
    for (let i = 0; i < free.length; i++) {
      const f = free[i];
      if (p.w <= f.w && p.h <= f.h) {
        const score = f.w * f.h - p.w * p.h;
        if (score < bestScore) { bestScore = score; bestIdx = i; rotate = false; }
      }
      if (p.h <= f.w && p.w <= f.h) {
        const score = f.w * f.h - p.h * p.w;
        if (score < bestScore) { bestScore = score; bestIdx = i; rotate = true; }
      }
    }
    if (bestIdx < 0) { unplaced.push(p); continue; }
    const f = free.splice(bestIdx, 1)[0];
    const pw = rotate ? p.h : p.w;
    const ph = rotate ? p.w : p.h;
    placed.push({ x: f.x, y: f.y, w: pw, h: ph, label: p.label });
    // guillotine split (right + bottom)
    if (f.w - pw > 0) free.push({ x: f.x + pw, y: f.y, w: f.w - pw, h: ph });
    if (f.h - ph > 0) free.push({ x: f.x, y: f.y + ph, w: f.w, h: f.h - ph });
  }

  const usedArea = placed.reduce((s, r) => s + r.w * r.h, 0);
  const sheetArea = sheetW * sheetH;
  return {
    placed,
    unplaced: unplaced.length,
    efficiency: sheetArea ? usedArea / sheetArea : 0,
    wastePct: sheetArea ? 1 - usedArea / sheetArea : 0,
  };
}

export function WasteOptimizer() {
  const [sheetW, setSheetW] = useState(1370);
  const [sheetH, setSheetH] = useState(3000);
  const [rows, setRows] = useState<Piece[]>([
    { w: 500, h: 700, qty: 4, label: "A" },
  ]);

  const result = useMemo(() => packSheet(sheetW, sheetH, rows), [sheetW, sheetH, rows]);

  const scale = 400 / Math.max(sheetW, sheetH);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-4 w-4" /> Optimizator otpada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Širina tabaka (mm)</Label>
            <Input type="number" value={sheetW} onChange={(e) => setSheetW(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Visina tabaka (mm)</Label>
            <Input type="number" value={sheetH} onChange={(e) => setSheetH(Number(e.target.value) || 0)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Elementi</div>
          {rows.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_80px_60px_auto] gap-2 items-end">
              <div>
                <Label className="text-xs">Naziv</Label>
                <Input value={p.label ?? ""} onChange={(e) => {
                  const c = [...rows]; c[i] = { ...p, label: e.target.value }; setRows(c);
                }} />
              </div>
              <div>
                <Label className="text-xs">Š</Label>
                <Input type="number" value={p.w} onChange={(e) => {
                  const c = [...rows]; c[i] = { ...p, w: Number(e.target.value) || 0 }; setRows(c);
                }} />
              </div>
              <div>
                <Label className="text-xs">V</Label>
                <Input type="number" value={p.h} onChange={(e) => {
                  const c = [...rows]; c[i] = { ...p, h: Number(e.target.value) || 0 }; setRows(c);
                }} />
              </div>
              <div>
                <Label className="text-xs">Kom</Label>
                <Input type="number" value={p.qty} onChange={(e) => {
                  const c = [...rows]; c[i] = { ...p, qty: Number(e.target.value) || 0 }; setRows(c);
                }} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}>×</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows([...rows, { w: 500, h: 500, qty: 1, label: "" }])}>
            + Dodaj element
          </Button>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <Badge variant="outline">Iskorišćenje: {(result.efficiency * 100).toFixed(1)}%</Badge>
          <Badge variant="outline" className="text-destructive">Otpad: {(result.wastePct * 100).toFixed(1)}%</Badge>
          {result.unplaced > 0 && (
            <Badge variant="destructive">Nije stalo: {result.unplaced}</Badge>
          )}
        </div>

        <div className="border rounded-md bg-muted/20 p-2 overflow-auto">
          <svg width={sheetW * scale} height={sheetH * scale} className="bg-background border">
            {result.placed.map((r, i) => (
              <g key={i}>
                <rect x={r.x * scale} y={r.y * scale} width={r.w * scale} height={r.h * scale}
                      fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth={1} />
                <text x={(r.x + r.w / 2) * scale} y={(r.y + r.h / 2) * scale}
                      textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-[10px]">
                  {r.label || `${r.w}×${r.h}`}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
