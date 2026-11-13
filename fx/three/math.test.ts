import { describe, expect, it } from "vitest";
import {
  camera, cross, rotateAround, depthFade, deg, faceNormal, fibonacciSphere, greatCircle, isometric, latLon, length, lineByDepth,
  normalize, rotateX, rotateY, rotateZ, shade, sortBackToFront,
} from "./math";

const close = (a: number, b: number, d = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(d);

describe("rotaciones", () => {
  it("giran según la mano derecha", () => {
    const y = rotateY({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    close(y.x, 0); close(y.z, -1);
    const x = rotateX({ x: 0, y: 1, z: 0 }, Math.PI / 2);
    close(x.y, 0); close(x.z, 1);
    const z = rotateZ({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    close(z.x, 0); close(z.y, 1);
  });
  it("conservan la longitud", () => {
    const p = rotateZ(rotateY(rotateX({ x: 1, y: 2, z: 3 }, 0.7), 1.1), -0.4);
    close(length(p), Math.sqrt(14));
  });
});

describe("cámara", () => {
  it("proyecta con perspectiva (valores a mano)", () => {
    const cam = camera({ distance: 4 });
    const p = cam.project({ x: 1, y: 1, z: 2 }); // profundidad 2, escala 2
    close(p.depth, 2); close(p.scale, 2); close(p.x, 2); close(p.y, -2);
    const q = cam.project({ x: 1, y: 0, z: -4 }); // profundidad 8, escala 0.5
    close(q.scale, 0.5); close(q.x, 0.5);
  });
  it("el origen cae en el centro y unit escala", () => {
    const c = camera({ distance: 5, unit: 100 }).project({ x: 0, y: 0, z: 0 });
    close(c.x, 0); close(c.y, 0); close(c.scale, 1);
    close(camera({ distance: 5, unit: 100 }).project({ x: 1, y: 0, z: 0 }).x, 100);
  });
  it("fov: el extent llena media altura en el origen", () => {
    const cam = camera({ fov: 60, extent: 1 });
    close(cam.distance, 1 / Math.tan(deg(30)));
  });
  it("yaw 90 lleva +x al fondo", () => {
    const cam = camera({ distance: 4, yaw: Math.PI / 2 });
    const p = cam.project({ x: 1, y: 0, z: 0 });
    close(p.x, 0); close(p.depth, 5);
  });
  it("tilt positivo mira desde arriba: lo que está adelante en el suelo baja en pantalla", () => {
    const cam = camera({ distance: 4, tilt: 0.5 });
    const p = cam.project({ x: 0, y: 0, z: 1 }); // y' = -sin(.5), z' = cos(.5)
    close(p.y, Math.sin(0.5) * (4 / (4 - Math.cos(0.5))));
  });
});

describe("orden y sombreado", () => {
  it("ordena de atrás hacia adelante y es estable", () => {
    const items = [{ id: "a", d: 1 }, { id: "b", d: 5 }, { id: "c", d: 3 }, { id: "d", d: 3 }];
    const s = sortBackToFront(items, (i) => i.d).map((i) => i.id);
    expect(s).toEqual(["b", "c", "d", "a"]);
    expect(items[0]!.id).toBe("a");
  });
  it("normal de un triángulo y rango de shade", () => {
    const n = faceNormal({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    close(n.z, 1);
    close(shade(n, { x: 0, y: 0, z: 5 }), 1);
    close(shade(n, { x: 0, y: 0, z: -1 }, 0.3), 0.3);
    close(shade(n, { x: 1, y: 0, z: 1 }, 0), Math.SQRT1_2);
    for (let i = 0; i < 50; i++) {
      const s = shade({ x: Math.sin(i), y: Math.cos(i * 2), z: Math.sin(i * 3) }, { x: 1, y: 2, z: 3 });
      expect(s).toBeGreaterThanOrEqual(0.3 - 1e-12); expect(s).toBeLessThanOrEqual(1);
    }
  });
  it("cross y normalize", () => {
    const c = cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    expect(c).toEqual({ x: 0, y: 0, z: 1 });
    close(length(normalize({ x: 3, y: 4, z: 12 })), 1);
  });
});

describe("círculo máximo", () => {
  it("extremos en la superficie y punto medio elevado", () => {
    const pts = greatCircle(10, 20, -30, 120, 40, 0.3);
    expect(pts).toHaveLength(41);
    const a = latLon(10, 20), b = latLon(-30, 120);
    close(pts[0]!.x, a.x); close(pts[0]!.y, a.y); close(pts[0]!.z, a.z);
    close(pts[40]!.x, b.x); close(pts[40]!.z, b.z);
    close(length(pts[20]!), 1.3);
    // el punto medio está en el plano de ambos extremos, a mitad de ángulo
    const mid = normalize(pts[20]!);
    const expected = normalize({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
    close(mid.x, expected.x, 1e-9); close(mid.y, expected.y, 1e-9);
  });
  it("antípodas y puntos iguales no dan NaN", () => {
    for (const p of [...greatCircle(0, 0, 0, 180, 10), ...greatCircle(90, 0, -90, 0, 10), ...greatCircle(5, 5, 5, 5, 10)]) {
      expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
    }
  });
});

describe("esfera de Fibonacci", () => {
  const pts = fibonacciSphere(500);
  it("está sobre la esfera unitaria", () => {
    for (const p of pts) close(length(p), 1, 1e-9);
  });
  it("reparte parejo: centroide en el origen y casquetes de área igual con igual cantidad", () => {
    const c = pts.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y, z: s.z + p.z }), { x: 0, y: 0, z: 0 });
    expect(Math.hypot(c.x, c.y, c.z) / pts.length).toBeLessThan(0.01);
    // área de la franja y>0.5 es 1/4 de la esfera
    expect(Math.abs(pts.filter((p) => p.y > 0.5).length / pts.length - 0.25)).toBeLessThan(0.01);
    // distancia mínima al vecino es parecida para todos
    const nn = pts.slice(0, 100).map((p) => Math.min(...pts.filter((q) => q !== p).map((q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z))));
    expect(Math.min(...nn) / Math.max(...nn)).toBeGreaterThan(0.5);
  });
});

describe("isométrica y profundidad", () => {
  it("proyecta los ejes a 30 grados", () => {
    const x = isometric({ x: 1, y: 0, z: 0 }), z = isometric({ x: 0, y: 0, z: 1 }), y = isometric({ x: 0, y: 1, z: 0 });
    close(x.x, Math.cos(Math.PI / 6)); close(x.y, 0.5);
    close(z.x, -Math.cos(Math.PI / 6)); close(z.y, 0.5);
    close(y.x, 0); close(y.y, -1);
  });
  it("lineByDepth: cerca más grueso y opaco, valores acotados", () => {
    const n = lineByDepth(1, 1, 5), f = lineByDepth(5, 1, 5), o = lineByDepth(99, 1, 5);
    expect(n.width).toBeGreaterThan(f.width); expect(n.alpha).toBeGreaterThan(f.alpha);
    expect(o).toEqual(f);
    close(depthFade(3, 1, 5), 0.5);
  });
});

describe("rotateAround", () => {
  it("gira alrededor de un pivote", () => {
    const p = rotateAround({ x: 2, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, "z", Math.PI / 2);
    close(p.x, 1); close(p.y, 1); close(p.z, 0);
  });
});
