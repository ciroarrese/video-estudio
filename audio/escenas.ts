// Cues y audio propio por escena: junta lo que declaran las escenas (`SceneInfo.cues`, `audioPropio`, en cuadros relativos a cada una) en
// cues absolutos y en tramos de audio propio. Núcleo puro; `cargarVideo` es la única parte que toca el runtime (reusa `listScenes` de `render/`).
import type { FormatName, SceneInfo, SceneOwnAudio } from '../engine';
import type { Cue } from './mezcla';

export interface TramoPropio {
  /** Id de la escena que declara el audio propio. */
  escena: string;
  desdeFrame: number;
  /** Excluido. */
  hastaFrame: number;
  desdeSec: number;
  hastaSec: number;
}

export interface CuesDeEscenas {
  cues: Cue[];
  /** Escena de la que salió cada cue (mismo orden que `cues`). */
  escenaDeCue: string[];
  avisos: string[];
}

/**
 * Cues absolutos de las escenas: el `frame` de cada cue se suma al `from` de su escena. Un cue que cae fuera de su escena (pasa de su duración)
 * se mantiene pero avisa; uno fuera del video lo omite la mezcla. Orden estable: por cuadro absoluto, y a igual cuadro el orden en que se declararon.
 */
export function cuesAbsolutos(scenes: readonly SceneInfo[], durationInFrames?: number): CuesDeEscenas {
  const avisos: string[] = [];
  const todos: Array<{ cue: Cue; escena: string; orden: number }> = [];
  let orden = 0;
  for (const s of scenes) {
    for (const c of s.cues ?? []) {
      if (!Number.isFinite(c.frame) || c.frame < 0) throw new Error(`La escena "${s.id}" declara un cue con frame inválido (${c.frame}): tiene que ser un número >= 0 relativo a la escena.`);
      if (!c.sfx) throw new Error(`La escena "${s.id}" declara un cue sin sfx.`);
      const abs = s.from + Math.round(c.frame);
      if (c.frame >= s.durationInFrames) avisos.push(`El cue "${c.sfx}" de la escena "${s.id}" está en el cuadro relativo ${c.frame}, pero la escena dura ${s.durationInFrames} cuadros: cae en el cuadro ${abs}, ya fuera de ella.`);
      else if (durationInFrames !== undefined && abs >= durationInFrames) avisos.push(`El cue "${c.sfx}" de la escena "${s.id}" cae en el cuadro ${abs}, fuera del video (${durationInFrames} cuadros).`);
      const { frame: _f, ...resto } = c;
      todos.push({ cue: { ...resto, frame: abs }, escena: s.id, orden: orden++ });
    }
  }
  todos.sort((a, b) => a.cue.frame - b.cue.frame || a.orden - b.orden);
  return { cues: todos.map((t) => t.cue), escenaDeCue: todos.map((t) => t.escena), avisos };
}

function rango(own: SceneOwnAudio, s: SceneInfo): [number, number] | null {
  if (own === false) return null;
  if (own === true) return [0, s.durationInFrames];
  const d = Math.max(0, own.desde ?? 0);
  const h = Math.min(s.durationInFrames, own.hasta ?? s.durationInFrames);
  return h > d ? [d, h] : null;
}

/** Tramos de audio propio declarados por las escenas, en cuadros y segundos absolutos, ordenados. */
export function tramosPropios(scenes: readonly SceneInfo[], fps: number): TramoPropio[] {
  const out: TramoPropio[] = [];
  for (const s of scenes) {
    if (s.audioPropio === undefined) continue;
    const r = rango(s.audioPropio, s);
    if (!r) continue;
    const desdeFrame = s.from + r[0];
    const hastaFrame = s.from + r[1];
    out.push({ escena: s.id, desdeFrame, hastaFrame, desdeSec: desdeFrame / fps, hastaSec: hastaFrame / fps });
  }
  return out.sort((a, b) => a.desdeFrame - b.desdeFrame);
}

/** Une los tramos que se tocan o se solapan (para no hacer dos huecos pegados en la música). */
export function unirTramos(t: readonly TramoPropio[]): Array<{ desdeSec: number; hastaSec: number; escenas: string[] }> {
  const out: Array<{ desdeSec: number; hastaSec: number; escenas: string[] }> = [];
  for (const x of [...t].sort((a, b) => a.desdeSec - b.desdeSec)) {
    const u = out[out.length - 1];
    if (u && x.desdeSec <= u.hastaSec + 1e-9) {
      u.hastaSec = Math.max(u.hastaSec, x.hastaSec);
      if (!u.escenas.includes(x.escena)) u.escenas.push(x.escena);
    } else out.push({ desdeSec: x.desdeSec, hastaSec: x.hastaSec, escenas: [x.escena] });
  }
  return out;
}

export interface VideoCargado {
  id: string;
  fps: number;
  durationInFrames: number;
  scenes: SceneInfo[];
}

export type CargadorDeVideo = (videoId: string, o: { format?: FormatName; props?: Record<string, unknown> }) => Promise<VideoCargado>;

/**
 * Escenas del video por su id: el mismo camino que `render --list-scenes` (descubrimiento de `examples/*` y `videos/<slug>`, `VE_VIDEOS_DIR`, el
 * bundle del runtime y Chromium). Se importa recién acá para que el resto de los comandos de audio no carguen el motor de render.
 */
export const cargarVideo: CargadorDeVideo = async (videoId, o) => {
  const { listScenes } = await import('../render/render');
  const r = await listScenes({ videoId, format: o.format, props: o.props, log: () => {} });
  return { id: r.meta.id, fps: r.meta.fps, durationInFrames: r.meta.durationInFrames, scenes: r.scenes };
};
