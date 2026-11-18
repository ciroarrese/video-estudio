// CLI de audio: `tsx audio/cli.ts <comando> ...`. Delgada: la lógica vive en los módulos puros.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { entrada as ent, salida as sal } from './rutas';
import { leerCortes, leerFase, leerGainPorEfecto, leerFinal, leerInicio, leerInstantes, leerListaPositiva, leerNum, leerPistas, leerTramosPropios, parsear, type RestriccionNum } from './args';
import { empalmar } from './empalme';
import { BARRIDOS, BARRIDO_POR_DEFECTO, CLICS, CLIC_POR_DEFECTO, EFECTOS, generarEfectos, nombreDeBarrido, nombreDeClic, picosDeEfectos } from './efectos';
import { decodificar, hayFfmpeg } from './ffmpeg';
import { mezclar, type Cue, type HuecoMusica } from './mezcla';
import { aWavSiMp3 } from './fuentes';
import { cargarVideo, cuesAbsolutos, tramosPropios, unirTramos, type TramoPropio } from './escenas';
import { formatearInforme, informar } from './informe';
import { FADE_HUECO_POR_DEFECTO } from './huecos';
import { ventanasDeVoz, verificarVozEscenas, type TramoDeVoz } from './voz';
import { aJson, aSrt, aVtt, cortesDeEscenas, leerSubtitulosJson, parsearSubtitulos, subtitulosDeGuion, type Subtitulo } from '../kit/subtitulos';
import { avisoDeFase, chequearConfianza, pulsoMasCercano, tempoReport, TEMPO_SR, type TempoReport } from './tempo';

const USO = `Uso: tsx audio/cli.ts <comando>

  tempo <archivo> [--fps 30] [--bpm N] [--offset seg] [--fase medio] [--min-bpm 60] [--max-bpm 190] [--out tempo.json]
      Estima BPM, pulsos, entrada de la percusión y cambios de sección. Imprime JSON (o lo guarda con --out).
      --bpm / --offset fuerzan la grilla a mano cuando la estimación falla; --fase medio la corre medio pulso.

  empalme <archivo> --out salida.wav (--frames N --fps F | --segundos S | --video <id>)
          [--inicio percusion|seccion:<n>|<seg>] [--tempo tempo.json | --bpm N --offset seg [--fase medio]]
          [--lazo-inicio seg] [--lazo-fin seg] [--corte-en seg|f<cuadro>[,...]]
          [--final fade|real] [--compas 4] [--cruce 0.04] [--fade 2] [--fade-in 0.3] [--sin-cuerpo]
          [--sr 48000] [--json plan.json] [--audio-propio 12.5-15,f400-f450]
      Arma una pista de la duración exacta del video con inicio y empalmes sobre pulsos, dentro del
      cuerpo de la pista (sin la intro baja ni la caída final). Informa las pausas propias de la pista
      (silenciosInternos, en segundos del archivo fuente). Un mp3 de entrada se convierte antes a wav.
      Con --video <id> toma el fps del video y, si no pasás --frames ni --segundos, la duración llega hasta el comienzo
      de la primera escena con audio propio (o el final del video si no hay): la música termina antes de esa escena,
      con la caída de --fade. --audio-propio da esos tramos a mano (sin --video).

  efectos [--out public/sfx] [--lista] [--clic <nombre>] [--barrido <nombre>]
      Sintetiza el set de efectos originales (golpe, clic, barrido, campanita, tilde, aviso) y las variantes
      clic-<nombre> (actual, suave, mecanico, madera, cristal, burbuja, digital, thock, cinta y los de mouse:
      mouse, mouse-suave, mouse-marcado, mouse-apretar, mouse-doble).
      --clic elige cuál variante se escribe como "clic" (por defecto actual).
      También barrido-<nombre> (actual, aire, suave, grave, papel): transiciones más suaves que el barrido actual;
      --barrido elige cuál se escribe como "barrido" (por defecto actual).
      --lista muestra cada uno con el instante de su pico (para "ancla": "pico" en un cue) y cada variante de clic.

  mezcla (--cues cues.json | --video <id>) [--fps F --frames N] --out audio.wav
         [--sfx public/sfx] [--musica archivo] [--musica-gain 0.6] [--musica-desde seg] [--musica-bajo-efectos dB]
         [--format vertical] [--audio-propio 12.5-15,f400-f450] [--propio-fade 0.8] [--propio-bajar-db dB] [--propio-termina] [--propio-ignorar]
         [--fade-in seg] [--fade-out 1] [--duck-db 5] [--duck-ataque 10] [--duck-release 250]
         [--duck-escala-gain] [--lufs <objetivo>] [--techo -1] [--sr 48000]
         [--gain barrido=0.4,tilde=0.8]
         [--voz locucion.wav] [--voz-gain 1] [--voz-desde seg] [--voz-en seg] [--voz-duck-db 8]
         [--voz-ataque 60] [--voz-release 450] [--voz-umbral dBFS] [--voz-une 350]
      --gain multiplica el gain de todos los cues de cada efecto nombrado (por el nombre del sfx tal cual); --gain nombre=0 es la manera rápida
      de probar "sin ese sonido" sin tocar la lista de cues.
      --video <id> arma los cues desde las escenas del video (SceneInfo.cues, cuadros relativos a cada escena sumados a su inicio; mismo
      descubrimiento que render, con VE_VIDEOS_DIR) y toma fps y duración del video; se suma a --cues si pasás los dos. Las escenas con
      audioPropio hacen un hueco en la música: baja con una rampa de --propio-fade s (0,8) que termina donde empieza el audio propio y vuelve a
      subir al terminar (--propio-termina: no vuelve; --propio-bajar-db N: baja N dB en vez de callarse; --propio-ignorar: no toca la música).
      --audio-propio da esos tramos a mano. --musica-bajo-efectos N deja la sonoridad integrada de la música N dB bajo la de los efectos (ver docs/audio.md);
      con --lufs el nivel general es el objetivo y la relación se mantiene (con --lufs y --musica-gain avisa: el objetivo manda sobre el nivel de la música).
      Mezcla efectos (cues: [{"frame":45,"sfx":"clic","gain":1,"ancla":"inicio|pico"}]) y música en un solo archivo.
      --voz agrega una pista de locución que aporta la persona (wav o mp3 local, nunca al repo) como capa de la mezcla: entra
      en --voz-en (segundo del video), salta --voz-desde segundos del archivo y baja la música --voz-duck-db dB mientras habla
      (0 lo apaga). --cues es opcional si hay --voz o --musica. --lufs y --techo rigen sobre toda la mezcla, voz incluida.

  informe (--cues cues.json | --video <id>) [--fps F --frames N] [--sfx public/sfx] [--musica archivo ...] [--voz archivo ...]
          [--pista nombre=archivo[@seg],...] [--audio-propio 12.5-15] [--voz-esperada nombre,...] [--silencio-min 1] [--json [archivo]] [--estricto]
      Informe de la mezcla para quien no puede oírla (mismas opciones de mezcla que arriba; no escribe ningún wav): línea de tiempo de pistas y cues,
      margen de cada efecto sobre la música en su instante (sobresale, justo, casi tapado, tapado), silencios, solapamientos (música contra audio propio,
      efectos dentro de audio propio, pistas entre sí) y voz probable en cualquier pista. --json sin valor imprime solo JSON; con un archivo lo escribe.
      --estricto sale con código 2 si hay avisos.

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

  /** Ruta absoluta de una entrada de audio; un mp3 se convierte antes a wav (ver `fuentes.ts`) y se avisa dónde quedó. */
  const audioIn = async (ruta: string): Promise<string> => {
    const c = await aWavSiMp3(ent(ruta));
    if (c.convertido) console.error(`Aviso: "${ruta}" es mp3: se convirtió a wav en ${c.ruta} (se usa el wav en todos los pasos).`);
    return c.ruta;
  };
  /** Video (por `--video <id>`): fps, duración y escenas, como `render --list-scenes`. */
  const cargarElVideo = async () => {
    const id = op.get('video');
    if (!id) throw new Error('--video necesita el id de un video (mirá `npm run render -- --list`)');
    const fmt = op.get('format');
    if (fmt !== undefined && !['horizontal', 'vertical', 'cuadrado'].includes(fmt)) throw new Error(`--format tiene que ser horizontal, vertical o cuadrado (recibió "${fmt}")`);
    let props: Record<string, unknown> | undefined;
    if (op.get('props')) props = JSON.parse(op.get('props')!) as Record<string, unknown>;
    return cargarVideo(id, { format: fmt as 'horizontal' | 'vertical' | 'cuadrado' | undefined, props });
  };

  switch (cmd) {
    case 'tempo':
      return (async () => {
        if (!pos[0]) throw new Error('Falta el archivo');
        const fase = leerFase(op);
        const x = await decodificar(await audioIn(pos[0]), { sr: TEMPO_SR, canales: 1 });
        const r: TempoReport = { archivo: pos[0], ...tempoReport(x, num('fps', 30, POS)!, { bpm: num('bpm', undefined, POS), offsetSec: num('offset'), fase, minBpm: num('min-bpm', undefined, POS), maxBpm: num('max-bpm', undefined, POS) }) };
        const avFase = avisoDeFase(r);
        if (avFase) console.error('Aviso: ' + avFase);
        const txt = JSON.stringify(r, null, 2);
        if (op.get('out')) writeFileSync(sal(op.get('out')!), txt + '\n');
        else console.log(txt);
      })();
    case 'empalme':
      return (async () => {
        if (!pos[0]) throw new Error('Falta el archivo');
        const entrada = await audioIn(pos[0]);
        const salida = sal(requerida('out'));
        // Con --video (o --audio-propio) la música termina donde empieza el primer audio propio; sin duración explícita, esa es la duración.
        let fps: number;
        let frames: number;
        let propios: Array<{ escena: string; desdeSec: number }> = [];
        const duracionExplicita = op.has('frames') || op.has('segundos');
        if (op.has('video')) {
          const v = await cargarElVideo();
          fps = num('fps', v.fps, POS)!;
          if (fps !== v.fps) throw new Error(`--fps ${fps} no coincide con el del video (${v.fps})`);
          propios = tramosPropios(v.scenes, fps).map((t) => ({ escena: t.escena, desdeSec: t.desdeSec }));
          frames = duracionExplicita ? framesYFps().frames : v.durationInFrames;
        } else {
          ({ fps, frames } = duracionExplicita || !op.has('audio-propio') ? framesYFps() : { fps: num('fps', 30, POS)!, frames: 0 });
        }
        for (const t of leerTramosPropios(op, fps) ?? []) propios.push({ escena: 'a mano', desdeSec: t.desdeSec });
        propios.sort((a, b) => a.desdeSec - b.desdeSec);
        if (propios.length > 0) {
          const primero = propios[0]!;
          const finMusica = Math.round(primero.desdeSec * fps);
          if (!duracionExplicita) {
            frames = Math.min(frames || finMusica, finMusica);
            console.error(`Aviso: la música termina en el cuadro ${frames} (${(frames / fps).toFixed(2)} s), donde empieza el audio propio de "${primero.escena}"; la caída es la de --fade. Pasá --frames para otra duración.`);
          } else if (frames > finMusica) console.error(`Aviso: la pista (${frames} cuadros) pasa del comienzo del audio propio de "${primero.escena}" (cuadro ${finMusica}): usá --frames ${finMusica} o bajala en la mezcla (mezcla --video).`);
        }
        if (frames < 1) throw new Error('Falta --frames (con --fps), --segundos o --video');
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
        let t: TempoReport;
        if (op.get('tempo')) {
          t = JSON.parse(readFileSync(ent(op.get('tempo')!), 'utf8')) as TempoReport;
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
        const usadoHasta = r.plan.loopEndSec ?? Infinity;
        const enUso = r.silenciosInternos.filter((q) => q.hasta > r.plan.startSec && q.desde < usadoHasta);
        if (r.silenciosInternos.length > 0) console.error(`Aviso: la pista tiene ${r.silenciosInternos.length} pausa${r.silenciosInternos.length === 1 ? '' : 's'} propia${r.silenciosInternos.length === 1 ? '' : 's'} (${r.silenciosInternos.map((q) => `${q.desde.toFixed(2)}-${q.hasta.toFixed(2)} s`).join(', ')} del archivo fuente)${enUso.length > 0 ? `; ${enUso.length} en el tramo que se usa: si se oye un silencio ahí, es de la pista, no un corte de la mezcla` : ', ninguna en el tramo que se usa'}.`);
        if (r.headroomDb < 0) console.error(`Aviso: la salida pasaba de 0 dBFS; se bajó ${-r.headroomDb} dB para no recortar.`);
        const res = {
          salida: r.salida, fps, durationFrames: frames, startSec: r.plan.startSec, loopStartSec: r.plan.loopStartSec, loopEndSec: r.plan.loopEndSec,
          final: r.plan.final, silencioFinalSec: r.plan.silencioFinalSec, cuerpo: r.cuerpo, headroomDb: r.headroomDb,
          silenciosInternos: r.silenciosInternos, spliceFrames: r.spliceFrames, cortes: r.cortes, beatFrames: r.beatFrames, avisos: r.plan.avisos, plan: r.plan,
        };
        if (op.get('json')) writeFileSync(sal(op.get('json')!), JSON.stringify(res, null, 2) + '\n');
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
      const rutas = generarEfectos(sal(dir), undefined, { clic: clic ?? CLIC_POR_DEFECTO, barrido: barrido ?? BARRIDO_POR_DEFECTO });
      console.log(`Efectos generados en ${dir}${clic ? ` (clic = ${clic})` : ''}${barrido ? ` (barrido = ${barrido})` : ''}:\n${rutas.map((r) => '  ' + r).join('\n')}\nNo se versionan: generalos a pedido.`);
      return Promise.resolve();
    }
    case 'subtitulos':
      return (async () => {
        const fps = num('fps', 30, POS)!;
        let cues: Subtitulo[];
        if (op.has('guion')) {
          const g = JSON.parse(readFileSync(ent(requerida('guion')), 'utf8')) as unknown;
          const escenas = Array.isArray(g) ? g : (g as { escenas?: unknown }).escenas;
          if (!Array.isArray(escenas)) throw new Error('El guion tiene que ser una lista de escenas o { "escenas": [...] } (cada una con "texto" y "frames" o "segundos")');
          const fpsGuion = (g as { fps?: number }).fps ?? fps;
          cues = subtitulosDeGuion(escenas, { fps: fpsGuion, conPalabras: op.has('palabras'), maxCaracteres: num('max-subtitulo', undefined, { min: 10, entero: true }) });
        } else {
          if (!pos[0]) throw new Error('Falta la entrada (.json, .srt o .vtt) o --guion guion.json');
          const archivo = ent(pos[0]);
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
        if (out) escribir(sal(out), como(extname(out).toLowerCase()));
        if (juntoA) {
          const base = join(dirname(sal(juntoA)), basename(juntoA, extname(juntoA)));
          escribir(`${base}.srt`, como('.srt'));
          escribir(`${base}.vtt`, como('.vtt'));
        }
        if (!out && !juntoA) process.stdout.write(aSrt(cues, { maxCaracteres }));
        else console.log(`${cues.length} subtítulos, de ${cues[0]!.desde.toFixed(2)} s a ${cues[cues.length - 1]!.hasta.toFixed(2)} s`);
      })();
    case 'locucion':
      return (async () => {
        const fps = num('fps', 30, POS)!;
        const archivo = ent(requerida('subtitulos'));
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
          const x = await decodificar(ent(op.get('voz')!), { sr, canales: 1 });
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
    case 'informe':
      return (async () => {
        const esInforme = cmd === 'informe';
        const hayVideo = op.has('video');
        const cues: Cue[] = op.has('cues') ? (JSON.parse(readFileSync(ent(requerida('cues')), 'utf8')) as Cue[]) : [];
        if (!Array.isArray(cues)) throw new Error('El archivo de cues tiene que ser una lista');
        if (!hayVideo && !op.has('cues') && !op.has('musica') && !op.has('voz') && !esInforme) throw new Error('Falta --cues, --video, --musica o --voz: no hay nada que mezclar');
        // fps, duración y cues: del video (--video) o de las opciones
        let fps: number;
        let frames: number;
        let escenaDeCue: string[] = cues.map(() => 'cues.json');
        let propios: TramoPropio[] = [];
        const salidaAvisos: string[] = [];
        if (hayVideo) {
          const v = await cargarElVideo();
          fps = num('fps', v.fps, POS)!;
          if (fps !== v.fps) throw new Error(`--fps ${fps} no coincide con el del video (${v.fps})`);
          frames = op.has('frames') || op.has('segundos') ? framesYFps().frames : v.durationInFrames;
          const d = cuesAbsolutos(v.scenes, frames);
          salidaAvisos.push(...d.avisos);
          escenaDeCue = [...escenaDeCue, ...d.escenaDeCue];
          cues.push(...d.cues);
          propios = tramosPropios(v.scenes, fps);
          // los cues de las escenas y los del archivo se ordenan juntos (el informe los numera en ese orden)
          const orden = cues.map((c, i) => ({ c, e: escenaDeCue[i]!, i })).sort((p, q) => p.c.frame - q.c.frame || p.i - q.i);
          cues.splice(0, cues.length, ...orden.map((p) => p.c));
          escenaDeCue = orden.map((p) => p.e);
          console.error(`Video "${v.id}": ${v.scenes.length} escenas, ${d.cues.length} cues de escenas${propios.length ? `, audio propio en ${propios.map((p) => `"${p.escena}"`).join(', ')}` : ''}.`);
        } else {
          ({ fps, frames } = framesYFps());
        }
        for (const t of leerTramosPropios(op, fps) ?? []) propios.push({ escena: 'a mano', desdeFrame: Math.round(t.desdeSec * fps), hastaFrame: Math.round(t.hastaSec * fps), desdeSec: t.desdeSec, hastaSec: t.hastaSec });
        propios.sort((a, b) => a.desdeSec - b.desdeSec);
        const musica = op.get('musica');
        const sr = num('sr', undefined, { min: 8000, entero: true });
        const bajoEfectos = num('musica-bajo-efectos');
        // Huecos de la música por audio propio: salen de las escenas (o de --audio-propio) salvo --propio-ignorar.
        const fadePropio = num('propio-fade', undefined, NOneg);
        const bajarDb = num('propio-bajar-db', undefined, POS);
        let huecos: HuecoMusica[] | undefined;
        if (propios.length > 0 && !op.has('propio-ignorar') && musica) {
          const unidos = unirTramos(propios);
          const termina = op.has('propio-termina');
          huecos = (termina ? unidos.slice(0, 1) : unidos).map((u) => ({ desdeSec: u.desdeSec, ...(termina ? {} : { hastaSec: u.hastaSec }), fadeSec: fadePropio ?? FADE_HUECO_POR_DEFECTO, ...(bajarDb !== undefined ? { bajaDb: bajarDb } : {}) }));
          console.error(`Música: ${bajarDb !== undefined ? `baja ${bajarDb} dB` : 'se calla'} antes de ${unidos.map((u) => `${u.desdeSec.toFixed(2)} s (${u.escenas.join(', ')})`).join(', ')} con una rampa de ${(fadePropio ?? FADE_HUECO_POR_DEFECTO).toFixed(2)} s${termina ? ' y no vuelve' : ' y vuelve al terminar'}.`);
        }
        const musicaOpts = {
          gain: num('musica-gain', undefined, NOneg), desdeSec: num('musica-desde', undefined, NOneg),
          fadeInSec: num('fade-in', undefined, NOneg), fadeOutSec: num('fade-out', undefined, NOneg),
          bajoEfectosDb: bajoEfectos, huecos,
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
              archivo: await audioIn(voz), gain: num('voz-gain', undefined, NOneg), desdeSec: num('voz-desde', undefined, NOneg), enSec: num('voz-en', undefined, NOneg),
              duckDb: num('voz-duck-db', undefined, NOneg), duckAtaqueMs: num('voz-ataque', undefined, POS), duckReleaseMs: num('voz-release', undefined, POS),
              umbralDb: num('voz-umbral'), uneMs: num('voz-une', undefined, NOneg),
            }
          : undefined;
        const comun = {
          gainPorEfecto, voz: vozOpts, fps, durationFrames: frames, cues, sfxDir: op.get('sfx') ? ent(op.get('sfx')!) : undefined, sr,
          musica: musica ? { archivo: await audioIn(musica), ...musicaOpts } : undefined,
          duck, lufs, techoDbtp,
        };
        for (const a of salidaAvisos) console.error('Aviso: ' + a);
        if (esInforme) {
          const pistas = (leerPistas(op) ?? []).map((p) => ({ nombre: p.nombre, archivo: ent(p.archivo), enSec: p.enSec }));
          const informe = await informar({
            ...comun, pistas, escenaDeCue, silencioMinSec: num('silencio-min', undefined, POS),
            propios: propios.map((p) => ({ escena: p.escena, desdeSec: p.desdeSec, hastaSec: p.hastaSec })),
            vozEsperada: op.get('voz-esperada') ? op.get('voz-esperada')!.split(',').map((x) => x.trim()).filter(Boolean) : undefined,
          });
          const json = JSON.stringify(informe, null, 2);
          const j = op.get('json');
          if (j === '') console.log(json);
          else {
            if (j) {
              mkdirSync(dirname(sal(j)), { recursive: true });
              writeFileSync(sal(j), json + '\n');
            }
            console.log(formatearInforme(informe));
          }
          if (informe.avisos.length > 0 && op.has('estricto')) process.exitCode = 2;
          return;
        }
        const salida = sal(requerida('out'));
        const plan = await mezclar({ ...comun, salida });
        for (const a of plan.advertencias) console.error('Aviso: ' + a);
        const omitidos = plan.advertencias.filter((a) => a.includes('cae fuera del video')).length;
        console.log(`Mezcla lista: ${salida} (${frames} cuadros a ${fps} fps, ${cues.length - omitidos} cues)`);
        if (vozOpts) console.log(`Voz: ${plan.info.tramosVozSec.length} tramos detectados${plan.info.tramosVozSec.length ? ` (${plan.info.tramosVozSec.map((t) => `${t.desde.toFixed(2)}-${t.hasta.toFixed(2)} s`).join(', ')})` : ''}; la música baja ${vozOpts.duckDb ?? 8} dB mientras habla.`);
        const rel = plan.info.relacionMusicaEfectos;
        if (rel) console.log(`Música ${rel.pedidoDb} dB bajo los efectos: música ${rel.lufsMusica} LUFS, efectos ${rel.lufsEfectos} LUFS (ganancia de la música ${rel.gananciaMusicaDb} dB).`);
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
