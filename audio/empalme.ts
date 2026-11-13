// Empalme al compás: recorta o repite una pista en compases enteros para que dure exactamente
// lo que el video, con el inicio y cada empalme sobre un pulso. El planificador es puro;
// `renderizarPlan` mezcla PCM en memoria (sin ffmpeg) y `empalmar` conecta con archivos.
import { detectarCuerpo, type Cuerpo } from './cuerpo';
import { codificar, decodificar } from './ffmpeg';

export interface PlanOpts {
  /** Pulsos de la pista original, en segundos, ascendentes. */
  beatsSec: readonly number[];
  trackDurSec: number;
  targetSec: number;
  /** Segundo desde el que arrancar (se ajusta al pulso más cercano). Por defecto, el primer pulso. */
  startSec?: number;
  beatsPerBar?: number;
  crossfadeSec?: number;
  fadeOutSec?: number;
  /**
   * Cuerpo de la pista (ver `detectarCuerpo`): el lazo se arma dentro de este tramo, sin la intro
   * baja ni la caída final. Sin esto se usa la pista entera (como antes).
   */
  cuerpo?: { inicioSec: number; finSec: number };
  /** Segundo de la pista donde empieza el lazo (se ajusta al compás más cercano contando desde el pulso de inicio). */
  lazoInicioSec?: number;
  /** Segundo de la pista donde termina el lazo (se ajusta al compás más cercano). */
  lazoFinSec?: number;
  /** Segundos de salida donde conviene poner un empalme (por ejemplo un cambio de escena): se ubica en el compás más cercano. */
  cortesEnSec?: readonly number[];
  /** Entrada gradual al arrancar. Por defecto 0,3 s si el inicio no es el comienzo del archivo y 0 si lo es. */
  fadeInSec?: number;
  /**
   * `fade` (por defecto): el video termina con una caída artificial (`fadeOutSec`).
   * `real`: la pista termina con su propio final (la cola se toca al último) si cabe en un compás.
   */
  final?: 'fade' | 'real';
}

export interface Segmento {
  /** Instante de la pista donde arranca el tramo y duración que ocupa en la salida (sin contar el cruce). */
  srcStart: number;
  outStart: number;
  lenSec: number;
}

export interface Plan {
  startSec: number;
  startBeatIndex: number;
  beatsPerBar: number;
  targetSec: number;
  /** Donde arranca el tramo repetido (igual a `startSec` si no hay intro aparte); null si alcanzó con recortar. */
  loopStartSec: number | null;
  /** Tramo repetido: [loopStartSec, loopEndSec]; null si alcanzó con recortar. */
  loopEndSec: number | null;
  segments: Segmento[];
  /** Empalmes: instante de salida (siempre sobre un pulso) y cruce efectivo. */
  splices: { outSec: number; crossfadeSec: number }[];
  fadeIn: { durSec: number };
  fadeOut: { startSec: number; durSec: number };
  /** `real`: la salida termina con el final de la pista. */
  final: 'fade' | 'real';
  /** Con `final: real`, segundos de silencio entre el fin de la pista y el fin del video (menos de un compás). */
  silencioFinalSec: number;
  /** Pulsos en tiempo de salida. */
  outBeatsSec: number[];
  avisos: string[];
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

export function planEmpalme(o: PlanOpts): Plan {
  const { beatsSec, trackDurSec, targetSec } = o;
  const B = o.beatsPerBar ?? 4;
  const cf0 = o.crossfadeSec ?? 0.04;
  const avisos: string[] = [];
  if (targetSec <= 0) throw new Error('La duración objetivo tiene que ser positiva');
  const beats = beatsSec.filter((t) => t >= 0 && t <= trackDurSec);
  if (beats.length < 2) throw new Error('Hacen falta al menos 2 pulsos dentro de la pista');

  const masCercano = (idx: readonly number[], t: number): number => idx.reduce((m, i) => (Math.abs(beats[i] - t) < Math.abs(beats[m] - t) ? i : m), idx[0]);

  let s = 0;
  if (o.startSec !== undefined) {
    for (let i = 1; i < beats.length; i++) if (Math.abs(beats[i] - o.startSec) < Math.abs(beats[s] - o.startSec)) s = i;
  }
  const t0 = beats[s];
  const fadeDur = Math.min(o.fadeOutSec ?? 2, targetSec);
  const fadeIn = { durSec: r6(Math.min(o.fadeInSec ?? (t0 > 0.1 ? 0.3 : 0), targetSec)) };
  const final = o.final ?? 'fade';

  const sinRepetir = targetSec <= trackDurSec - t0 + 1e-9;
  let segments: Segmento[];
  const splices: Plan['splices'] = [];
  let loopStartSec: number | null = null;
  let loopEndSec: number | null = null;
  let fadeOut = { startSec: r6(targetSec - fadeDur), durSec: r6(fadeDur) };
  let silencioFinalSec = 0;

  if (sinRepetir) {
    segments = [{ srcStart: t0, outStart: 0, lenSec: targetSec }];
  } else {
    // Compases enteros desde el pulso de inicio; si no hay ninguno, de a un pulso (como antes).
    let paso = B;
    // Pulsos donde puede terminar el lazo: dejan margen para el cruce y, si `enCuerpo`, caen antes de la caída final.
    const candidatosFin = (desde: number, p: number, enCuerpo: boolean): number[] => {
      const c: number[] = [];
      for (let i = desde + p; i < beats.length; i += p) {
        if (beats[i] + cf0 / 2 <= trackDurSec && (!enCuerpo || o.cuerpo === undefined || beats[i] <= o.cuerpo.finSec + 1e-9)) c.push(i);
      }
      return c;
    };
    // Inicio del lazo: el compás más cercano a `lazoInicioSec`; si no hay, el primero del cuerpo (la intro baja suena una sola vez).
    const compases = (p: number): number[] => {
      const c: number[] = [];
      for (let i = s; i < beats.length; i += p) c.push(i);
      return c;
    };
    const elegirLazo = (p: number): { a: number; e: number } | null => {
      let a = s;
      if (o.lazoInicioSec !== undefined) a = masCercano(compases(p), o.lazoInicioSec);
      else if (o.cuerpo && o.cuerpo.inicioSec > t0 + 0.05) {
        const dentro = compases(p).filter((i) => beats[i] >= o.cuerpo!.inicioSec - 0.05);
        if (dentro.length) a = dentro[0];
      }
      let cand = candidatosFin(a, p, o.lazoFinSec === undefined);
      if (cand.length === 0 && a !== s) {
        a = s;
        cand = candidatosFin(a, p, o.lazoFinSec === undefined);
      }
      if (cand.length === 0 && o.cuerpo && o.lazoFinSec === undefined) {
        // El cuerpo es más corto que un compás desde ese pulso: se usa la pista entera.
        cand = candidatosFin(a, p, false);
        if (cand.length) avisos.push('El cuerpo de la pista no alcanza para un lazo desde ese pulso: el lazo incluye la caída final.');
      }
      if (cand.length === 0) return null;
      const e = o.lazoFinSec !== undefined ? masCercano(cand, o.lazoFinSec) : cand[cand.length - 1];
      return { a, e };
    };
    let lazo = elegirLazo(B);
    if (!lazo) {
      paso = 1;
      lazo = elegirLazo(1);
    }
    if (!lazo) throw new Error('La pista no tiene un tramo completo para repetir desde ese pulso');
    const { a, e } = lazo;
    const t1 = beats[e];
    loopStartSec = beats[a];
    loopEndSec = t1;
    const L = t1 - beats[a];
    const cf = Math.max(0, Math.min(cf0, 2 * beats[a], 2 * (trackDurSec - t1)));
    const cfEfectivo = cf < 0.002 ? 0 : cf;
    const cola = trackDurSec - t1;
    const real = final === 'real';
    if (o.cuerpo && o.cuerpo.finSec < trackDurSec - 0.5 && !real && t1 > o.cuerpo.finSec + 0.5) avisos.push('El lazo termina dentro de la caída final de la pista.');

    segments = [];
    const cortes = [...(o.cortesEnSec ?? [])].sort((x, y) => x - y);
    let ci = s;
    let out = 0;
    let ini = { src: s, out: 0 };
    const cerrar = (hasta: number) => {
      segments.push({ srcStart: beats[ini.src], outStart: r6(ini.out), lenSec: r6(hasta - ini.out) });
    };
    const saltar = (haciaIdx: number) => {
      cerrar(out);
      splices.push({ outSec: r6(out), crossfadeSec: cfEfectivo });
      ci = haciaIdx;
      ini = { src: ci, out };
    };
    let colaAplicada = false;
    while (out < targetSec - 1e-9) {
      const lenCompas = beats[Math.min(ci + paso, e)] - beats[ci];
      if (real && ci === e) {
        // Sobra lugar para `Rm` segundos antes de la cola; si cabe otro lazo entero, se sigue; si no, se rellena
        // con los últimos compases del lazo (se repiten) y se toca la cola.
        const Rm = targetSec - cola - out;
        if (Rm < L - 1e-9) {
          const bar = beats[e] - beats[Math.max(a, e - paso)] || L;
          const j = Math.max(0, Math.floor((Rm + 1e-9) / bar));
          if (j > 0) {
            saltar(e - j * paso);
            out += beats[e] - beats[ci];
            ci = e;
          }
          // La cola sigue de corrido desde el final del lazo hasta el final de la pista.
          segments.push({ srcStart: beats[ini.src], outStart: r6(ini.out), lenSec: r6(out - ini.out + cola) });
          silencioFinalSec = r6(Math.max(0, targetSec - out - cola));
          colaAplicada = true;
          break;
        }
      }
      if (ci >= e) {
        saltar(a);
        continue;
      }
      // Corte pedido: si el compás más cercano a un corte es este, se fuerza el empalme acá.
      const iCorte = cortes.findIndex((c) => c >= out - lenCompas / 2 && c < out + lenCompas / 2);
      if (iCorte >= 0) {
        cortes.splice(iCorte, 1);
        // En modo real no se fuerza un corte que haga pasarse a la cola del largo pedido.
        const cabe = !real || out + L + cola <= targetSec + 1e-9;
        if (out > 0 && ci !== a && cabe) {
          saltar(a);
          continue;
        }
      }
      if (out + lenCompas > targetSec + 1e-9) {
        out = targetSec;
        break;
      }
      out += lenCompas;
      ci = Math.min(ci + paso, e);
    }
    if (!colaAplicada) {
      cerrar(Math.min(out, targetSec));
      // Un resto muy corto se absorbe en el tramo anterior (lee más allá del fin del lazo), pero
      // solo si la pista alcanza a darlo (con el margen del cruce); si no, queda como tramo propio.
      const n = segments.length;
      if (n > 1 && segments[n - 1].lenSec < 0.25) {
        const ant = segments[n - 2];
        const resto = segments[n - 1].lenSec;
        if (ant.srcStart + ant.lenSec + resto + cfEfectivo / 2 <= trackDurSec + 1e-9) {
          ant.lenSec = r6(ant.lenSec + resto);
          segments.pop();
          splices.pop();
        }
      }
    } else {
      fadeOut = { startSec: r6(targetSec), durSec: 0 };
      if (silencioFinalSec > 1.5) avisos.push(`Con el final real de la pista quedan ${silencioFinalSec.toFixed(1)} s de silencio al final del video (la duración no cae justo en un compás): ajustá la duración o usá --final fade.`);
    }
    // Un tramo que no llega al largo pedido solo se acepta en el modo `real` (el resto es silencio).
  }

  const outBeatsSec: number[] = [];
  for (const sg of segments) {
    for (const b of beats) {
      const rel = b - sg.srcStart;
      if (rel >= -1e-9 && rel < sg.lenSec - 1e-9) outBeatsSec.push(r6(sg.outStart + rel));
    }
  }
  return { startSec: t0, startBeatIndex: s, beatsPerBar: B, targetSec, loopStartSec, loopEndSec, segments, splices, fadeIn, fadeOut, final: loopEndSec !== null && final === 'real' ? 'real' : 'fade', silencioFinalSec, outBeatsSec, avisos };
}

/** Posiciones enteras (en muestras) de cada tramo. Una sola fuente de verdad para renderizar y probar:
 *  el final de un tramo es siempre el inicio del siguiente, así el cruce cae justo sobre el empalme
 *  aunque los pulsos no estén redondeados. */
export function muestrasDelPlan(plan: Plan, sr: number, totalSamples: number): { o0: number; o1: number; s0: number }[] {
  return plan.segments.map((sg, idx) => ({
    o0: Math.round(sg.outStart * sr),
    o1: idx === plan.segments.length - 1 ? totalSamples : Math.round(plan.segments[idx + 1].outStart * sr),
    s0: Math.round(sg.srcStart * sr),
  }));
}

/** Mezcla el plan sobre PCM estéreo entrelazado. Cruces de potencia constante centrados en cada
 *  empalme (el tramo que termina lee un poco más allá del pulso; el que empieza, un poco antes). */
export function renderizarPlan(src: Float32Array, plan: Plan, sr: number, totalSamples: number): Float32Array {
  const out = new Float32Array(totalSamples * 2);
  const nSrc = Math.floor(src.length / 2);
  const cfPor = new Map<number, number>();
  for (const sp of plan.splices) cfPor.set(Math.round(sp.outSec * sr), Math.round(sp.crossfadeSec * sr));
  muestrasDelPlan(plan, sr, totalSamples).forEach(({ o0, o1, s0 }) => {
    const cfIni = cfPor.get(o0) ?? 0;
    const cfFin = cfPor.get(o1) ?? 0;
    for (let n = o0 - cfIni / 2; n < o1 + cfFin / 2; n++) {
      const oi = Math.round(n);
      const si = s0 + (oi - o0);
      if (oi < 0 || oi >= totalSamples || si < 0 || si >= nSrc) continue;
      let g = 1;
      if (cfIni > 0 && oi < o0 + cfIni / 2) g = Math.min(g, Math.sin((Math.PI / 2) * Math.max(0, (oi - (o0 - cfIni / 2)) / cfIni)));
      if (cfFin > 0 && oi >= o1 - cfFin / 2) g = Math.min(g, Math.cos((Math.PI / 2) * Math.min(1, (oi - (o1 - cfFin / 2)) / cfFin)));
      out[oi * 2] += src[si * 2] * g;
      out[oi * 2 + 1] += src[si * 2 + 1] * g;
    }
  });
  const fi = Math.round(plan.fadeIn.durSec * sr);
  for (let n = 0; n < fi && n < totalSamples; n++) {
    const g = Math.sin((Math.PI / 2) * (n / fi));
    out[n * 2] *= g;
    out[n * 2 + 1] *= g;
  }
  const f0 = Math.round(plan.fadeOut.startSec * sr);
  const fd = Math.max(1, Math.round(plan.fadeOut.durSec * sr));
  for (let n = f0; n < totalSamples; n++) {
    const g = Math.cos((Math.PI / 2) * Math.min(1, (n - f0) / fd));
    out[n * 2] *= g;
    out[n * 2 + 1] *= g;
  }
  return out;
}

export interface EmpalmeOpts {
  entrada: string;
  salida: string;
  fps: number;
  frames: number;
  beatsSec: readonly number[];
  startSec?: number;
  beatsPerBar?: number;
  crossfadeSec?: number;
  fadeOutSec?: number;
  fadeInSec?: number;
  lazoInicioSec?: number;
  lazoFinSec?: number;
  cortesEnSec?: readonly number[];
  final?: 'fade' | 'real';
  /** Ignora la detección de intro baja y caída final (el lazo puede incluirlas). */
  sinCuerpo?: boolean;
  sr?: number;
}

export interface EmpalmeResult {
  salida: string;
  fps: number;
  durationFrames: number;
  plan: Plan;
  /** Cuerpo detectado en la pista (intro baja y caída final); null con `sinCuerpo`. */
  cuerpo: Cuerpo | null;
  /** Cuadro (fraccionario) de cada pulso en el archivo de salida: se usa con `audio/beats.ts`. */
  beatFrames: number[];
  spliceFrames: number[];
  /** Ganancia (dB, negativa) que hubo que aplicar para que la salida no pase de 0 dBFS; 0 si no hizo falta. */
  headroomDb: number;
}

/** Tope de pico de la salida (lineal): lo que pasa de esto se baja con una ganancia fija, sin recortar. */
export const PICO_MAXIMO = 0.98;

/**
 * Si el pico pasa de `PICO_MAXIMO` baja todo con una ganancia fija (nunca recorta ni cambia el carácter);
 * si no, no toca nada. Devuelve la ganancia aplicada en dB.
 */
export function aplicarHeadroom(x: Float32Array, maximo: number = PICO_MAXIMO): number {
  let pico = 0;
  for (let i = 0; i < x.length; i++) pico = Math.max(pico, Math.abs(x[i]));
  if (pico <= maximo) return 0;
  const g = maximo / pico;
  for (let i = 0; i < x.length; i++) x[i] *= g;
  return Math.round(20 * Math.log10(g) * 100) / 100;
}

export async function empalmar(o: EmpalmeOpts): Promise<EmpalmeResult> {
  const sr = o.sr ?? 48000;
  const src = await decodificar(o.entrada, { sr, canales: 2 });
  const trackDurSec = src.length / 2 / sr;
  const targetSec = o.frames / o.fps;
  let cuerpo: Cuerpo | null = null;
  if (!o.sinCuerpo) {
    const mono = new Float32Array(src.length / 2);
    for (let i = 0; i < mono.length; i++) mono[i] = 0.5 * (src[2 * i] + src[2 * i + 1]);
    cuerpo = detectarCuerpo(mono, sr);
  }
  const plan = planEmpalme({ ...o, trackDurSec, targetSec, cuerpo: cuerpo ?? undefined });
  const total = Math.round(targetSec * sr);
  const y = renderizarPlan(src, plan, sr, total);
  // Los cruces y los picos de la fuente pueden pasar de 0 dBFS: se baja con una ganancia fija antes de
  // escribir (en 24 bits o en un formato con pérdida un valor mayor que 1 se recortaría).
  const headroomDb = aplicarHeadroom(y);
  await codificar(y, { sr, canales: 2, salida: o.salida, bits: 24 });
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    salida: o.salida,
    fps: o.fps,
    durationFrames: o.frames,
    plan,
    cuerpo,
    beatFrames: plan.outBeatsSec.map((t) => r3(t * o.fps)),
    spliceFrames: plan.splices.map((s) => r3(s.outSec * o.fps)),
    headroomDb,
  };
}
