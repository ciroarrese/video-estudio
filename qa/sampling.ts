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

export type SampleSpec = { frames?: number[] | string; every?: number; count?: number };

export function sampleFrames(spec: SampleSpec, duration: number, defaultCount: number, range?: [number, number]): number[] {
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
  return evenFrames(duration, spec.count ?? defaultCount);
}
