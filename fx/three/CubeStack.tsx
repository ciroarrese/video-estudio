import { Easing, FrameCanvas, lerp, progress, random } from "../core";
import { camera, faceNormal, normalize, rotateXYZ, shade, sortBackToFront, sub, add, scale as vscale, dot as vdot } from "./math";
import type { Vec3 } from "./math";
import { useThreeFx } from "./common";
import type { ThreeProps } from "./common";

export type CubeStackProps = ThreeProps & {
  /** Dirección hacia la luz (se normaliza). */
  light?: Vec3;
};

// Caras de un cubo unitario centrado: cuatro vértices en sentido antihorario visto desde afuera.
const FACES: Vec3[][] = (() => {
  const h = 0.5;
  const f = (a: number[], b: number[], c: number[], d: number[]): Vec3[] => [a, b, c, d].map(([x, y, z]) => ({ x: x!, y: y!, z: z! }));
  return [
    f([h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]), // +x
    f([-h, -h, h], [-h, h, h], [-h, h, -h], [-h, -h, -h]), // -x
    f([-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h]), // +y
    f([-h, -h, h], [-h, -h, -h], [h, -h, -h], [h, -h, h]), // -y
    f([-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]), // +z
    f([h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h]), // -z
  ];
})();

/** 27 cubos que llegan desde lejos y forman un cubo de 3x3x3, con sombreado plano. */
export function CubeStack(p: CubeStackProps) {
  const { t, width, height, pal, k, pen } = useThreeFx(p, { width: 900, height: 900, duration: 75 });
  const seed = p.seed ?? "cubestack";
  const light = normalize(p.light ?? { x: -0.5, y: 0.9, z: 0.7 });
  return (
    <FrameCanvas
      width={width}
      height={height}
      frame={p.frame}
      style={p.style}
      draw={(ctx) => {
        const unit = Math.min(width, height) / 5.9;
        const yaw = lerp(-1.0, 0.62, Easing.out(t));
        const cam = camera({ distance: 9, tilt: 0.5, yaw, unit });
        ctx.translate(width / 2, height / 2);
        const faces: { pts: { x: number; y: number }[]; depth: number; base: string; s: number }[] = [];
        let idx = 0;
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++, idx++) {
          const home: Vec3 = { x: i * 1.04, y: j * 1.04, z: k * 1.04 };
          const dir = normalize({ x: random(`${seed}:x${idx}`) - 0.5, y: random(`${seed}:y${idx}`) - 0.5, z: random(`${seed}:z${idx}`) - 0.5 });
          const delay = random(`${seed}:d${idx}`) * 0.35;
          const e = Easing.out(progress(t, delay * 0.8, 0.6));
          const far = 1 - e;
          const pos = add(home, vscale(dir, far * 7));
          const spin = far * (2 + 3 * random(`${seed}:s${idx}`));
          const accentCube = idx === 13 || random(`${seed}:c${idx}`) < pen.share(0.12);
          const base = accentCube ? pal.accent : pen.quiet(pal.line);
          for (const f of FACES) {
            const w = f.map((v) => add(rotateXYZ(v, spin, spin * 0.7), pos)); // mundo
            const n = faceNormal(w[0]!, w[1]!, w[2]!);
            const center = vscale(add(add(w[0]!, w[1]!), add(w[2]!, w[3]!)), 0.25);
            const view = cam.view(center);
            const nv = cam.view(add(center, n));
            const facing = vdot(sub(nv, view), sub({ x: 0, y: 0, z: cam.distance }, view)) > 0;
            if (!facing) continue;
            const pr = w.map((v) => cam.project(v));
            faces.push({ pts: pr, depth: cam.project(center).depth, base, s: shade(n, light, 0.25) });
          }
        }
        for (const f of sortBackToFront(faces, (q) => q.depth)) pen.face(ctx, f.pts, f.base, f.s, 2 * k, pal.bg);
      }}
    />
  );
}
