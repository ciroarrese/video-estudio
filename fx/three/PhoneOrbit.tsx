import React from "react";
import { Easing, FrameCanvas, lerp, mix, progress, sub } from "../core";
import { camera, rotateXYZ } from "./math";
import type { Vec3 } from "./math";
import { flush, poly, roundedRect, useThreeFx } from "./common";
import type { Prim, ThreeProps } from "./common";

/** Caja de la pantalla (px) que reciben los hijos y el render prop `screen`. */
export interface PhoneScreenBox { width: number; height: number; frame: number }

export type PhoneOrbitProps = ThreeProps & {
  /** Ángulo inicial de giro (grados); termina de frente. */
  startAngle?: number;
  /** Interfaz recreada para la pantalla. Se la maqueta en una caja de `PhoneScreenBox` px (ocupala entera, con `width: "100%"`/`height: "100%"`). */
  children?: React.ReactNode;
  /** Alternativa a `children`: función del cuadro local y del tamaño de la pantalla. Tiene prioridad sobre `children`. */
  screen?: (box: PhoneScreenBox) => React.ReactNode;
};

// Medidas del teléfono en unidades de mundo.
const W = 0.9, H = 1.8, T = 0.12;
const SCR_INSET_X = 0.06, SCR_INSET_Y = 0.09, SCR_R = 0.1;
const DIST = 7;

/**
 * Teléfono que gira en 3D desde ~56° hasta mirar al espectador, con un anillo de acento en órbita.
 * Sin contenido, la pantalla es una interfaz ficticia hecha de formas dentro del canvas. Con `children` o `screen`,
 * el cuerpo y el anillo van en canvas (el anillo, en dos capas: lo lejano detrás de la pantalla y lo cercano delante)
 * y la pantalla es DOM con su propio `perspective()` y la misma cámara, con la posición de layout en enteros:
 * es determinista bajo `--check` y no usa `preserve-3d` ni perspectiva en un ancestro.
 */
export function PhoneOrbit(p: PhoneOrbitProps) {
  const { local, t, width, height, pal, theme, pen } = useThreeFx(p, { width: 900, height: 900, duration: 75 });
  const start = ((p.startAngle ?? 56) * Math.PI) / 180;
  const unit = Math.min(height * 0.37, width * 0.34);
  const yaw = lerp(start, 0.1, Easing.out(t));
  const tilt = lerp(0.18, 0.04, Easing.out(t));
  const settle = Easing.lands(progress(local, 0, 26));
  const hasScreen = !!(p.screen || p.children);

  const draw = (ctx: CanvasRenderingContext2D, layer: "all" | "back" | "front") => {
    const cam = camera({ distance: DIST, tilt, yaw, unit });
    ctx.translate(width / 2, height / 2);
    pen.caps(ctx, { cap: true, join: true });
    const prims: Prim[] = [];
    const k = Math.max(1, unit / 240); // grosor de trazos con el tamaño del teléfono

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
        poly(c, body, bodyCol, pal.line, 2 * k, 0.9);
        const scr = roundedRect(-W / 2 + SCR_INSET_X, -H / 2 + SCR_INSET_Y, W / 2 - SCR_INSET_X, H / 2 - SCR_INSET_Y, SCR_R, 5).map((pt) => cam.project(front(pt, T / 2 + 0.002)));
        poly(c, scr, pal.surface, null);
        if (!hasScreen) {
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
        }
        // Isla de cámara.
        const isl = roundedRect(-0.1, H / 2 - 0.15, 0.1, H / 2 - 0.1, 0.025, 3).map((pt) => cam.project(front(pt, T / 2 + 0.006)));
        poly(c, isl, bodyCol, null);
      },
    });

    // Anillo en órbita (acento) con una cuenta; sus tramos se ordenan contra el teléfono.
    const N = 90;
    const on = Easing.out(sub(t, 0.05, 0.5));
    const spin = t * Math.PI * 2 * 0.5;
    const RING = 1.2;
    const ringPt = (a: number): Vec3 => rotateXYZ({ x: Math.cos(a) * RING, y: 0, z: Math.sin(a) * RING }, 1.15, 0, -0.45);
    const near = DIST - 1.7, far = DIST + 1.7;
    for (let i = 0; i < N; i++) {
      if (i / N > on) break;
      const A = cam.project(ringPt((i / N) * Math.PI * 2 + spin)), B = cam.project(ringPt(((i + 1) / N) * Math.PI * 2 + spin));
      const d = (A.depth + B.depth) / 2;
      const s = pen.byDepth(d, near, far, { minAlpha: 0.15, maxAlpha: 1, minWidth: 1.5 * k, maxWidth: 5 * k });
      prims.push({ depth: d, draw: (c) => pen.seg(c, A.x, A.y, B.x, B.y, pal.accent, s.alpha, s.width, { i }) });
    }
    const bead = cam.project(ringPt(spin * 2 + 0.6));
    const bs = pen.byDepth(bead.depth, near, far, { minAlpha: 0.6, maxAlpha: 1, minWidth: 6 * k, maxWidth: 12 * k });
    prims.push({ depth: bead.depth, draw: (c) => pen.dot(c, bead.x, bead.y, bs.width * on, pal.ink) });
    // Con pantalla DOM: lo lejano (y el cuerpo) detrás, lo cercano delante.
    const chosen = layer === "all" ? prims : prims.filter((q) => (layer === "back" ? q.depth >= phoneDepth : q.depth < phoneDepth));
    flush(ctx, chosen);
  };

  if (!hasScreen) {
    return <FrameCanvas width={width} height={height} frame={p.frame} style={p.style} draw={(ctx) => draw(ctx, "all")} />;
  }

  // Pantalla DOM: misma cámara que el canvas (perspectiva = distancia * unidad; X invertido por el eje Y hacia abajo del CSS).
  const sw = Math.round((W - 2 * SCR_INSET_X) * unit), sh = Math.round((H - 2 * SCR_INSET_Y) * unit);
  const left = Math.round(width / 2 - sw / 2), top = Math.round(height / 2 - sh / 2);
  const zpx = (T / 2 + 0.003) * unit;
  const content = p.screen ? p.screen({ width: sw, height: sh, frame: local }) : p.children;
  const show = Math.min(1, Math.max(0, (settle - 0.5) * 2));
  return (
    <div style={{ position: "relative", width, height, ...p.style }}>
      <FrameCanvas width={width} height={height} frame={p.frame} style={{ position: "absolute", left: 0, top: 0 }} draw={(ctx) => draw(ctx, "back")} />
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: sw,
          height: sh,
          boxSizing: "border-box",
          overflow: "hidden",
          borderRadius: Math.round(SCR_R * unit * 0.9),
          background: theme.color.surface,
          fontFamily: theme.font.family,
          opacity: show,
          transformOrigin: "50% 50%",
          transform: `perspective(${Math.round(DIST * unit)}px) rotateX(${(-tilt).toFixed(5)}rad) rotateY(${yaw.toFixed(5)}rad) translateZ(${(zpx * settle).toFixed(2)}px) scale(${settle.toFixed(4)})`,
        }}
      >
        {content}
      </div>
      {/* Capa delantera del anillo: transparente, no tapa el texto de la pantalla (se lo avisa a `qa`). */}
      <div data-qa-ignore="covered overlap" style={{ position: "absolute", left: 0, top: 0, width, height, pointerEvents: "none" }}>
        <FrameCanvas width={width} height={height} frame={p.frame} draw={(ctx) => draw(ctx, "front")} />
      </div>
    </div>
  );
}
