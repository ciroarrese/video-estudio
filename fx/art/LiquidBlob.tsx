import { useTheme, parseColor } from "../../themes";
import { Easing, FrameCanvas } from "../../engine";
import { fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";

export type LiquidBlobProps = FxProps & { balls?: number; /** Reduccion de resolucion del campo (por defecto 6). */ cell?: number };

export type Ball = { x: number; y: number; r: number; k: number };

/** Posicion de las bolas en el progreso `t` (0..1): empiezan separadas, orbitan y quedan fundidas en un cumulo fijo. */
export function ballPositions(n: number, w: number, h: number, t: number, seed: string | number = "blob"): Ball[] {
  const e = Easing.inOut(t);
  const base = Math.min(w, h);
  return Array.from({ length: n }, (_, i) => {
    const a0 = (i / n) * Math.PI * 2;
    const orbit = base * (0.36 * (1 - e) + 0.1 + 0.05 * ((i * 7 + String(seed).length) % 3));
    const ang = a0 + e * Math.PI * 2 * (i % 2 === 0 ? 1 : -1) * 1.0;
    const r = base * (0.1 + 0.025 * (i % 3));
    return { x: w / 2 + Math.cos(ang) * orbit * (i % 2 ? 1 : 1.25), y: h / 2 + Math.sin(ang) * orbit * 0.9, r, k: i % 2 };
  });
}

/** Metabolas que se funden. El campo se calcula a baja resolucion en canvas y se amplia (dibujo < 8 ms). */
export function LiquidBlob(p: LiquidBlobProps) {
  const { local } = useFx(p);
  const theme = useTheme();
  const { width: w, height: h } = fxBox(p, { width: 900, height: 560 });
  const dur = p.duration ?? 80;
  const cell = p.cell ?? 6;
  const n = p.balls ?? 6;
  const t = progress(local, 0, dur);
  const A = parseColor(theme.color.accent) ?? { r: 59, g: 91, b: 219, a: 1 };
  const B = parseColor(theme.color.accent2) ?? { r: 112, g: 72, b: 232, a: 1 };
  const draw = (ctx: CanvasRenderingContext2D) => {
    const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
    const off = document.createElement("canvas");
    off.width = gw; off.height = gh;
    const octx = off.getContext("2d");
    if (!octx) return;
    const img = octx.createImageData(gw, gh);
    const balls = ballPositions(n, w, h, t, p.seed ?? "blob").map((b) => ({ x: b.x / cell, y: b.y / cell, r2: (b.r / cell) ** 2, k: b.k }));
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let f = 0, fb = 0;
        for (const b of balls) {
          const d2 = (x - b.x) ** 2 + (y - b.y) ** 2 + 0.5;
          const v = b.r2 / d2;
          f += v;
          if (b.k) fb += v;
        }
        const i = (y * gw + x) * 4;
        const a = Math.min(1, Math.max(0, (f - 1) / 0.12));
        const m = f > 0 ? fb / f : 0;
        const shade = 1 - Math.min(0.08, Math.max(0, (f - 1) * 0.03));
        img.data[i] = (A.r + (B.r - A.r) * m) * shade;
        img.data[i + 1] = (A.g + (B.g - A.g) * m) * shade;
        img.data[i + 2] = (A.b + (B.b - A.b) * m) * shade;
        img.data[i + 3] = a * 255;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, gw * cell, gh * cell);
  };
  return <FrameCanvas width={w} height={h} draw={draw} frame={local} style={p.style} />;
}
