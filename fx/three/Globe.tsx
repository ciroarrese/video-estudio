import { Easing, FrameCanvas, clamp, lerp, progress, sub } from "../core";
import { camera, depthFade, greatCircle, latLon, lineByDepth } from "./math";
import type { Vec3 } from "./math";
import { dot, seg, useThreeFx } from "./common";
import type { ThreeProps } from "./common";

export interface GlobeCity { lat: number; lon: number }
export type GlobeProps = ThreeProps & {
  /** Ciudades (grados). Por defecto un conjunto repartido. */
  cities?: GlobeCity[];
  /** Rutas como pares de índices en `cities`. */
  routes?: [number, number][];
  /** Longitud (grados) que queda al centro al final. */
  centerLon?: number;
};

const CITIES: GlobeCity[] = [
  { lat: -34.6, lon: -58.4 }, { lat: 40.7, lon: -74 }, { lat: 51.5, lon: -0.1 }, { lat: 28.6, lon: 77.2 },
  { lat: 35.7, lon: 139.7 }, { lat: -33.9, lon: 151.2 }, { lat: -1.3, lon: 36.8 }, { lat: 19.4, lon: -99.1 },
];
const ROUTES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 6], [7, 0]];

/** Esfera de alambre con ciudades y rutas (círculos máximos) que se dibujan de a una. */
export function Globe(p: GlobeProps) {
  const { local, t, width, height, pal, k } = useThreeFx(p, { width: 900, height: 900, duration: 75 });
  const cities = p.cities ?? CITIES;
  const routes = p.routes ?? ROUTES;
  const centerLon = p.centerLon ?? -40;
  return (
    <FrameCanvas
      width={width}
      height={height}
      frame={p.frame}
      style={p.style}
      draw={(ctx) => {
        const R = Math.min(width, height) * 0.42;
        const settle = lerp(0.88, 1, Easing.lands(progress(local, 0, 28)));
        // Giro lento: termina con `centerLon` al centro.
        const yaw = -((centerLon - 70 * (1 - t)) * Math.PI) / 180;
        const cam = camera({ distance: 3.4, tilt: 0.38, yaw, unit: R * settle });
        ctx.translate(width / 2, height / 2);
        ctx.lineCap = "round";
        const near = 2.4, far = 4.4;
        const style = (d: number) => lineByDepth(d, near, far, { minAlpha: 0.12, maxAlpha: 0.9, minWidth: 0.8 * k, maxWidth: 1.8 * k });

        // Lineas: latitudes y meridianos; primero las de atras, luego el disco que las tapa, luego las de frente.
        const lines: Vec3[][] = [];
        for (let lat = -60; lat <= 60; lat += 20) {
          const l: Vec3[] = [];
          for (let k = 0; k <= 72; k++) l.push(latLon(lat, (k / 72) * 360 - 180));
          lines.push(l);
        }
        for (let lon = 0; lon < 360; lon += 20) {
          const l: Vec3[] = [];
          for (let k = 0; k <= 36; k++) l.push(latLon(-90 + (k / 36) * 180, lon));
          lines.push(l);
        }
        const proj = lines.map((l) => l.map((q) => ({ ...cam.project(q), z: cam.view(q).z })));
        const drawLines = (front: boolean) => {
          for (const l of proj) {
            for (let i = 0; i < l.length - 1; i++) {
              const a = l[i]!, b = l[i + 1]!;
              const isFront = (a.z + b.z) / 2 >= 0;
              if (isFront !== front) continue;
              const st = style((a.depth + b.depth) / 2);
              seg(ctx, a.x, a.y, b.x, b.y, pal.line, front ? st.alpha : st.alpha * 0.4, front ? st.width : 0.8 * k);
            }
          }
        };
        drawLines(false);
        // Disco: tapa lo de atras (silueta de la esfera en perspectiva).
        const rr = (R * settle * 3.4) / Math.sqrt(3.4 * 3.4 - 1); // silueta en perspectiva
        ctx.globalAlpha = 0.78;
        ctx.fillStyle = pal.bg;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        drawLines(true);
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 2 * k;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Rutas.
        const visible = (q: Vec3) => {
          const v = cam.view(q);
          return v.z > 0 || Math.hypot(v.x, v.y) > 1.02;
        };
        routes.forEach(([ia, ib], i) => {
          const a = cities[ia], b = cities[ib];
          if (!a || !b) return;
          const start = 14 + i * 6;
          const k = progress(local, start, 32, Easing.inOut);
          if (k <= 0) return;
          const pts = greatCircle(a.lat, a.lon, b.lat, b.lon, 56, 0.16);
          const upto = Math.floor(k * (pts.length - 1));
          for (let j = 0; j < upto; j++) {
            const q0 = pts[j]!, q1 = pts[j + 1]!;
            if (!visible(q0) || !visible(q1)) continue;
            const a0 = cam.project(q0), a1 = cam.project(q1);
            const st = style((a0.depth + a1.depth) / 2);
            seg(ctx, a0.x, a0.y, a1.x, a1.y, pal.accent, 0.35 + 0.65 * depthFade((a0.depth + a1.depth) / 2, near, far), st.width + k);
          }
          if (k < 1 && upto >= 1) {
            const q = pts[upto]!;
            if (visible(q)) { const s = cam.project(q); dot(ctx, s.x, s.y, 4 * k * s.scale, pal.accent); }
          }
        });

        // Ciudades.
        cities.forEach((c, i) => {
          const q = latLon(c.lat, c.lon);
          const v = cam.view(q);
          if (v.z < 0.02) return;
          const s = cam.project(q);
          const a = clamp(sub(t, 0.04 + i * 0.03, 0.2 + i * 0.03));
          if (a <= 0) return;
          const r = 5 * k * s.scale * Easing.lands(a);
          dot(ctx, s.x, s.y, r + 4 * k * s.scale, pal.accent, 0.25);
          dot(ctx, s.x, s.y, r, pal.ink);
        });
      }}
    />
  );
}
