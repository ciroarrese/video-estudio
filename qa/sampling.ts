/** Parses "0,60,120", "10-20" and "0-90/30" (range with step) into a list of frames; validates against `duration`. */
export function parseFrameList(spec: string, duration: number): number[] {
  const out: number[] = [];
  for (const part of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+)(?:\/(\d+))?)?$/.exec(part);
    if (!m) throw new Error(`Cuadros invalidos: "${part}" (usa 0,60,120 o 0-90/30)`);
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    const step = m[3] === undefined ? 1 : Number(m[3]);
    if (step < 1 || b < a) throw new Error(`Rango invalido: "${part}"`);
    for (let f = a; f <= b; f += step) out.push(f);
  }
  const bad = out.find((f) => f >= duration);
  if (bad !== undefined) throw new RangeError(`El cuadro ${bad} excede el video (0-${duration - 1})`);
  if (!out.length) throw new Error('Lista de cuadros vacia');
  return [...new Set(out)];
}

/** `count` frames evenly spread over [0, duration-1], first and last included. */
export function evenFrames(duration: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1) throw new Error('--count debe ser un entero >= 1');
  if (count >= duration) return Array.from({ length: duration }, (_, i) => i);
  if (count === 1) return [0];
  return [...new Set(Array.from({ length: count }, (_, i) => Math.round((i * (duration - 1)) / (count - 1))))];
}

export const everyFrames = (duration: number, every: number): number[] => {
  if (!Number.isInteger(every) || every < 1) throw new Error('--every debe ser un entero >= 1');
  return Array.from({ length: Math.ceil(duration / every) }, (_, i) => i * every);
};

import { sceneCheckFrames } from '../render/plan';
import type { SceneInfo } from '../engine';

/** Cuadros por escena que `qa` agrega al muestreo repartido (`--per-scene`); 0 = ninguno. */
export const DEFAULT_PER_SCENE = 4;

/**
 * Cuadros anclados a cada escena con nombre: los mismos desplazamientos LOCALES (2, 10 y 24 desde el inicio de la escena, que es donde
 * ocurren las entradas, y el último cuadro) mientras la escena dure lo mismo, vengan donde vengan en el video. El muestreo repartido
 * (`--count`) cae en otros cuadros cada vez que cambia la duración total del video y trae hallazgos "nuevos" en escenas que no cambiaron;
 * estos cuadros no se mueven con lo que pasa antes o después de la escena, así dos corridas se comparan escena por escena. Pura y determinista.
 */
export function anchoredFrames(scenes: readonly Pick<SceneInfo, 'id' | 'from' | 'durationInFrames'>[], duration: number, perScene: number): number[] {
  if (perScene <= 0) return [];
  const out = new Set<number>();
  for (const s of scenes) {
    const len = Math.min(s.durationInFrames, duration - s.from);
    if (len <= 0 || s.from < 0) continue;
    for (const f of sceneCheckFrames(s.from, len, perScene)) if (f >= 0 && f < duration) out.add(f);
  }
  return [...out].sort((a, b) => a - b);
}

export type SampleSpec = { frames?: number[] | string; every?: number; count?: number };

/**
 * `anchored`: cuadros extra (ver `anchoredFrames`) que se suman al muestreo repartido SOLO cuando no se pidieron cuadros (`frames`) ni paso (`every`)
 * y no hay `range` (una escena sola ya se muestrea en su propio rango). Con `count: 0` se usan solo ellos.
 */
export function sampleFrames(spec: SampleSpec, duration: number, defaultCount: number, range?: [number, number], anchored: readonly number[] = []): number[] {
  if (range) {
    // Dentro de una escena: se muestrea el rango [a, b] y el resultado se corre al cuadro absoluto.
    if (spec.frames !== undefined) throw new Error('--scene y --frames no se combinan: usá --count o --every');
    const [a, b] = range;
    return sampleFrames({ ...spec, frames: undefined }, b - a + 1, defaultCount).map((f) => f + a);
  }
  if (spec.frames !== undefined) {
    if (typeof spec.frames === 'string') return parseFrameList(spec.frames, duration);
    const bad = spec.frames.find((f) => !Number.isInteger(f) || f < 0 || f >= duration);
    if (bad !== undefined) throw new RangeError(`El cuadro ${bad} excede el video (0-${duration - 1})`);
    return [...new Set(spec.frames)];
  }
  if (spec.every !== undefined) return everyFrames(duration, spec.every);
  if (spec.count === 0) {
    if (!anchored.length) throw new Error('--count 0 deja solo los cuadros por escena, y este video no declara escenas con nombre (o --per-scene es 0): pedí --count N');
    return [...anchored];
  }
  const even = evenFrames(duration, spec.count ?? defaultCount);
  return anchored.length ? [...new Set([...even, ...anchored])].sort((a, b) => a - b) : even;
}
