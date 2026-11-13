import { FrameCanvas, clamp, lerp, mix } from "../core";
import { camera, lineByDepth } from "./math";
import { useThreeFx } from "./common";
import type { ThreeProps } from "./common";

export type TerrainMeshProps = ThreeProps & {
  rows?: number;
  cols?: number;
  /** Altura de las montañas (unidades; el ancho es 4). */
  relief?: number;
};

/** Altura del terreno en (x, z) del mundo: capas de senos, más calmo en el centro (el "camino"). */
export function terrainHeight(x: number, z: number): number {
  const h =
    Math.sin(x * 0.9 + z * 0.35) * 0.5 +
    Math.sin(x * 1.9 - z * 0.8 + 1.3) * 0.28 +
    Math.sin(x * 0.45 + z * 1.15 + 4.1) * 0.35 +
    Math.sin(x * 3.7 + z * 2.3) * 0.08;
  const calm = clamp(Math.abs(x) / 1.4);
  return (h + 0.7) * (0.25 + 0.75 * calm * calm);
}

/** Vuelo sin fin sobre un terreno de alambre; cada franja se rellena antes de trazarse. */
export function TerrainMesh(p: TerrainMeshProps) {
  const { t, width, height, pal } = useThreeFx(p, { width: 1100, height: 650, duration: 75 });
  const rows = p.rows ?? 34;
  const cols = p.cols ?? 64;
  const relief = p.relief ?? 1;
  return (
    <FrameCanvas
      width={width}
      height={height}
      frame={p.frame}
      style={p.style}
      draw={(ctx) => {
        const unit = height * 0.42;
        const D = 2.6;
        const cam = camera({ distance: D, tilt: 0.2, unit });
        const travel = t * 6; // avance del terreno (unidades)
        const zNear = 1.6, zFar = -7.5;
        const half = 9;
        const groundY = -0.62;
        ctx.translate(width / 2, height * 0.58);
        // Horizonte: disco en acento detras del terreno.
        const hz = cam.project({ x: 0, y: groundY, z: zFar });
        const sunR = height * 0.17;
        ctx.fillStyle = pal.accent;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(0, hz.y - sunR * 0.55, sunR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        // Vertices por fila (fila 0 = la mas cercana).
        const grid: { x: number; y: number; h: number; depth: number }[][] = [];
        for (let r = 0; r <= rows; r++) {
          const z = lerp(zNear, zFar, r / rows);
          const row: { x: number; y: number; h: number; depth: number }[] = [];
          for (let c = 0; c <= cols; c++) {
            const x = lerp(-half, half, c / cols);
            const h = terrainHeight(x, z - travel) * relief;
            const pr = cam.project({ x, y: groundY + h, z });
            row.push({ x: pr.x, y: pr.y, h, depth: pr.depth });
          }
          grid.push(row);
        }
        const far = D - zFar, near = D - zNear;
        // De lejos a cerca: cada franja tapa lo de atras y luego se traza.
        for (let r = rows - 1; r >= 0; r--) {
          const a = grid[r + 1]!, b = grid[r]!; // a = mas lejos, b = mas cerca
          const depth = (a[0]!.depth + b[0]!.depth) / 2;
          const st = lineByDepth(depth, near, far, { minAlpha: 0, maxAlpha: 1, minWidth: 0.7, maxWidth: 2.6 });
          ctx.beginPath();
          ctx.moveTo(a[0]!.x, a[0]!.y);
          for (let c = 1; c <= cols; c++) ctx.lineTo(a[c]!.x, a[c]!.y);
          for (let c = cols; c >= 0; c--) ctx.lineTo(b[c]!.x, b[c]!.y);
          ctx.closePath();
          ctx.fillStyle = pal.bg;
          ctx.fill();
          let hs = 0;
          for (let c = 0; c <= cols; c++) hs += b[c]!.h;
          const col = mix(pal.line, pal.accent, clamp((hs / (cols + 1)) / 0.9));
          ctx.strokeStyle = col;
          ctx.lineWidth = st.width;
          ctx.globalAlpha = st.alpha * (r === rows - 1 ? 0.5 : 1);
          ctx.beginPath();
          ctx.moveTo(b[0]!.x, b[0]!.y);
          for (let c = 1; c <= cols; c++) ctx.lineTo(b[c]!.x, b[c]!.y);
          for (let c = 0; c <= cols; c += 1) {
            ctx.moveTo(a[c]!.x, a[c]!.y);
            ctx.lineTo(b[c]!.x, b[c]!.y);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        // Linea del horizonte.
        ctx.strokeStyle = pal.ink;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-width / 2, grid[rows]![0]!.y);
        ctx.lineTo(width / 2, grid[rows]![0]!.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }}
    />
  );
}
