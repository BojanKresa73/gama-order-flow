import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

// pdfjs-dist v4 ships an ES worker; Vite handles ?url import for it.
// eslint-disable-next-line import/no-unresolved
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface Props {
  /** PDF bytes; component owns rendering (no iframe/object). */
  bytes: Uint8Array | null;
}

export function PdfPreview({ bytes }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Clone into a fresh buffer — pdf.js transfers/detaches the input.
        const data = bytes.slice(0);
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        const containerWidth = container.clientWidth || 600;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = (containerWidth - 8) / baseViewport.width;
          const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${(viewport.width) / (window.devicePixelRatio || 1)}px`;
          canvas.style.height = `${(viewport.height) / (window.devicePixelRatio || 1)}px`;
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 12px";
          canvas.style.boxShadow = "0 1px 4px rgba(0,0,0,0.15)";
          canvas.style.background = "#fff";
          container.appendChild(canvas);

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Greška pri renderu");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bytes]);

  return (
    <div className="relative w-full h-full overflow-auto bg-muted/30 p-2">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="p-4 text-sm text-destructive">Ne mogu da prikažem PDF: {error}</div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
