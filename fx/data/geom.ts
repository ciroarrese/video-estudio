// Geometria pura compartida por los grupos data/ui/art: polilineas, recorte por progreso, trazados SVG.
export type Pt = { x: number; y: number };

const f2 = (n: number) => +n.toFixed(2);

/** Largo total de una polilinea. */
export function polyLength(pts: Pt[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return L;
}

/** Punto (y angulo en radianes) a la fraccion `p` (0..1) del largo de la polilinea. */
export function pointAt(pts: Pt[], p: number): Pt & { angle: number } {
  if (pts.length === 0) return { x: 0, y: 0, angle: 0 };
  if (pts.length === 1) return { ...pts[0]!, angle: 0 };
  const target = Math.min(1, Math.max(0, p)) * polyLength(pts);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + seg >= target || i === pts.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, (target - acc) / seg);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    acc += seg;
  }
  const l = pts[pts.length - 1]!;
  return { ...l, angle: 0 };
}

/** Primeros `p` (0..1) del largo de la polilinea, con el ultimo punto interpolado ("revelado de trazo"). */
export function trimPolyline(pts: Pt[], p: number): Pt[] {
  if (pts.length < 2 || p <= 0) return pts.slice(0, 1);
  if (p >= 1) return pts;
  const target = p * polyLength(pts);
  const out: Pt[] = [pts[0]!];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + seg >= target) {
      const t = seg === 0 ? 0 : (target - acc) / seg;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      return out;
    }
    out.push(b);
    acc += seg;
  }
  return out;
}

/** Cadena `d` de SVG a partir de puntos. */
export function toPath(pts: Pt[], close = false): string {
  if (pts.length === 0) return "";
  return pts.map((q, i) => `${i === 0 ? "M" : "L"}${f2(q.x)} ${f2(q.y)}`).join(" ") + (close ? " Z" : "");
}

/** Curva suave (Catmull-Rom) que pasa por los puntos, muestreada con `steps` puntos por tramo. */
export function catmullRom(pts: Pt[], steps = 10): Pt[] {
  if (pts.length < 3) return pts.slice();
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const c = (a: number, b: number, cc: number, d: number) =>
        0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      out.push({ x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** Puntos de un arco de circunferencia (angulos en radianes). */
export function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, steps = 24): Pt[] {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) / (Math.PI * 2)) * steps * 2));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

/** Polilinea ortogonal con las esquinas redondeadas (radio `r`), muestreada. */
export function roundedPolyline(corners: Pt[], r: number, steps = 8): Pt[] {
  if (corners.length < 3) return corners.slice();
  const out: Pt[] = [corners[0]!];
  for (let i = 1; i < corners.length - 1; i++) {
    const a = corners[i - 1]!, b = corners[i]!, c = corners[i + 1]!;
    const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const p1 = { x: b.x + ((a.x - b.x) / l1) * rr, y: b.y + ((a.y - b.y) / l1) * rr };
    const p2 = { x: b.x + ((c.x - b.x) / l2) * rr, y: b.y + ((c.y - b.y) / l2) * rr };
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, u = 1 - t;
      out.push({ x: u * u * p1.x + 2 * u * t * b.x + t * t * p2.x, y: u * u * p1.y + 2 * u * t * b.y + t * t * p2.y });
    }
  }
  out.push(corners[corners.length - 1]!);
  return out;
}

/** Remuestrea una polilinea a `n` puntos equidistantes (cerrada: el ultimo no repite el primero). */
export function resample(pts: Pt[], n: number, closed = false): Pt[] {
  const src = closed ? [...pts, pts[0]!] : pts;
  const L = polyLength(src);
  if (L === 0) return Array.from({ length: n }, () => ({ ...src[0]! }));
  return Array.from({ length: n }, (_, i) => {
    const q = pointAt(src, closed ? i / n : n === 1 ? 0 : i / (n - 1));
    return { x: q.x, y: q.y };
  });
}

/** Interpola dos listas de puntos de igual cantidad. */
export function morphPoints(a: Pt[], b: Pt[], t: number): Pt[] {
  if (a.length !== b.length) throw new Error("morphPoints: listas de distinto largo");
  return a.map((p, i) => ({ x: p.x + (b[i]!.x - p.x) * t, y: p.y + (b[i]!.y - p.y) * t }));
}

/** Convierte datos de trazado SVG (M L H V C S Q T A Z, absolutos y relativos) en subtrazados de puntos. */
export function parsePath(d: string, steps = 14): Pt[][] {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const subs: Pt[][] = [];
  let cur: Pt[] = [];
  let x = 0, y = 0, sx = 0, sy = 0, lcx = 0, lcy = 0, lastCmd = "";
  let i = 0, cmd = "";
  const num = () => parseFloat(toks[i++]!);
  const start = () => {
    cur = [{ x, y }];
    subs.push(cur);
    sx = x; sy = y;
  };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i]!)) cmd = toks[i++]!;
    else if (cmd === "M") cmd = "L";
    else if (cmd === "m") cmd = "l";
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === "Z") {
      if (cur.length) cur.push({ x: sx, y: sy });
      x = sx; y = sy;
      cur = [{ x, y }];
      subs.push(cur);
    } else if (C === "M") {
      x = ox + num(); y = oy + num();
      start();
    } else if (C === "L") {
      x = ox + num(); y = oy + num();
      if (!cur.length) start(); else cur.push({ x, y });
    } else if (C === "H") {
      x = ox + num();
      cur.push({ x, y });
    } else if (C === "V") {
      y = oy + num();
      cur.push({ x, y });
    } else if (C === "C" || C === "S") {
      const x1 = C === "S" ? (/[CS]/i.test(lastCmd) ? 2 * x - lcx : x) : ox + num();
      const y1 = C === "S" ? (/[CS]/i.test(lastCmd) ? 2 * y - lcy : y) : oy + num();
      const x2 = ox + num(), y2 = oy + num(), ex = ox + num(), ey = oy + num();
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, u = 1 - t;
        cur.push({
          x: u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex,
          y: u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey,
        });
      }
      lcx = x2; lcy = y2; x = ex; y = ey;
    } else if (C === "Q" || C === "T") {
      const x1 = C === "T" ? (/[QT]/i.test(lastCmd) ? 2 * x - lcx : x) : ox + num();
      const y1 = C === "T" ? (/[QT]/i.test(lastCmd) ? 2 * y - lcy : y) : oy + num();
      const ex = ox + num(), ey = oy + num();
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, u = 1 - t;
        cur.push({ x: u * u * x + 2 * u * t * x1 + t * t * ex, y: u * u * y + 2 * u * t * y1 + t * t * ey });
      }
      lcx = x1; lcy = y1; x = ex; y = ey;
    } else if (C === "A") {
      let rx = Math.abs(num()), ry = Math.abs(num());
      const phi = (num() * Math.PI) / 180, fa = num(), fs = num();
      const ex = ox + num(), ey = oy + num();
      cur.push(...arcToPoints(x, y, rx, ry, phi, fa, fs, ex, ey, steps * 2));
      rx = ry = 0;
      x = ex; y = ey;
    } else {
      break;
    }
    lastCmd = cmd;
  }
  return subs.filter((s) => s.length > 1);
}

function arcToPoints(x1: number, y1: number, rxIn: number, ryIn: number, phi: number, fa: number, fs: number, x2: number, y2: number, steps: number): Pt[] {
  if (rxIn === 0 || ryIn === 0 || (x1 === x2 && y1 === y2)) return [{ x: x2, y: y2 }];
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  let rx = rxIn, ry = ryIn;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const k = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (k * rx * y1p) / ry, cyp = (-k * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dth > 0) dth -= Math.PI * 2;
  if (fs && dth < 0) dth += Math.PI * 2;
  const out: Pt[] = [];
  for (let s = 1; s <= steps; s++) {
    const a = th1 + (dth * s) / steps;
    out.push({ x: cx + rx * Math.cos(a) * cp - ry * Math.sin(a) * sp, y: cy + rx * Math.cos(a) * sp + ry * Math.sin(a) * cp });
  }
  return out;
}

/** Cota superior "bonita" y marcas de eje: niceTicks(87, 4) -> { max: 100, ticks: [0,25,50,75,100] }. */
export function niceTicks(maxValue: number, count = 4): { max: number; ticks: number[] } {
  const raw = Math.max(1e-9, maxValue) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const n = Math.max(1, Math.ceil(maxValue / step - 1e-9));
  return { max: n * step, ticks: Array.from({ length: n + 1 }, (_, i) => +(i * step).toFixed(6)) };
}

/** Numero con separador de miles ("1.234"). */
export const fmtInt = (n: number): string => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Fraccion visible (0..1) de la progresion escalonada `i` de `n`: cada elemento arranca en `spread * i/(n-1)` y termina a mas tardar en 1. */
export function staggerT(p: number, i: number, n: number, spread = 0.5): number {
  const off = n <= 1 ? 0 : (spread * i) / (n - 1);
  return Math.min(1, Math.max(0, (p - off) / (1 - spread)));
}
