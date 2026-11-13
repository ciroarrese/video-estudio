// Geometría 3D mínima, escrita desde cero: rotar, proyectar con perspectiva simple, ordenar y sombrear.
// Convención: x a la derecha, y ARRIBA, z hacia el espectador. La proyección devuelve y hacia ABAJO (pantalla).

export interface Vec3 { x: number; y: number; z: number }

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a);
  return l < 1e-12 ? { x: 0, y: 0, z: 0 } : scale(a, 1 / l);
};
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

/** Giro de `a` radianes alrededor del eje X (regla de la mano derecha). */
export function rotateX(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}
/** Giro alrededor del eje Y. */
export function rotateY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}
/** Giro alrededor del eje Z. */
export function rotateZ(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}
/** Giro en orden Z, X, Y (balanceo, cabeceo, guiñada). */
export function rotateXYZ(p: Vec3, rx: number, ry: number, rz = 0): Vec3 {
  return rotateY(rotateX(rotateZ(p, rz), rx), ry);
}

export const deg = (d: number): number => (d * Math.PI) / 180;

export interface Projected {
  /** Píxeles (o unidades * `unit`) desde el centro; x a la derecha, y hacia abajo. */
  x: number;
  y: number;
  /** Factor de perspectiva: 1 en el plano del origen, mayor si está más cerca. */
  scale: number;
  /** Distancia al ojo en unidades de mundo (menor = más cerca). */
  depth: number;
}

export interface CameraOptions {
  /** Distancia del ojo al origen. Si falta se calcula desde `fov`. */
  distance?: number;
  /** Campo de visión vertical en grados (se usa si no hay `distance`). */
  fov?: number;
  /** Mitad de la altura visible en el plano del origen, en unidades de mundo (con `fov`). */
  extent?: number;
  /** Inclinación (giro alrededor de X) en radianes; positiva = se ve desde arriba. */
  tilt?: number;
  /** Giro de la escena alrededor de Y en radianes. */
  yaw?: number;
  /** Balanceo alrededor de Z en radianes. */
  roll?: number;
  /** Píxeles por unidad de mundo en el plano del origen. */
  unit?: number;
}

export interface Camera {
  distance: number;
  /** Lleva el punto al espacio de la cámara (giro de escena, sin proyectar). */
  view(p: Vec3): Vec3;
  project(p: Vec3): Projected;
}

/** Cámara en el eje +z mirando al origen; la escena gira (yaw, luego tilt). */
export function camera(opts: CameraOptions = {}): Camera {
  const { tilt = 0, yaw = 0, roll = 0, unit = 1 } = opts;
  const fov = opts.fov ?? 40;
  const extent = opts.extent ?? 1;
  const distance = opts.distance ?? extent / Math.tan(deg(fov) / 2);
  const view = (p: Vec3): Vec3 => rotateZ(rotateX(rotateY(p, yaw), tilt), roll);
  const project = (p: Vec3): Projected => {
    const q = view(p);
    const depth = Math.max(1e-6, distance - q.z);
    const s = distance / depth;
    return { x: q.x * s * unit, y: -q.y * s * unit, scale: s, depth };
  };
  return { distance, view, project };
}

/** Ordena de atrás hacia adelante (mayor profundidad primero). Estable; no modifica la entrada. */
export function sortBackToFront<T>(items: readonly T[], depthOf: (item: T) => number): T[] {
  return items
    .map((item, i) => ({ item, i, d: depthOf(item) }))
    .sort((a, b) => b.d - a.d || a.i - b.i)
    .map((e) => e.item);
}

/** Normal unitaria de un triángulo (a, b, c) según la regla de la mano derecha. */
export function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  return normalize(cross(sub(b, a), sub(c, a)));
}

/**
 * Sombreado plano: intensidad 0..1 = ambiente + difusa. `light` apunta HACIA la luz.
 * Una cara de frente a la luz da 1; una de espaldas, el ambiente.
 */
export function shade(normal: Vec3, light: Vec3, ambient = 0.3): number {
  const d = Math.max(0, dot(normalize(normal), normalize(light)));
  const a = Math.min(1, Math.max(0, ambient));
  return a + (1 - a) * d;
}

/** Latitud/longitud en grados a un punto de la esfera de radio `r`; (0,0) mira al espectador. */
export function latLon(lat: number, lon: number, r = 1): Vec3 {
  const la = deg(lat), lo = deg(lon);
  return { x: r * Math.cos(la) * Math.sin(lo), y: r * Math.sin(la), z: r * Math.cos(la) * Math.cos(lo) };
}

/**
 * Puntos del arco de círculo máximo entre dos lat/lon (grados), de `n + 1` puntos.
 * El radio sube `bump * sin(pi t)` (máximo en el punto medio) para que el arco se despegue de la superficie.
 */
export function greatCircle(lat1: number, lon1: number, lat2: number, lon2: number, n = 48, bump = 0.25): Vec3[] {
  const a = latLon(lat1, lon1), b = latLon(lat2, lon2);
  const cosw = Math.min(1, Math.max(-1, dot(a, b)));
  const w = Math.acos(cosw);
  const out: Vec3[] = [];
  let perp: Vec3 | null = null;
  if (Math.sin(w) < 1e-6 && cosw < 0) {
    // Antípodas: elegimos un meridiano cualquiera.
    perp = Math.abs(a.y) < 0.9 ? normalize(cross(a, { x: 0, y: 1, z: 0 })) : { x: 1, y: 0, z: 0 };
  }
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let p: Vec3;
    if (perp) {
      const ang = Math.PI * t;
      p = add(scale(a, Math.cos(ang)), scale(perp, Math.sin(ang)));
    } else if (w < 1e-6) {
      p = a;
    } else {
      const k1 = Math.sin((1 - t) * w) / Math.sin(w), k2 = Math.sin(t * w) / Math.sin(w);
      p = add(scale(a, k1), scale(b, k2));
    }
    out.push(scale(p, 1 + bump * Math.sin(Math.PI * t)));
  }
  return out;
}

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** `n` puntos repartidos parejo sobre la esfera unitaria (ángulo áureo). */
export function fibonacciSphere(n: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * GOLDEN_ANGLE;
    out.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
  }
  return out;
}

/** Proyección isométrica (2:1 verdadera, 30°) de un punto con y hacia arriba; devuelve pantalla (y hacia abajo). */
export function isometric(p: Vec3, unit = 1): { x: number; y: number } {
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  return { x: (p.x - p.z) * c * unit, y: ((p.x + p.z) * s - p.y) * unit };
}

/** 1 cerca ... 0 lejos, lineal entre `near` y `far` (en unidades de profundidad). */
export function depthFade(depth: number, near: number, far: number): number {
  if (far === near) return 1;
  return Math.min(1, Math.max(0, (far - depth) / (far - near)));
}

export interface LineStyleOptions {
  minAlpha?: number;
  maxAlpha?: number;
  minWidth?: number;
  maxWidth?: number;
}

/** Opacidad y grosor de un trazo según la profundidad: lo cercano, más grueso y más opaco. */
export function lineByDepth(depth: number, near: number, far: number, o: LineStyleOptions = {}): { alpha: number; width: number } {
  const { minAlpha = 0.08, maxAlpha = 1, minWidth = 0.8, maxWidth = 3 } = o;
  const f = depthFade(depth, near, far);
  return { alpha: minAlpha + (maxAlpha - minAlpha) * f, width: minWidth + (maxWidth - minWidth) * f };
}

/** Giro de `p` alrededor de un eje paralelo a X, Y o Z que pasa por `pivot`. */
export function rotateAround(p: Vec3, pivot: Vec3, axis: "x" | "y" | "z", a: number): Vec3 {
  const q = sub(p, pivot);
  const r = axis === "x" ? rotateX(q, a) : axis === "y" ? rotateY(q, a) : rotateZ(q, a);
  return add(r, pivot);
}
