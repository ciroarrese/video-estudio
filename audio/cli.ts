// CLI de audio: `tsx audio/cli.ts <comando> ...`. Delgada: la lógica vive en los módulos puros.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { leerCortes, leerFase, leerGainPorEfecto, leerFinal, leerInicio, leerInstantes, leerListaPositiva, leerNum, parsear, type RestriccionNum } from './args';
import { empalmar } from './empalme';
import { BARRIDOS, BARRIDO_POR_DEFECTO, CLICS, CLIC_POR_DEFECTO, EFECTOS, generarEfectos, nombreDeBarrido, nombreDeClic, picosDeEfectos } from './efectos';
import { avisoMp3SinEtiqueta, decodificar, hayFfmpeg } from './ffmpeg';
import { mezclar, type Cue } from './mezcla';
import { ventanasDeVoz, verificarVozEscenas, type TramoDeVoz } from './voz';
import { aJson, aSrt, aVtt, cortesDeEscenas, leerSubtitulosJson, parsearSubtitulos, subtitulosDeGuion, type Subtitulo } from '../kit/subtitulos';
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

  efectos [--out public/sfx] [--lista] [--clic <nombre>] [--barrido <nombre>]
      Sintetiza el set de efectos originales (golpe, clic, barrido, campanita, tilde, aviso) y las variantes
      clic-<nombre> (actual, suave, mecanico, madera, cristal, burbuja, digital, thock, cinta y los de mouse:
      mouse, mouse-suave, mouse-marcado, mouse-apretar, mouse-doble).
      --clic elige cuál variante se escribe como "clic" (por defecto actual).
      También barrido-<nombre> (actual, aire, suave, grave, papel): transiciones más suaves que el barrido actual;
      --barrido elige cuál se escribe como "barrido" (por defecto actual).
      --lista muestra cada uno con el instante de su pico (para "ancla": "pico" en un cue) y cada variante de clic.

  mezcla --cues cues.json --fps F --frames N --out audio.wav
         [--sfx public/sfx] [--musica archivo] [--musica-gain 0.6] [--musica-desde seg]
         [--fade-in seg] [--fade-out 1] [--duck-db 5] [--duck-ataque 10] [--duck-release 250]
         [--duck-escala-gain] [--lufs <objetivo>] [--techo -1] [--sr 48000]
         [--gain barrido=0.4,tilde=0.8]
         [--voz locucion.wav] [--voz-gain 1] [--voz-desde seg] [--voz-en seg] [--voz-duck-db 8]
         [--voz-ataque 60] [--voz-release 450] [--voz-umbral dBFS] [--voz-une 350]
      --gain multiplica el gain de todos los cues de cada efecto nombrado (por el nombre del sfx tal cual).
      Mezcla efectos (cues: [{"frame":45,"sfx":"clic","gain":1,"ancla":"inicio|pico"}]) y música en un solo archivo.
      --voz agrega una pista de locución que aporta la persona (wav o mp3 local, nunca al repo) como capa de la mezcla: entra
      en --voz-en (segundo del video), salta --voz-desde segundos del archivo y baja la música --voz-duck-db dB mientras habla
      (0 lo apaga). --cues es opcional si hay --voz o --musica. --lufs y --techo rigen sobre toda la mezcla, voz incluida.

  subtitulos <entrada.json|.srt|.vtt> | --guion guion.json  [--fps 30] [--out salida.srt|.vtt|.json] [--junto-a out/video.mp4]
             [--palabras] [--max-car 42] [--max-subtitulo 84]
      Convierte y exporta subtítulos. La entrada es un JSON { desde, hasta, texto } (segundos, o cuadros con "unidad":"cuadros"),
      un SRT o un VTT. --guion arma los subtítulos desde el guion ([{ "texto": "...", "frames": 150 }, ...] o
      { "fps": 30, "escenas": [...] }), repartiendo el tiempo de cada escena por cantidad de palabras.
      --out escribe un solo archivo (el formato lo da la extensión); --junto-a out/video.mp4 escribe video.srt y video.vtt al lado
      del mp4. --palabras agrega tiempos por palabra (VTT con etiquetas de karaoke; JSON). --max-car es el largo de cada renglón de los
      archivos (42) y --max-subtitulo el de cada subtítulo que arma --guion (84). Sin salida, imprime el SRT.

  locucion --subtitulos subs.json|.srt|.vtt (--cortes 5,f300 | --escenas 150,120,30 | --escenas-seg 5,4,1)
           [--fps 30] [--frames N | --segundos S] [--tolerancia 0.25] [--max-cps 17] [--estricto]
           [--voz locucion.wav [--voz-en seg --voz-desde seg --voz-umbral dBFS --voz-une 350]]
      Avisa si una frase cruza o roza un corte de escena, si dos se pisan, si pasan del final o si se leen demasiado rápido.
      --escenas / --escenas-seg dan la duración de cada escena (los cortes salen de sumarlas). Con --voz también revisa los
      tramos donde HAY voz en la pista. Con --estricto sale con código 2 si hay algún aviso.
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
          spliceFrames: r.spliceFrames, cortes: r.cortes, beatFrames: r.beatFrames, avisos: r.plan.avisos, plan: r.plan,
        };
        if (op.get('json')) writeFileSync(resolve(op.get('json')!), JSON.stringify(res, null, 2) + '\n');
        console.log(JSON.stringify({ ...res, plan: undefined }, null, 2));
      })();
    case 'efectos': {
      if (op.get('lista') !== undefined) {
        const picos = picosDeEfectos();
        for (const [n, e] of Object.entries(EFECTOS)) console.log(`${n}\t(pico a ${Math.round(picos[n] * 1000)} ms)\t${e.descripcion}`);
        for (const [n, c] of Object.entries(CLICS)) console.log(`${nombreDeClic(n)}\t${c.descripcion} ${c.cuando}`);
        for (const [n, b] of Object.entries(BARRIDOS)) console.log(`${nombreDeBarrido(n)}\t${b.descripcion} ${b.cuando} (gain recomendado ${b.gainRecomendado})`);
        return Promise.resolve();
      }
      const dir = op.get('out') || 'public/sfx';
      const clic = op.get('clic');
      if (op.has('clic') && !clic) throw new Error(`Falta el valor de --clic; las opciones son: ${Object.keys(CLICS).join(', ')}`);
      const barrido = op.get('barrido');
      if (op.has('barrido') && !barrido) throw new Error(`Falta el valor de --barrido; las opciones son: ${Object.keys(BARRIDOS).join(', ')}`);
      const rutas = generarEfectos(resolve(dir), undefined, { clic: clic ?? CLIC_POR_DEFECTO, barrido: barrido ?? BARRIDO_POR_DEFECTO });
      console.log(`Efectos generados en ${dir}${clic ? ` (clic = ${clic})` : ''}${barrido ? ` (barrido = ${barrido})` : ''}:\n${rutas.map((r) => '  ' + r).join('\n')}\nNo se versionan: generalos a pedido.`);
      return Promise.resolve();
    }
    case 'subtitulos':
      return (async () => {
        const fps = num('fps', 30, POS)!;
        let cues: Subtitulo[];
        if (op.has('guion')) {
          const g = JSON.parse(readFileSync(resolve(requerida('guion')), 'utf8')) as unknown;
          const escenas = Array.isArray(g) ? g : (g as { escenas?: unknown }).escenas;
          if (!Array.isArray(escenas)) throw new Error('El guion tiene que ser una lista de escenas o { "escenas": [...] } (cada una con "texto" y "frames" o "segundos")');
          const fpsGuion = (g as { fps?: number }).fps ?? fps;
          cues = subtitulosDeGuion(escenas, { fps: fpsGuion, conPalabras: op.has('palabras'), maxCaracteres: num('max-subtitulo', undefined, { min: 10, entero: true }) });
        } else {
          if (!pos[0]) throw new Error('Falta la entrada (.json, .srt o .vtt) o --guion guion.json');
          const archivo = resolve(pos[0]);
          const txt = readFileSync(archivo, 'utf8');
          cues = extname(archivo).toLowerCase() === '.json' ? leerSubtitulosJson(JSON.parse(txt) as unknown, fps) : parsearSubtitulos(txt);
        }
        if (cues.length === 0) throw new Error('No hay subtítulos en la entrada');
        const maxCaracteres = num('max-car', undefined, { min: 10, entero: true });
        const conPalabras = op.has('palabras');
        const escribir = (ruta: string, contenido: string) => {
          mkdirSync(dirname(ruta), { recursive: true });
          writeFileSync(ruta, contenido);
          console.log(`Escrito: ${ruta}`);
        };
        const como = (ext: string): string => {
          if (ext === '.srt') return aSrt(cues, { maxCaracteres });
          if (ext === '.vtt') return aVtt(cues, { maxCaracteres, conPalabras });
          if (ext === '.json') return aJson(cues);
          throw new Error(`--out: la extensión "${ext}" no es .srt, .vtt ni .json`);
        };
        const juntoA = op.get('junto-a');
        const out = op.get('out');
        if (op.has('junto-a') && !juntoA) throw new Error('--junto-a necesita la ruta del mp4 (por ejemplo --junto-a out/mi-video.mp4)');
        if (out) escribir(resolve(out), como(extname(out).toLowerCase()));
        if (juntoA) {
          const base = join(dirname(resolve(juntoA)), basename(juntoA, extname(juntoA)));
          escribir(`${base}.srt`, como('.srt'));
          escribir(`${base}.vtt`, como('.vtt'));
        }
        if (!out && !juntoA) process.stdout.write(aSrt(cues, { maxCaracteres }));
        else console.log(`${cues.length} subtítulos, de ${cues[0]!.desde.toFixed(2)} s a ${cues[cues.length - 1]!.hasta.toFixed(2)} s`);
      })();
    case 'locucion':
      return (async () => {
        const fps = num('fps', 30, POS)!;
        const archivo = resolve(requerida('subtitulos'));
        const txt = readFileSync(archivo, 'utf8');
        const cues = extname(archivo).toLowerCase() === '.json' ? leerSubtitulosJson(JSON.parse(txt) as unknown, fps) : parsearSubtitulos(txt);
        let cortes = leerInstantes(op, 'cortes', fps) ?? [];
        const escF = leerListaPositiva(op, 'escenas');
        const escS = leerListaPositiva(op, 'escenas-seg');
        if (escF && escS) throw new Error('Pasá --escenas (cuadros) o --escenas-seg (segundos), no las dos');
        if (escF) cortes = cortes.concat(cortesDeEscenas(escF.map((n) => n / fps)));
        if (escS) cortes = cortes.concat(cortesDeEscenas(escS));
        if (cortes.length === 0) console.error('Aviso: no hay cortes de escena (--cortes, --escenas o --escenas-seg): solo se revisan solapes, final y lectura.');
        const seg = num('segundos', undefined, POS);
        const fr = num('frames', undefined, { min: 1, entero: true });
        const duracionSec = seg ?? (fr !== undefined ? fr / fps : escF ? escF.reduce((a, b) => a + b, 0) / fps : escS ? escS.reduce((a, b) => a + b, 0) : undefined);
        const opts = { toleranciaSec: num('tolerancia', undefined, NOneg), duracionSec, maxCps: num('max-cps', undefined, NOneg) };
        const avisos = verificarVozEscenas(cues.map((c): TramoDeVoz => ({ desde: c.desde, hasta: c.hasta, texto: c.texto })), cortes, opts);
        if (op.get('voz')) {
          const sr = 16000;
          const x = await decodificar(resolve(op.get('voz')!), { sr, canales: 1 });
          const enSec = num('voz-en', 0, NOneg)!;
          const desdeSec = num('voz-desde', 0, NOneg)!;
          const tramos = ventanasDeVoz(x.subarray(Math.round(desdeSec * sr)), sr, { umbralDb: num('voz-umbral'), uneMs: num('voz-une', undefined, NOneg) }).map((t): TramoDeVoz => ({ desde: enSec + t.iniSample / sr, hasta: enSec + t.finSample / sr }));
          console.log(`Voz detectada: ${tramos.length} tramos (${tramos.map((t) => `${t.desde.toFixed(2)}-${t.hasta.toFixed(2)}`).join(', ')})`);
          avisos.push(...verificarVozEscenas(tramos, cortes, { toleranciaSec: opts.toleranciaSec, duracionSec, maxCps: 0 }).map((a) => ({ ...a, mensaje: `Voz: ${a.mensaje}` })));
        }
        for (const a of avisos) console.log(`Aviso [${a.tipo}]: ${a.mensaje}`);
        console.log(avisos.length === 0 ? `Sin avisos: ${cues.length} subtítulos, ${cortes.length} cortes.` : `${avisos.length} aviso${avisos.length === 1 ? '' : 's'}.`);
        if (avisos.length > 0 && op.has('estricto')) process.exitCode = 2;
      })();
    case 'mezcla':
      return (async () => {
        const cues = (op.has('cues') ? JSON.parse(readFileSync(resolve(requerida('cues')), 'utf8')) : []) as Cue[];
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
        const gainPorEfecto = leerGainPorEfecto(op);
        const voz = op.get('voz');
        if (op.has('voz') && !voz) throw new Error('--voz necesita la ruta de la pista de locución (wav o mp3)');
        const vozOpts = voz
          ? {
              archivo: resolve(voz), gain: num('voz-gain', undefined, NOneg), desdeSec: num('voz-desde', undefined, NOneg), enSec: num('voz-en', undefined, NOneg),
              duckDb: num('voz-duck-db', undefined, NOneg), duckAtaqueMs: num('voz-ataque', undefined, POS), duckReleaseMs: num('voz-release', undefined, POS),
              umbralDb: num('voz-umbral'), uneMs: num('voz-une', undefined, NOneg),
            }
          : undefined;
        const plan = await mezclar({
          gainPorEfecto, voz: vozOpts, fps, durationFrames: frames, cues, sfxDir: op.get('sfx') ? resolve(op.get('sfx')!) : undefined, sr, salida,
          musica: musica ? { archivo: resolve(musica), ...musicaOpts } : undefined,
          duck, lufs, techoDbtp,
        });
        for (const a of plan.advertencias) console.error('Aviso: ' + a);
        const omitidos = plan.advertencias.filter((a) => a.includes('cae fuera del video')).length;
        console.log(`Mezcla lista: ${salida} (${frames} cuadros a ${fps} fps, ${cues.length - omitidos} cues)`);
        if (vozOpts) console.log(`Voz: ${plan.info.tramosVozSec.length} tramos detectados${plan.info.tramosVozSec.length ? ` (${plan.info.tramosVozSec.map((t) => `${t.desde.toFixed(2)}-${t.hasta.toFixed(2)} s`).join(', ')})` : ''}; la música baja ${vozOpts.duckDb ?? 8} dB mientras habla.`);
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
Promise.resolve().then(main).catch((e: unknown) => {
  console.error('Error: ' + (e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
