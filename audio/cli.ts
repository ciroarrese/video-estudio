// CLI de audio: `tsx audio/cli.ts <comando> ...`. Delgada: la lógica vive en los módulos puros.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { leerInicio, leerNum, parsear, type RestriccionNum } from './args';
import { empalmar } from './empalme';
import { EFECTOS, generarEfectos } from './efectos';
import { decodificar, hayFfmpeg } from './ffmpeg';
import { mezclar, type Cue } from './mezcla';
import { chequearConfianza, tempoReport, TEMPO_SR, type TempoReport } from './tempo';

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

function main(): Promise<void> {
  const [cmd, ...resto] = process.argv.slice(2);
  const { pos, op } = parsear(resto);
  const num = (k: string, def?: number, r?: RestriccionNum): number | undefined => leerNum(op, k, def, r);
  // Rangos de las opciones numéricas más usadas.
  const POS = { min: 0, excluyeMin: true };
  const NOneg = { min: 0 };
  const requerida = (k: string): string => {
    const v = op.get(k);
    if (!v) throw new Error(`Falta --${k} (con un valor)`);
    return v;
  };
  const framesYFps = () => {
    const fps = num('fps', 30, POS)!;
    const seg = num('segundos', undefined, POS);
    const frames = seg !== undefined ? Math.round(seg * fps) : num('frames', undefined, { min: 1, entero: true });
    if (frames === undefined) throw new Error('Falta --frames (con --fps) o --segundos');
    if (frames < 1) throw new Error('El video tiene que durar al menos un cuadro');
    return { fps, frames };
  };

  switch (cmd) {
    case 'tempo':
      return (async () => {
        if (!pos[0]) throw new Error('Falta el archivo');
        const x = await decodificar(resolve(pos[0]), { sr: TEMPO_SR, canales: 1 });
        const r: TempoReport = { archivo: pos[0], ...tempoReport(x, num('fps', 30, POS)!, { bpm: num('bpm', undefined, POS), offsetSec: num('offset'), minBpm: num('min-bpm', undefined, POS), maxBpm: num('max-bpm', undefined, POS) }) };
        const txt = JSON.stringify(r, null, 2);
        if (op.get('out')) writeFileSync(resolve(op.get('out')!), txt + '\n');
        else console.log(txt);
      })();
    case 'empalme':
      return (async () => {
        if (!pos[0]) throw new Error('Falta el archivo');
        const entrada = resolve(pos[0]);
        const salida = resolve(requerida('out'));
        const { fps, frames } = framesYFps();
        // Se validan todas las opciones antes de decodificar nada.
        const inicio = leerInicio(op);
        const bpm = num('bpm', undefined, POS);
        const offset = num('offset');
        const compas = num('compas', undefined, { min: 1, entero: true });
        const cruce = num('cruce', undefined, NOneg);
        const fade = num('fade', undefined, NOneg);
        const sr = num('sr', undefined, { min: 8000, entero: true });
        let beatsSec: number[];
        let percBeat: number | undefined;
        if (op.get('tempo')) {
          const t = JSON.parse(readFileSync(resolve(op.get('tempo')!), 'utf8')) as TempoReport;
          const problema = chequearConfianza(t);
          if (problema.error) throw new Error(problema.error);
          if (problema.aviso) console.error('Aviso: ' + problema.aviso);
          beatsSec = t.beatsSec;
          percBeat = t.percussionBeat?.sec;
        } else {
          const x = await decodificar(entrada, { sr: TEMPO_SR, canales: 1 });
          const t = tempoReport(x, fps, { bpm, offsetSec: offset });
          const problema = chequearConfianza(t);
          if (problema.error) throw new Error(problema.error);
          if (problema.aviso) console.error('Aviso: ' + problema.aviso);
          beatsSec = t.beatsSec;
          percBeat = t.percussionBeat?.sec;
        }
        let startSec: number | undefined;
        if (inicio === 'percusion') {
          if (percBeat === undefined) throw new Error('No se encontró entrada de percusión; indicá --inicio <seg>');
          startSec = percBeat;
        } else if (inicio !== undefined) startSec = inicio;
        const r = await empalmar({
          entrada, salida, fps, frames, beatsSec, startSec,
          beatsPerBar: compas, crossfadeSec: cruce, fadeOutSec: fade, sr,
        });
        const res = { salida: r.salida, fps, durationFrames: frames, startSec: r.plan.startSec, loopEndSec: r.plan.loopEndSec, spliceFrames: r.spliceFrames, beatFrames: r.beatFrames, plan: r.plan };
        if (op.get('json')) writeFileSync(resolve(op.get('json')!), JSON.stringify(res, null, 2) + '\n');
        console.log(JSON.stringify({ ...res, plan: undefined, beatFrames: res.beatFrames }, null, 2));
      })();
    case 'efectos': {
      if (op.get('lista')) {
        for (const [n, e] of Object.entries(EFECTOS)) console.log(`${n}\t${e.descripcion}`);
        return Promise.resolve();
      }
      const dir = op.get('out') || 'public/sfx';
      const rutas = generarEfectos(resolve(dir));
      console.log(`Efectos generados en ${dir}:\n${rutas.map((r) => '  ' + r).join('\n')}\nNo se versionan: generalos a pedido.`);
      return Promise.resolve();
    }
    case 'mezcla':
      return (async () => {
        const cues = JSON.parse(readFileSync(resolve(requerida('cues')), 'utf8')) as Cue[];
        if (!Array.isArray(cues)) throw new Error('El archivo de cues tiene que ser una lista');
        const { fps, frames } = framesYFps();
        const musica = op.get('musica');
        const salida = resolve(requerida('out'));
        const sr = num('sr', undefined, { min: 8000, entero: true });
        const musicaOpts = {
          gain: num('musica-gain', undefined, NOneg), desdeSec: num('musica-desde', undefined, NOneg),
          fadeInSec: num('fade-in', undefined, NOneg), fadeOutSec: num('fade-out', undefined, NOneg),
        };
        const duck = op.get('duck') !== undefined ? { ratio: num('duck', undefined, NOneg) } : undefined;
        const plan = await mezclar({
          fps, durationFrames: frames, cues, sfxDir: op.get('sfx') ? resolve(op.get('sfx')!) : undefined, sr, salida,
          musica: musica ? { archivo: resolve(musica), ...musicaOpts } : undefined,
          duck,
        });
        for (const a of plan.advertencias) console.error('Aviso: ' + a);
        console.log(`Mezcla lista: ${salida} (${frames} cuadros a ${fps} fps, ${cues.length - plan.advertencias.length} cues)`);
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
