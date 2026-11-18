import type { Rect } from "./layout";

/** Lo mínimo de una cámara que hace falta para proyectar: foco, escala y (opcional) inclinación en grados. */
export type ProjectCamera = { x: number; y: number; scale: number; rx?: number; ry?: number };

export type ProjectOptions = {
  /** La misma `perspective` que recibe `World` (por defecto 2400). Solo importa con inclinación. */
  perspective?: number;
};

const RAD = Math.PI / 180;

/**
 * Proyecta un punto del mundo a la pantalla con **la misma cuenta que `World`**: `translate(ancho/2, alto/2) perspective(P) rotateX(rx) rotateY(ry)
 * scale(escala) translate(-x, -y)`. Sin inclinación es la cuenta plana (`(p - foco) * escala + centro`). Con inclinación contempla la perspectiva;
 * si el punto queda detrás de la cámara (la inclinación y la escala lo mandan al otro lado del plano de perspectiva) falla con un mensaje claro,
 * porque en pantalla no hay dónde ponerlo.
 */
export function projectPoint(p: { x: number; y: number }, cam: ProjectCamera, format: { width: number; height: number }, o: ProjectOptions = {}): { x: number; y: number } {
  const u = (p.x - cam.x) * cam.scale;
  const v = (p.y - cam.y) * cam.scale;
  const rx = (cam.rx ?? 0) * RAD, ry = (cam.ry ?? 0) * RAD;
  if (Math.abs(rx) < 1e-9 && Math.abs(ry) < 1e-9) return { x: u + format.width / 2, y: v + format.height / 2 };
  const d = o.perspective ?? 2400;
  // rotateY y después rotateX sobre el plano z = 0 (CSS aplica las matrices de derecha a izquierda: primero escala y traslado, después rotateY, rotateX y perspective)
  const x1 = u * Math.cos(ry);
  const z1 = -u * Math.sin(ry);
  const y2 = v * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = v * Math.sin(rx) + z1 * Math.cos(rx);
  const w = 1 - z2 / d;
  if (!(w > 1e-6)) {
    throw new Error(
      `projectRect: el punto (${Math.round(p.x)}, ${Math.round(p.y)}) queda detrás de la cámara con inclinación rx ${cam.rx ?? 0}°, ry ${cam.ry ?? 0}° y escala ${cam.scale}; usá la cámara de perfil "plana" (profile: "plana") o alejá la cámara.`,
    );
  }
  return { x: x1 / w + format.width / 2, y: y2 / w + format.height / 2 };
}

/**
 * Dónde cae en la pantalla un rectángulo del mundo para una cámara dada (lo que dibuja `World` con esa cámara): sirve para anclar piezas que viven en
 * **espacio de pantalla** (etiquetas, tarjetas, foco) a algo que se mueve con la cámara, sin que queden desfasadas un cuadro. Devuelve el rectángulo
 * envolvente (sin redondear: redondeá donde dibujes). Sin inclinación es exacto; con inclinación proyecta las cuatro esquinas con la perspectiva de
 * `World` y devuelve su caja envolvente (el plano inclinado es un trapecio). Si una esquina queda detrás de la cámara, lanza un error que lo dice.
 * Con el perfil de cámara `plana` nunca hay inclinación.
 *
 * ```ts
 * const cam = cameraAt(frame, keys, { profile: "plana" });
 * const enPantalla = projectRect(botonDelMundo, cam, { width, height });
 * ```
 */
export function projectRect(rect: Rect, cam: ProjectCamera, format: { width: number; height: number }, o: ProjectOptions = {}): Rect {
  const pts = [
    projectPoint({ x: rect.x, y: rect.y }, cam, format, o),
    projectPoint({ x: rect.x + rect.w, y: rect.y }, cam, format, o),
    projectPoint({ x: rect.x + rect.w, y: rect.y + rect.h }, cam, format, o),
    projectPoint({ x: rect.x, y: rect.y + rect.h }, cam, format, o),
  ];
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
