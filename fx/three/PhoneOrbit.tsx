import { Easing, FrameCanvas, lerp, mix, progress, sub } from "../core";
import { camera, lineByDepth, rotateXYZ } from "./math";
import type { Vec3 } from "./math";
import { dot, flush, poly, roundedRect, seg, useThreeFx } from "./common";
import type { Prim, ThreeProps } from "./common";

export type PhoneOrbitProps = ThreeProps & {
  /** Ángulo inicial de giro (grados); termina de frente. */
  startAngle?: number;
};

/**
 * Teléfono simple que gira en 3D desde ~56° hasta mirar al espectador, con un anillo de acento en órbita.
 * La pantalla se dibuja en el canvas como una interfaz ficticia hecha de formas (sin texto): así el cuadro
 * es determinista bajo `--check` y no depende de transformaciones 3D de CSS.
 */
export function PhoneOrbit(p: PhoneOrbitProps) {
  const { local, t, width, height, pal } = useThreeFx(p, { width: 900, height: 900, duration: 75 });
  const start = ((p.startAngle ?? 56) * Math.PI) / 180;
  return (
    <FrameCanvas
      width={width}
      height={height}
      frame={p.frame}
      style={p.style}
      draw={(ctx) => {
        const W = 0.9, H = 1.8, T = 0.12;
        const unit = Math.min(height * 0.3, width * 0.4);
        const D = 7;
        const yaw = lerp(start, 0.1, Easing.out(t));
        const cam = camera({ distance: D, tilt: lerp(0.18, 0.04, Easing.out(t)), yaw, unit });
        ctx.translate(width / 2, height / 2);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const settle = Easing.lands(progress(local, 0, 26));
        const prims: Prim[] = [];

        const outline = roundedRect(-W / 2, -H / 2, W / 2, H / 2, 0.16, 6);
        const front = (pt: { x: number; y: number }, z = T / 2): Vec3 => ({ x: pt.x * settle, y: pt.y * settle, z: z * settle });
        const bodyCol = mix(pal.darkest, pal.line, 0.22);
        const phoneDepth = cam.project({ x: 0, y: 0, z: 0 }).depth;
        prims.push({
          depth: phoneDepth,
          draw: (c) => {
            // Caras laterales visibles (normal hacia el espectador), de atrás hacia adelante.
            const sides: { pts: { x: number; y: number }[]; depth: number; shade: number }[] = [];
            const m = outline.length;
            for (let i = 0; i < m; i++) {
              const a = outline[i]!, b = outline[(i + 1) % m]!;
              const nx = b.y - a.y, ny = -(b.x - a.x); // normal hacia afuera (antihorario)
              const nv = cam.view({ x: nx, y: ny, z: 0 });
              if (nv.z <= 0) continue;
              const q = [front(a), front(b), front(b, -T / 2), front(a, -T / 2)].map((v) => cam.project(v));
              sides.push({ pts: q, depth: (q[0]!.depth + q[2]!.depth) / 2, shade: 0.3 + 0.5 * (nv.z / Math.hypot(nx, ny)) });
            }
            sides.sort((x, y) => y.depth - x.depth);
            for (const s of sides) poly(c, s.pts, mix(bodyCol, pal.lightest, s.shade * 0.25), null);
            // Frente.
            const body = outline.map((pt) => cam.project(front(pt)));
            poly(c, body, bodyCol, pal.line, 2, 0.9);
            const scr = roundedRect(-W / 2 + 0.06, -H / 2 + 0.09, W / 2 - 0.06, H / 2 - 0.09, 0.1, 5).map((pt) => cam.project(front(pt, T / 2 + 0.002)));
            poly(c, scr, pal.surface, null);
            // Interfaz ficticia: encabezado, tarjeta destacada, filas y barra inferior.
            const rect = (x0: number, y0: number, x1: number, y1: number, col: string, r = 0.03, a = 1) => {
              const pts = roundedRect(x0, y0, x1, y1, r, 3).map((pt) => cam.project(front(pt, T / 2 + 0.004)));
              c.globalAlpha = a;
              poly(c, pts, col, null);
              c.globalAlpha = 1;
            };
            const sx0 = -W / 2 + 0.14, sx1 = W / 2 - 0.14;
            rect(sx0, 0.72, sx0 + 0.34, 0.78, pal.ink, 0.03, 0.85);
            rect(sx1 - 0.12, 0.7, sx1, 0.8, pal.accent2, 0.05);
            rect(sx0, 0.12, sx1, 0.6, pal.accent, 0.07);
            rect(sx0 + 0.08, 0.4, sx0 + 0.42, 0.46, pal.lightest, 0.03, 0.9);
            rect(sx0 + 0.08, 0.26, sx0 + 0.3, 0.3, pal.lightest, 0.02, 0.6);
            for (let r = 0; r < 3; r++) {
              const y = -0.06 - r * 0.3;
              rect(sx0, y - 0.1, sx0 + 0.2, y + 0.1, pal.line, 0.1, 0.45);
              rect(sx0 + 0.28, y + 0.02, sx1 - 0.1, y + 0.08, pal.ink, 0.03, 0.7);
              rect(sx0 + 0.28, y - 0.1, sx0 + 0.28 + (sx1 - sx0 - 0.4) * 0.55, y - 0.05, pal.line, 0.03, 0.5);
            }
            rect(-0.1, -H / 2 + 0.14, 0.1, -H / 2 + 0.17, pal.ink, 0.015, 0.5);
            // Isla de cámara.
            const isl = roundedRect(-0.1, H / 2 - 0.15, 0.1, H / 2 - 0.1, 0.025, 3).map((pt) => cam.project(front(pt, T / 2 + 0.006)));
            poly(c, isl, bodyCol, null);
          },
        });

        // Anillo en órbita (acento) con una cuenta; sus tramos se ordenan contra el teléfono.
        const N = 90;
        const on = Easing.out(sub(t, 0.05, 0.5));
        const spin = t * Math.PI * 2 * 0.5;
        const ringPt = (a: number): Vec3 => rotateXYZ({ x: Math.cos(a) * 1.5, y: 0, z: Math.sin(a) * 1.5 }, 1.15, 0, -0.45);
        const near = D - 1.7, far = D + 1.7;
        for (let i = 0; i < N; i++) {
          if (i / N > on) break;
          const A = cam.project(ringPt((i / N) * Math.PI * 2 + spin)), B = cam.project(ringPt(((i + 1) / N) * Math.PI * 2 + spin));
          const d = (A.depth + B.depth) / 2;
          const s = lineByDepth(d, near, far, { minAlpha: 0.15, maxAlpha: 1, minWidth: 1.5, maxWidth: 5 });
          prims.push({ depth: d, draw: (c) => seg(c, A.x, A.y, B.x, B.y, pal.accent, s.alpha, s.width) });
        }
        const bead = cam.project(ringPt(spin * 2 + 0.6));
        const bs = lineByDepth(bead.depth, near, far, { minAlpha: 0.6, maxAlpha: 1, minWidth: 6, maxWidth: 12 });
        prims.push({ depth: bead.depth, draw: (c) => dot(c, bead.x, bead.y, bs.width * on, pal.ink) });
        flush(ctx, prims);
      }}
    />
  );
}
