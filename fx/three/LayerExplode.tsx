import { Easing, FrameCanvas, lerp, progress, sub } from "../core";
import { isometric } from "./math";
import { textStyle } from "../../themes";
import { poly, seg, shadeColor, stepDelay, useThreeFx } from "./common";
import type { ThreeProps } from "./common";

export type LayerExplodeProps = ThreeProps & {
  /** Rótulos de las capas, de abajo hacia arriba. */
  labels?: string[];
};

const LABELS = ["Infraestructura", "Datos", "Lógica", "Interfaz"];

/** Una tarjeta isométrica que se separa en capas rotuladas, unidas por conectores de esquina punteados. */
export function LayerExplode(p: LayerExplodeProps) {
  const { t, local, duration, width, height, theme, pal, k } = useThreeFx(p, { width: 1300, height: 800, duration: 75 });
  const labels = p.labels ?? LABELS;
  const n = labels.length;
  const S = 3; // lado de la tarjeta (unidades)
  const thick = 0.14;
  const gap = 1.05;
  const unit = Math.min((width * 0.44) / (S * 1.732), (height * 0.97) / (S + (n - 1) * gap + 1.2));
  const cx = width * 0.36;
  const cy = height * 0.5 + (((n - 1) * gap) / 2) * unit * 0.5;
  const e = Easing.inOut(sub(t, 0.08, 0.7));
  const yOf = (i: number) => i * gap * e;
  const labelPos = (i: number) => {
    const q = isometric({ x: S / 2, y: yOf(i) + thick, z: -S / 2 }, unit);
    return { x: cx + q.x, y: cy + q.y };
  };
  return (
    <div style={{ position: "relative", width, height, ...p.style }}>
      <FrameCanvas
        width={width}
        height={height}
        frame={p.frame}
        draw={(ctx) => {
          ctx.translate(cx, cy);
          ctx.lineCap = "round";
          // Esquinas: 0 atrás, 1 derecha, 2 frente, 3 izquierda.
          const corner = (k: number, y: number) => {
            const px = k === 0 ? [-1, -1] : k === 1 ? [1, -1] : k === 2 ? [1, 1] : [-1, 1];
            return isometric({ x: (px[0]! * S) / 2, y, z: (px[1]! * S) / 2 }, unit);
          };
          const connectors = (ks: number[]) => {
            if (e <= 0.02) return;
            ctx.setLineDash([7 * k, 7 * k]);
            for (let i = 0; i < n - 1; i++) {
              for (const k of ks) {
                const a = corner(k, yOf(i) + thick), b = corner(k, yOf(i + 1));
                seg(ctx, a.x, a.y, b.x, b.y, pal.ink, 0.55 * Math.min(1, e * 3), 1.5 * k);
              }
            }
            ctx.setLineDash([]);
          };
          connectors([0]);
          for (let i = 0; i < n; i++) {
            const y0 = yOf(i), y1 = y0 + thick;
            const top = [0, 1, 2, 3].map((k) => corner(k, y1));
            const bot = [0, 1, 2, 3].map((k) => corner(k, y0));
            const isTop = i === n - 1;
            const base = isTop ? pal.accent : i % 2 ? pal.line : pal.surface;
            // Caras laterales visibles: la izquierda (3-2) y la derecha (2-1).
            poly(ctx, [top[3]!, top[2]!, bot[2]!, bot[3]!], shadeColor(base, 0.45, pal), pal.ink, 1.2 * k, 0.5);
            poly(ctx, [top[2]!, top[1]!, bot[1]!, bot[2]!], shadeColor(base, 0.25, pal), pal.ink, 1.2 * k, 0.5);
            poly(ctx, top, isTop ? shadeColor(base, 0.85, pal) : base, pal.ink, 1.8 * k, 0.85);
            // Contenido ficticio en la cara superior: barras isométricas.
            const bar = (x0: number, z0: number, x1: number, z1: number, col: string) => {
              const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => isometric({ x: x!, y: y1, z: z! }, unit));
              poly(ctx, pts, col, null);
            };
            const barCol = isTop ? pal.bg : pal.line;
            bar(-1.1, -1.1, 1.1, -0.7, barCol);
            bar(-1.1, -0.35, 0.3, 0.05, barCol);
            bar(-1.1, 0.4, 1.1, 1.1, isTop ? pal.accent2 : pal.bg);
          }
          connectors([1, 2, 3]);
          // Lineas guia a los rotulos.
          for (let i = 0; i < n; i++) {
            const a = progress(local, 30 + stepDelay(theme, i, n, 6, duration - 30 - 14 - 6), 14, Easing.out);
            if (a <= 0) continue;
            const q = labelPos(i);
            const x0 = q.x - cx + 10 * k, y0 = q.y - cy;
            seg(ctx, x0, y0, x0 + 70 * k * a, y0, pal.ink, 0.8, 1.5 * k);
          }
        }}
      />
      {labels.map((txt, i) => {
        const a = progress(local, 38 + stepDelay(theme, i, n, 6, duration - 38 - 14), 14, Easing.out);
        const q = labelPos(i);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: q.x + Math.round(92 * k),
              top: q.y,
              transform: `translate(${Math.round(lerp(-12, 0, a))}px, -50%)`,
              opacity: a,
              whiteSpace: "nowrap",
              fontFamily: theme.font.family,
              fontSize: theme.type.body,
              ...textStyle(theme, "title"),
              color: i === n - 1 ? pal.accent : pal.ink,
            }}
          >
            {txt}
          </div>
        );
      })}
    </div>
  );
}
