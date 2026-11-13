// Mezcla: lista de señales (cue) + música opcional con ducking -> una pista de audio lista para el video.
// `planMezcla` es una función pura que arma las entradas y el filtergraph de ffmpeg.
import { extname, isAbsolute, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { runFfmpeg } from './ffmpeg';

export interface Cue {
  frame: number;
  /** Nombre de un efecto (`tilde`, se busca `<carpeta>/tilde.wav`) o ruta a un archivo. */
  sfx: string;
  /** Multiplicador lineal; 1 por defecto. */
  gain?: number;
}

export interface MusicaOpts {
  archivo: string;
  /** Multiplicador lineal; 0,6 por defecto. */
  gain?: number;
  /** Segundo de la música desde el que arrancar. */
  desdeSec?: number;
  fadeInSec?: number;
  /** Caída al final del video (1 s por defecto). */
  fadeOutSec?: number;
}

export interface DuckOpts {
  /** Razón de compresión sobre la música cuando suena un efecto; 0 apaga el ducking. 4 por defecto. */
  ratio?: number;
  /** Umbral lineal del efecto que dispara el ducking. */
  threshold?: number;
  attackMs?: number;
  releaseMs?: number;
}

export interface MezclaOpts {
  fps: number;
  durationFrames: number;
  cues: readonly Cue[];
  sfxDir?: string;
  sr?: number;
  musica?: MusicaOpts;
  duck?: DuckOpts;
}

export interface PlanMezcla {
  /** Archivos de entrada en orden (-i). La música, si hay, es la entrada 0. */
  inputs: string[];
  filterComplex: string;
  outLabel: string;
  totalSamples: number;
  sr: number;
  /** Muestra de salida donde arranca cada cue (para verificar). */
  cueSamples: number[];
  advertencias: string[];
}

const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(6).replace(/0+$/, ''));

export function rutaDeEfecto(sfx: string, dir: string): string {
  if (isAbsolute(sfx) || extname(sfx) !== '' || sfx.includes('/')) return sfx;
  return join(dir, `${sfx}.wav`);
}

export function planMezcla(o: MezclaOpts): PlanMezcla {
  const sr = o.sr ?? 48000;
  const totalSamples = Math.round((o.durationFrames / o.fps) * sr);
  const dir = o.sfxDir ?? 'public/sfx';
  const advertencias: string[] = [];
  const cues: Cue[] = [];
  for (const c of o.cues) {
    if (!Number.isFinite(c.frame) || c.frame < 0) throw new Error(`Cue con frame inválido: ${JSON.stringify(c)}`);
    if (c.gain !== undefined && !(c.gain >= 0)) throw new Error(`Cue con gain inválido: ${JSON.stringify(c)}`);
    if (c.frame >= o.durationFrames) {
      advertencias.push(`El cue "${c.sfx}" en el cuadro ${c.frame} cae fuera del video (${o.durationFrames} cuadros): se omite`);
      continue;
    }
    cues.push(c);
  }
  if (cues.length === 0 && !o.musica) throw new Error('No hay nada que mezclar: ni cues ni música');

  const inputs: string[] = [];
  const f: string[] = [];
  const fmt = `aformat=sample_rates=${sr}:channel_layouts=stereo`;
  const fin = `apad=whole_len=${totalSamples},atrim=end_sample=${totalSamples},asetpts=PTS-STARTPTS`;

  let musLabel: string | null = null;
  if (o.musica) {
    const m = o.musica;
    inputs.push(m.archivo);
    const fadeOut = Math.min(m.fadeOutSec ?? 1, totalSamples / sr);
    const partes = [fmt];
    if (m.desdeSec) partes.push(`atrim=start=${num(m.desdeSec)}`, 'asetpts=PTS-STARTPTS');
    partes.push(`volume=${num(m.gain ?? 0.6)}`);
    if (m.fadeInSec) partes.push(`afade=t=in:st=0:d=${num(m.fadeInSec)}`);
    partes.push(fin);
    if (fadeOut > 0) partes.push(`afade=t=out:st=${num(totalSamples / sr - fadeOut)}:d=${num(fadeOut)}`);
    f.push(`[0:a]${partes.join(',')}[mus]`);
    musLabel = 'mus';
  }

  const cueSamples: number[] = [];
  const etiquetas: string[] = [];
  cues.forEach((c, i) => {
    const idx = inputs.length;
    inputs.push(rutaDeEfecto(c.sfx, dir));
    const n = Math.round((c.frame / o.fps) * sr);
    cueSamples.push(n);
    f.push(`[${idx}:a]${fmt},volume=${num(c.gain ?? 1)},adelay=${n}S:all=1[c${i}]`);
    etiquetas.push(`[c${i}]`);
  });

  let sfxLabel: string | null = null;
  if (etiquetas.length > 0) {
    const bus = etiquetas.length === 1 ? `${etiquetas[0]}anull` : `${etiquetas.join('')}amix=inputs=${etiquetas.length}:normalize=0:duration=longest`;
    f.push(`${bus},${fin}[sfx]`);
    sfxLabel = 'sfx';
  }

  let ultimo: string;
  if (musLabel && sfxLabel) {
    const d = o.duck ?? {};
    const ratio = d.ratio ?? 4;
    if (ratio > 1) {
      f.push(`[sfx]asplit=2[sfxa][sfxb]`);
      f.push(`[${musLabel}][sfxa]sidechaincompress=threshold=${num(d.threshold ?? 0.02)}:ratio=${num(ratio)}:attack=${num(d.attackMs ?? 10)}:release=${num(d.releaseMs ?? 250)}:makeup=1[musd]`);
      f.push(`[musd][sfxb]amix=inputs=2:normalize=0:duration=longest[mix]`);
    } else {
      f.push(`[${musLabel}][sfx]amix=inputs=2:normalize=0:duration=longest[mix]`);
    }
    ultimo = 'mix';
  } else ultimo = (musLabel ?? sfxLabel)!;
  f.push(`[${ultimo}]alimiter=limit=0.95:level=disabled,${fin}[out]`);

  return { inputs, filterComplex: f.join(';'), outLabel: 'out', totalSamples, sr, cueSamples, advertencias };
}

/** Renderiza la mezcla a `salida` (el formato lo da la extensión). */
export async function mezclar(o: MezclaOpts & { salida: string }): Promise<PlanMezcla> {
  const plan = planMezcla(o);
  mkdirSync(dirname(o.salida), { recursive: true });
  const args = ['-y'];
  for (const i of plan.inputs) args.push('-i', i);
  args.push('-filter_complex', plan.filterComplex, '-map', `[${plan.outLabel}]`, '-ar', String(plan.sr), '-ac', '2');
  if (extname(o.salida).toLowerCase() === '.wav') args.push('-c:a', 'pcm_s16le');
  args.push(o.salida);
  await runFfmpeg(args);
  return plan;
}

