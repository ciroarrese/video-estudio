import { Easing, FrameCanvas, lerp, sub as subT } from "../core";
import { camera, faceNormal, normalize, rotateAround, shade, sortBackToFront, scale as vscale, add } from "./math";
import type { Vec3 } from "./math";
import { useThreeFx } from "./common";
import type { ThreeProps } from "./common";

export type CubeFoldProps = ThreeProps & { light?: Vec3 };

const sq = (x0: number, z0: number, y = -0.5): Vec3[] => [
  { x: x0, y, z: z0 + 1 }, { x: x0 + 1, y, z: z0 + 1 }, { x: x0 + 1, y, z: z0 }, { x: x0, y, z: z0 },
];

/** Red de cubo en cruz que se pliega hasta cerrar; la tapa va al final. */
export function CubeFold(p: CubeFoldProps) {
  const { t, width, height, pal, k, pen } = useThreeFx(p, { width: 900, height: 900, duration: 75 });
  const light = normalize(p.light ?? { x: -0.4, y: 1, z: 0.8 });
  return (
    <FrameCanvas
      width={width}
      height={height}
      frame={p.frame}
      style={p.style}
      draw={(ctx) => {
        const unit = Math.min(width, height) / lerp(3.8, 2.3, Easing.inOut(subT(t, 0.15, 1)));
        const a = Math.PI / 2;
        // Plegado: lados en secuencia corta, tapa al final.
        const eSide = (i: number) => Easing.inOut(subT(t, 0.1 + i * 0.07, 0.5 + i * 0.07));
        const eLid = Easing.inOut(subT(t, 0.72, 1));
        const yaw = lerp(0.2, 0.75, Easing.out(t));
        const tilt = lerp(1.0, 0.5, Easing.inOut(t));
        const cam = camera({ distance: 8, tilt, yaw, unit });
        ctx.translate(width / 2, height / 2);
        const hinge = (y: number, z: number): Vec3 => ({ x: 0, y, z });
        const faces: { w: Vec3[]; base: string }[] = [];
        faces.push({ w: sq(-0.5, -0.5), base: pen.quiet(pal.line) });
        // +x y -x: giran alrededor de Z.
        faces.push({ w: sq(0.5, -0.5).map((v) => rotateAround(v, { x: 0.5, y: -0.5, z: 0 }, "z", a * eSide(0))), base: pen.quiet(pal.line) });
        faces.push({ w: sq(-1.5, -0.5).map((v) => rotateAround(v, { x: -0.5, y: -0.5, z: 0 }, "z", -a * eSide(1))), base: pen.quiet(pal.line) });
        // +z: giro negativo alrededor de X; -z: positivo, con la tapa colgada de su borde.
        faces.push({ w: sq(-0.5, 0.5).map((v) => rotateAround(v, hinge(-0.5, 0.5), "x", -a * eSide(2))), base: pen.quiet(pal.line) });
        const side = a * eSide(3);
        faces.push({ w: sq(-0.5, -1.5).map((v) => rotateAround(v, hinge(-0.5, -0.5), "x", side)), base: pen.quiet(pal.line) });
        const lid = sq(-0.5, -2.5)
          .map((v) => rotateAround(v, hinge(-0.5, -1.5), "x", a * eLid))
          .map((v) => rotateAround(v, hinge(-0.5, -0.5), "x", side));
        faces.push({ w: lid, base: pal.accent });
        const drawn = faces.map((f) => {
          const n = faceNormal(f.w[0]!, f.w[1]!, f.w[2]!);
          const c = vscale(add(add(f.w[0]!, f.w[1]!), add(f.w[2]!, f.w[3]!)), 0.25);
          const toEye = cam.view(n); // normal en el espacio de la cámara
          const sgn = toEye.z - cam.view({ x: 0, y: 0, z: 0 }).z >= 0 ? 1 : -1; // papel de dos caras
          return { pts: f.w.map((v) => cam.project(v)), depth: cam.project(c).depth, base: f.base, s: shade(vscale(n, sgn), light, 0.3) };
        });
        for (const f of sortBackToFront(drawn, (q) => q.depth)) pen.face(ctx, f.pts, f.base, f.s, 2.5 * k, pal.bg);
      }}
    />
  );
}
