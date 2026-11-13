// CLI de audio: `tsx audio/cli.ts <comando> ...`. Delgada: la lógica vive en los módulos puros.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { empalmar } from './empalme';
import { EFECTOS, generarEfectos } from './efectos';
import { decodificar, hayFfmpeg } from './ffmpeg';
import { mezclar, type Cue } from './mezcla';
import { tempoReport, TEMPO_SR, type TempoReport } from './tempo';

const USO = `Uso: tsx audio/cli.ts <comando>

  tempo <archivo> [--fps 30] [--bpm N] [--offset seg] [--min-bpm 60] [--max-bpm 190] [--out tempo.json]
      Estima BPM, pulsos y entrada de la percusión. Imprime JSON (o lo guarda con --out).
      --bpm / --offset fuerzan la grilla a mano cuando la estimación falla.

  empalme <archivo> --out salida.wav (--frames N --fps F | --segundos S)
          [--inicio percusion|<seg>] [--tempo tempo.json | --bpm N --offset seg]
          [--compas 4] [--cruce 0.04] [--fade 2] [--sr 48000] [--json plan.json]
      Arma una pista de la duración exacta del video con inicio y empalmes sobre pulsos.

  efectos [--out public/sfx] [--lista]
      Sintetiza el set de efectos originales (golpe, clic, barrido, campanita, tilde, aviso).

  mezcla --cues cues.json --fps F --frames N --out audio.wav
         [--sfx public/sfx] [--musica archivo] [--musica-gain 0.6] [--musica-desde seg]
         [--fade-in seg] [--fade-out 1] [--duck 4] [--sr 48000]
      Mezcla efectos (cues: [{"frame":45,"sfx":"clic","gain":1}]) y música en un solo archivo.
`;

function parsear(argv: string[]): { pos: string[]; op: Map<string, string> } {
  const pos: string[] = [];
  const op = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const sig = argv[i + 1];
      if (sig === undefined || sig.startsWith('--')) op.set(a.slice(2), 'true');
      else {
        op.set(a.slice(2), sig);
        i++;
      }
    } else pos.push(a);
  }
  return { pos, op };
}

function main(): Promise<void> {
  const [cmd, ...resto] = process.argv.slice(2);
  const { pos, op } = parsear(resto);
  const num = (k: string, def?: number): number | undefined => {
    const v = op.get(k);
    if (v === undefined) return def;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`--${k} tiene que ser un número (recibió "${v}")`);
    return n;
  };
  const requerida = (k: string): string => {
    const v = op.get(k);
    if (!v) throw new Error(`Falta --${k}`);
    return v;
  };
  const framesYFps = () => {
    const fps = num('fps', 30)!;
    const seg = num('segundos');
    const frames = seg !== undefined ? Math.round(seg * fps) : num('frames');
    if (frames === undefined) throw new Error('Falta --frames (con --fps) o --segundos');
    return { fps, frames };
  };

  switch (cmd) {
    case 'tempo':
      return (async () => {
        if (!pos[0]) throw new Error('Falta el archivo');
        const x = await decodificar(resolve(pos[0]), { sr: TEMPO_SR, canales: 1 });
        const r: TempoReport = { archivo: pos[0], ...tempoReport(x, num('fps', 30)!, { bpm: num('bpm'), offsetSec: num('offset'), minBpm: num('min-bpm'), maxBpm: num('max-bpm') }) };
        const txt = JSON.stringify(r, null, 2);
        if (op.get('out')) writeFileSync(op.get('out')!, txt + '\n');
        else console.log(txt);
      })();
    case 'empalme':
      return (async () => {
        if (!pos[0]) throw new Error('Falta el archivo');
        const entrada = resolve(pos[0]);
        const salida = requerida('out');
        const { fps, frames } = framesYFps();
        let beatsSec: number[];
        let percBeat: number | undefined;
        if (op.get('tempo')) {
          const t = JSON.parse(readFileSync(op.get('tempo')!, 'utf8')) as TempoReport;
          beatsSec = t.beatsSec;
          percBeat = t.percussionBeat?.sec;
        } else {
          const x = await decodificar(entrada, { sr: TEMPO_SR, canales: 1 });
          const t = tempoReport(x, fps, { bpm: num('bpm'), offsetSec: num('offset') });
          beatsSec = t.beatsSec;
          percBeat = t.percussionBeat?.sec;
          if (!t.manual && t.confidence < 0.3) console.error(`Aviso: confianza baja (${t.confidence}); revisá el BPM o forzalo con --bpm y --offset`);
        }
        const inicio = op.get('inicio');
        let startSec: number | undefined;
        if (inicio === 'percusion') {
          if (percBeat === undefined) throw new Error('No se encontró entrada de percusión; indicá --inicio <seg>');
          startSec = percBeat;
        } else if (inicio !== undefined) startSec = Number(inicio);
        const r = await empalmar({
          entrada, salida, fps, frames, beatsSec, startSec,
          beatsPerBar: num('compas'), crossfadeSec: num('cruce'), fadeOutSec: num('fade'), sr: num('sr'),
        });
        const res = { salida: r.salida, fps, durationFrames: frames, startSec: r.plan.startSec, loopEndSec: r.plan.loopEndSec, spliceFrames: r.spliceFrames, beatFrames: r.beatFrames, plan: r.plan };
        if (op.get('json')) writeFileSync(op.get('json')!, JSON.stringify(res, null, 2) + '\n');
        console.log(JSON.stringify({ ...res, plan: undefined, beatFrames: res.beatFrames }, null, 2));
      })();
    case 'efectos': {
      if (op.get('lista')) {
        for (const [n, e] of Object.entries(EFECTOS)) console.log(`${n}\t${e.descripcion}`);
        return Promise.resolve();
      }
      const dir = op.get('out') ?? 'public/sfx';
      const rutas = generarEfectos(resolve(dir));
      console.log(`Efectos generados en ${dir}:\n${rutas.map((r) => '  ' + r).join('\n')}\nNo se versionan: generalos a pedido.`);
      return Promise.resolve();
    }
    case 'mezcla':
      return (async () => {
        const cues = JSON.parse(readFileSync(requerida('cues'), 'utf8')) as Cue[];
        if (!Array.isArray(cues)) throw new Error('El archivo de cues tiene que ser una lista');
        const { fps, frames } = framesYFps();
        const musica = op.get('musica');
        const plan = await mezclar({
          fps, durationFrames: frames, cues, sfxDir: op.get('sfx'), sr: num('sr'), salida: requerida('out'),
          musica: musica ? { archivo: musica, gain: num('musica-gain'), desdeSec: num('musica-desde'), fadeInSec: num('fade-in'), fadeOutSec: num('fade-out') } : undefined,
          duck: op.get('duck') !== undefined ? { ratio: num('duck') } : undefined,
        });
        for (const a of plan.advertencias) console.error('Aviso: ' + a);
        console.log(`Mezcla lista: ${op.get('out')} (${frames} cuadros a ${fps} fps, ${cues.length - plan.advertencias.length} cues)`);
      })();
    default:
      console.log(USO);
      return Promise.resolve();
  }
}

if (!hayFfmpeg()) {
  console.error('No se encontró ffmpeg en el PATH.');
  process.exit(1);
}
main().catch((e: unknown) => {
  console.error('Error: ' + (e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
