// CLI de audio: `tsx audio/cli.ts <comando> ...`. Delgada: la lógica vive en los módulos puros.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { leerCortes, leerFase, leerFinal, leerInicio, leerNum, parsear, type RestriccionNum } from './args';
import { empalmar } from './empalme';
import { EFECTOS, generarEfectos, picosDeEfectos } from './efectos';
import { avisoMp3SinEtiqueta, decodificar, hayFfmpeg } from './ffmpeg';
import { mezclar, type Cue } from './mezcla';
import { avisoDeFase, chequearConfianza, pulsoMasCercano, tempoReport, TEMPO_SR, type TempoReport } from './tempo';

const USO = `Uso: tsx audio/cli.ts <comando>

  tempo <archivo> [--fps 30] [--bpm N] [--offset seg] [--fase medio] [--min-bpm 60] [--max-bpm 190] [--out tempo.json]
      Estima BPM, pulsos, entrada de la percusión y cambios de sección. Imprime JSON (o lo guarda con --out).
      --bpm / --offset fuerzan la grilla a mano cuando la estimación falla; --fase medio la corre medio pulso.

  empalme <archivo> --out salida.wav (--frames N --fps F | --segundos S)
          [--inicio percusion|seccion:<n>|<seg>] [--tempo tempo.json | --bpm N --offset seg [--fase medio]]
          [--lazo-inicio seg] [--lazo-fin seg] [--corte-en seg|f<cuadro>[,...]]
          [--final fade|real] [--compas 4] [--cruce 0.04] [--fade 2] [--fade-in 0.3] [--sin-cuerpo]
          [--sr 48000] [--json plan.json]
      Arma una pista de la duración exacta del video con inicio y empalmes sobre pulsos, dentro del
      cuerpo de la pista (sin la intro baja ni la caída final).

  efectos [--out public/sfx] [--lista]
      Sintetiza el set de efectos originales (golpe, clic, barrido, campanita, tilde, aviso).
      --lista muestra cada uno con el instante de su pico (para "ancla": "pico" en un cue).

  mezcla --cues cues.json --fps F --frames N --out audio.wav
         [--sfx public/sfx] [--musica archivo] [--musica-gain 0.6] [--musica-desde seg]
         [--fade-in seg] [--fade-out 1] [--duck-db 5] [--duck-ataque 10] [--duck-release 250]
         [--duck-escala-gain] [--lufs <objetivo>] [--techo -1] [--sr 48000]
      Mezcla efectos (cues: [{"frame":45,"sfx":"clic","gain":1,"ancla":"inicio|pico"}]) y música en un solo archivo.
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
        const fase = leerFase(op);
        const x = await decodificar(resolve(pos[0]), { sr: TEMPO_SR, canales: 1 });
        const avMp3 = avisoMp3SinEtiqueta(pos[0]);
        if (avMp3) console.error('Aviso: ' + avMp3);
        const r: TempoReport = { archivo: pos[0], ...tempoReport(x, num('fps', 30, POS)!, { bpm: num('bpm', undefined, POS), offsetSec: num('offset'), fase, minBpm: num('min-bpm', undefined, POS), maxBpm: num('max-bpm', undefined, POS) }) };
        const avFase = avisoDeFase(r);
        if (avFase) console.error('Aviso: ' + avFase);
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
        const fase = leerFase(op);
        const final = leerFinal(op);
        const cortesEnSec = leerCortes(op, fps);
        const compas = num('compas', undefined, { min: 1, entero: true });
        const cruce = num('cruce', undefined, NOneg);
        const fade = num('fade', undefined, NOneg);
        const fadeIn = num('fade-in', undefined, NOneg);
        const lazoInicio = num('lazo-inicio', undefined, NOneg);
        const lazoFin = num('lazo-fin', undefined, POS);
        if (lazoInicio !== undefined && lazoFin !== undefined && lazoFin <= lazoInicio) throw new Error('--lazo-fin tiene que ser mayor que --lazo-inicio');
        const sr = num('sr', undefined, { min: 8000, entero: true });
        const avMp3 = avisoMp3SinEtiqueta(entrada);
        if (avMp3) console.error('Aviso: ' + avMp3);
        let t: TempoReport;
        if (op.get('tempo')) {
          t = JSON.parse(readFileSync(resolve(op.get('tempo')!), 'utf8')) as TempoReport;
          if (fase) console.error('Aviso: --fase se ignora con --tempo (el JSON ya trae la fase); usalo en el comando tempo.');
        } else {
          const x = await decodificar(entrada, { sr: TEMPO_SR, canales: 1 });
          t = tempoReport(x, fps, { bpm, offsetSec: offset, fase });
          const avFase = avisoDeFase(t);
          if (avFase) console.error('Aviso: ' + avFase);
        }
        const problema = chequearConfianza(t);
        if (problema.error) throw new Error(problema.error);
        if (problema.aviso) console.error('Aviso: ' + problema.aviso);
        const beatsSec = t.beatsSec;
        let startSec: number | undefined;
        if (inicio === 'percusion') {
          if (!t.percussionBeat) throw new Error('No se encontró entrada de percusión; indicá --inicio <seg> o --inicio seccion:<n>');
          startSec = t.percussionBeat.sec;
        } else if (typeof inicio === 'object') {
          const c = t.secciones?.find((q) => q.n === inicio.seccion);
          if (!c) throw new Error(`No hay sección ${inicio.seccion} en el tempo (hay ${t.secciones?.length ?? 0}); mirá "secciones" en la salida de tempo`);
          startSec = pulsoMasCercano(beatsSec, c.sec);
        } else if (inicio !== undefined) startSec = inicio;
        const r = await empalmar({
          entrada, salida, fps, frames, beatsSec, startSec,
          beatsPerBar: compas, crossfadeSec: cruce, fadeOutSec: fade, fadeInSec: fadeIn,
          lazoInicioSec: lazoInicio, lazoFinSec: lazoFin, cortesEnSec, final, sinCuerpo: op.get('sin-cuerpo') !== undefined, sr,
        });
        for (const a of r.plan.avisos) console.error('Aviso: ' + a);
        if (r.headroomDb < 0) console.error(`Aviso: la salida pasaba de 0 dBFS; se bajó ${-r.headroomDb} dB para no recortar.`);
        const res = {
          salida: r.salida, fps, durationFrames: frames, startSec: r.plan.startSec, loopStartSec: r.plan.loopStartSec, loopEndSec: r.plan.loopEndSec,
          final: r.plan.final, silencioFinalSec: r.plan.silencioFinalSec, cuerpo: r.cuerpo, headroomDb: r.headroomDb,
          spliceFrames: r.spliceFrames, beatFrames: r.beatFrames, avisos: r.plan.avisos, plan: r.plan,
        };
        if (op.get('json')) writeFileSync(resolve(op.get('json')!), JSON.stringify(res, null, 2) + '\n');
        console.log(JSON.stringify({ ...res, plan: undefined }, null, 2));
      })();
    case 'efectos': {
      if (op.get('lista') !== undefined) {
        const picos = picosDeEfectos();
        for (const [n, e] of Object.entries(EFECTOS)) console.log(`${n}\t(pico a ${Math.round(picos[n] * 1000)} ms)\t${e.descripcion}`);
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
        // `--duck N` (razón de compresión) era la forma vieja: solo se respeta `--duck 0` (sin ducking).
        const duckViejo = num('duck', undefined, NOneg);
        if (duckViejo !== undefined && duckViejo !== 0) console.error('Aviso: --duck ya no es una razón de compresión; usá --duck-db <dB> (5 por defecto) y --duck 0 o --duck-db 0 para apagarlo.');
        const duck = {
          db: duckViejo === 0 ? 0 : num('duck-db', undefined, NOneg),
          attackMs: num('duck-ataque', undefined, POS),
          releaseMs: num('duck-release', undefined, POS),
          escalaGain: op.get('duck-escala-gain') !== undefined ? true : undefined,
        };
        const lufs = num('lufs');
        const techoDbtp = num('techo');
        if (techoDbtp !== undefined && techoDbtp > 0) throw new Error('--techo es un pico en dBTP y no puede ser positivo (por ejemplo -1)');
        const plan = await mezclar({
          fps, durationFrames: frames, cues, sfxDir: op.get('sfx') ? resolve(op.get('sfx')!) : undefined, sr, salida,
          musica: musica ? { archivo: resolve(musica), ...musicaOpts } : undefined,
          duck, lufs, techoDbtp,
        });
        for (const a of plan.advertencias) console.error('Aviso: ' + a);
        const omitidos = plan.advertencias.filter((a) => a.includes('cae fuera del video')).length;
        console.log(`Mezcla lista: ${salida} (${frames} cuadros a ${fps} fps, ${cues.length - omitidos} cues)`);
        console.log(JSON.stringify({ sonoridadAntesLufs: plan.info.lufsAntes, gananciaLufsDb: plan.info.gananciaLufsDb, reduccionLimitadorDb: plan.info.reduccionLimitadorDb, sonoridadFinalLufs: plan.info.lufsFinal, picoVerdaderoDbtp: plan.info.picoVerdaderoDbtp }));
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
