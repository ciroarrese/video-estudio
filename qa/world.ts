// Interfaz recreada bajo una cámara: lo que el contrato `data-qa-world` / `data-qa-overlay` / `data-qa-target` cambia en las reglas.
//
//  - `data-qa-world`: el contenedor que la cámara transforma. Con el mundo ACERCADO (escala > `ZOOM_MIN`) el borde del cuadro corta texto de la interfaz a
//    propósito: ese texto cortado baja a `info` en offscreen, covered, overlap y contrast. Lo que queda entero dentro del encuadre se juzga normal.
//  - `data-qa-target`: el objetivo de la señal activa. NUNCA se exceptúa: cortado o tapado es error (salvo mientras la cámara todavía viaja hacia él).
//  - `data-qa-overlay`: capa fija en espacio de pantalla (etiqueta, tarjeta, barra de progreso). Lo que tapa del mundo no es un defecto de ese texto
//    (salvo el objetivo); el texto propio de la capa se juzga con todas las reglas.
//  - `data-qa-settled` (en el mundo): la cámara está asentada sobre una señal.
import { intersect, protrusion, visibleLine } from './geometry';
import type { Rect, TextRun } from './types';

/** Escala del mundo por encima de la cual se lo considera acercado (un 2 % de margen sobre 1: el plano general no cuenta como zoom). */
export const ZOOM_MIN = 1.02;

/** El texto está en un mundo marcado y NO es el objetivo ni de una capa fija: es lo que las excepciones de zoom pueden tocar. */
export const isWorldText = (r: Pick<TextRun, 'world' | 'target' | 'overlay'>): boolean => !!r.world && !r.target && !r.overlay;

/** El mundo del texto está acercado. */
export const worldZoomed = (r: Pick<TextRun, 'world'>): boolean => !!r.world && r.world.zoom > ZOOM_MIN;

/**
 * El borde del cuadro corta este texto de la interfaz con el mundo acercado (y no es el objetivo): alguna línea visible entra en el cuadro y sobresale más que
 * `tolerancePx`. Un texto entero dentro del encuadre, o del todo afuera, no es un corte.
 */
export function edgeCut(r: TextRun, width: number, height: number, tolerancePx: number): boolean {
  if (!isWorldText(r) || !worldZoomed(r)) return false;
  const box: Rect = { x: 0, y: 0, w: width, h: height };
  for (const full of r.lines) {
    const line = visibleLine(full, r.clips, width, height);
    if (line && intersect(line, box) && protrusion(line, box) > tolerancePx) return true;
  }
  return false;
}
