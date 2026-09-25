"use client";

import * as React from "react";
import { Eraser } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SignaturePadProps = {
  /** Called with a PNG data URL after each stroke, or null when cleared. */
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  className?: string;
};

const INK = "#111827";
const HEIGHT = 180;

/**
 * Exports only the inked area (plus a small margin) as PNG, so the signature fills its
 * space on the PDF and in the dashboard instead of sitting in a wide empty canvas.
 */
function exportTrimmed(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return canvas.toDataURL("image/png");
  const pad = Math.round(8 * (width / canvas.getBoundingClientRect().width || 1));
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(width, maxX + pad + 1) - sx;
  const sh = Math.min(height, maxY + pad + 1) - sy;
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  out.getContext("2d")?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL("image/png");
}

/**
 * Draw-to-sign canvas. Always white with dark ink (independent of theme) so the saved
 * image looks the same on screen, in the dashboard and in the PDF copy.
 */
export function SignaturePad({ onChange, disabled, className }: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const points = React.useRef<{ x: number; y: number }[]>([]);
  const [hasInk, setHasInk] = React.useState(false);

  // Size the backing store to the rendered width × devicePixelRatio for crisp lines.
  const resize = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.getBoundingClientRect().width;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(HEIGHT * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    // Resizing wipes the canvas, so any existing signature is cleared with it.
    setHasInk(false);
    onChange(null);
  }, [onChange]);

  React.useEffect(() => {
    resize();
    let lastWidth = canvasRef.current?.getBoundingClientRect().width ?? 0;
    const observer = new ResizeObserver(() => {
      const width = canvasRef.current?.getBoundingClientRect().width ?? 0;
      // Ignore height-only changes (e.g. mobile address bar) so a signature isn't lost.
      if (Math.abs(width - lastWidth) > 1) {
        lastWidth = width;
        resize();
      }
    });
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once; resize is stable enough
  }, []);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pointFrom(e);
    points.current = [p];
    const ctx = e.currentTarget.getContext("2d");
    if (ctx) {
      // A dot, so a single tap still leaves a mark.
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = pointFrom(e);
    const pts = points.current;
    pts.push(p);
    if (pts.length < 3) return;
    // Smooth the stroke with a quadratic curve through the midpoints.
    const [a, b, c] = pts.slice(-3);
    ctx.beginPath();
    ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
    ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
    ctx.stroke();
  };

  const finishStroke = () => {
    if (!drawing.current) return;
    drawing.current = false;
    points.current = [];
    setHasInk(true);
    const canvas = canvasRef.current;
    if (canvas) onChange(exportTrimmed(canvas));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-border bg-white">
        <canvas
          ref={canvasRef}
          aria-label="Signature pad. Draw your signature with a mouse, finger or stylus."
          role="img"
          className={cn("block w-full touch-none", disabled ? "cursor-not-allowed" : "cursor-crosshair")}
          style={{ height: HEIGHT }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onPointerLeave={finishStroke}
        />
        {!hasInk ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
            Sign here
          </span>
        ) : null}
        <div className="pointer-events-none absolute bottom-10 left-6 right-6 border-b border-zinc-300" />
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={disabled || !hasInk}>
          <Eraser className="h-4 w-4 mr-1" /> Clear
        </Button>
      </div>
    </div>
  );
}
