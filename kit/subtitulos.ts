// Subtítulos: datos y maquetación pura (sin React, sin DOM). Lo usan el componente `Subtitles` del kit y los comandos de `audio/`.
//
// Formato de datos (todo en SEGUNDOS adentro; el archivo JSON puede venir en cuadros, ver `leerSubtitulosJson`):
//   { "desde": 1.2, "hasta": 3.8, "texto": "Hola, esto es un subtítulo", "palabras": [{ "desde": 1.2, "hasta": 1.6, "texto": "Hola," }, ...] }
// `palabras` es opcional: sin él, el estilo "karaoke" reparte los tiempos de las palabras por su largo.

/** Tiempos de una palabra dentro de un subtítulo (segundos). */
export interface PalabraSubtitulo {
  desde: number;
  hasta: number;
  texto: string;
}

/** Un subtítulo: texto visible entre `desde` y `hasta` (segundos). */
export interface Subtitulo {
  desde: number;
  hasta: number;
  texto: string;
  /** Tiempos por palabra (para el estilo karaoke). Si falta, se estiman con `palabrasDe`. */
  palabras?: PalabraSubtitulo[];
}

/** Archivo JSON de subtítulos: una lista a secas (segundos) o un objeto que declara la unidad. */
export interface PistaSubtitulos {
  /** `segundos` (por defecto) o `cuadros`. */
  unidad?: 'segundos' | 'cuadros';
  /** Cuadros por segundo; hace falta si `unidad` es `cuadros` y no se pasa `fps` a `leerSubtitulosJson`. */
  fps?: number;
  cues: Array<{ desde: number; hasta: number; texto: string; palabras?: Array<{ desde: number; hasta: number; texto: string }> }>;
}

const EPS = 1e-9;
const redondearMs = (s: number): number => Math.round(s * 1000) / 1000;
const esNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Normaliza espacios: saltos de línea y repeticiones pasan a un solo espacio. */
export const normalizarTexto = (t: string): string => t.replace(/\s+/g, ' ').trim();

function validar(c: Subtitulo, donde: string): Subtitulo {
  if (!esNum(c.desde) || !esNum(c.hasta)) throw new Error(`${donde}: "desde" y "hasta" tienen que ser números`);
  if (c.desde < 0) throw new Error(`${donde}: "desde" no puede ser negativo (${c.desde})`);
  if (!(c.hasta > c.desde)) throw new Error(`${donde}: "hasta" (${c.hasta}) tiene que ser mayor que "desde" (${c.desde})`);
  if (typeof c.texto !== 'string') throw new Error(`${donde}: falta "texto"`);
  return c;
}

/**
 * Lee un JSON de subtítulos ya parseado: una lista `[{ desde, hasta, texto }]` (segundos) o `{ unidad, fps, cues }`.
 * Con `unidad: "cuadros"` convierte a segundos con `fps` (el del archivo o el argumento). Devuelve la lista ordenada por `desde`.
 */
export function leerSubtitulosJson(entrada: unknown, fps?: number): Subtitulo[] {
  const obj = Array.isArray(entrada) ? ({ cues: entrada } as Partial<PistaSubtitulos>) : (entrada as Partial<PistaSubtitulos> | null);
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.cues)) throw new Error('Subtítulos: se esperaba una lista [{ desde, hasta, texto }] o { unidad, fps, cues: [...] }');
  const unidad = obj.unidad ?? 'segundos';
  if (unidad !== 'segundos' && unidad !== 'cuadros') throw new Error(`Subtítulos: "unidad" tiene que ser "segundos" o "cuadros" (recibido ${String(unidad)})`);
  const f = obj.fps ?? fps;
  if (unidad === 'cuadros' && !(esNum(f) && f > 0)) throw new Error('Subtítulos en cuadros: hace falta "fps" (en el archivo o como argumento)');
  const k = unidad === 'cuadros' ? 1 / f! : 1;
  const out = obj.cues.map((c, i): Subtitulo => {
    const donde = `Subtítulo ${i + 1}`;
    if (!c || typeof c !== 'object') throw new Error(`${donde}: tiene que ser un objeto { desde, hasta, texto }`);
    const base = validar({ desde: c.desde * k, hasta: c.hasta * k, texto: String(c.texto ?? '') }, donde);
    const texto = normalizarTexto(base.texto);
    if (!c.palabras) return { desde: redondearMs(base.desde), hasta: redondearMs(base.hasta), texto };
    const palabras = c.palabras.map((p, j) => {
      const w = validar({ desde: p.desde * k, hasta: p.hasta * k, texto: String(p.texto ?? '') }, `${donde}, palabra ${j + 1}`);
      return { desde: redondearMs(w.desde), hasta: redondearMs(w.hasta), texto: w.texto.trim() };
    });
    return { desde: redondearMs(base.desde), hasta: redondearMs(base.hasta), texto, palabras };
  });
  return ordenar(out);
}

/** Copia ordenada por `desde` (estable). */
export const ordenar = (cues: readonly Subtitulo[]): Subtitulo[] => cues.map((c, i) => ({ c, i })).sort((a, b) => a.c.desde - b.c.desde || a.i - b.i).map((x) => x.c);

// ------------------------------------------------------------------ SRT y VTT

const RE_TIEMPO = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/;

/** `"01:02:03,456"` o `"02:03.456"` a segundos; `null` si no es un tiempo. */
export function parsearTiempo(s: string): number | null {
  const m = RE_TIEMPO.exec(s.trim());
  if (!m) return null;
  const ms = m[4] ? Number(m[4].padEnd(3, '0')) : 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + ms / 1000;
}

/** Segundos a `HH:MM:SS,mmm` (SRT) o `HH:MM:SS.mmm` (VTT). Redondea al milisegundo. */
export function formatearTiempo(seg: number, sep: ',' | '.' = ','): string {
  const total = Math.max(0, Math.round(seg * 1000));
  const ms = total % 1000;
  const s = Math.floor(total / 1000) % 60;
  const m = Math.floor(total / 60000) % 60;
  const h = Math.floor(total / 3600000);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(h)}:${dos(m)}:${dos(s)}${sep}${String(ms).padStart(3, '0')}`;
}

const ENTIDADES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&quot;': '"', '&#39;': "'" };
const sinMarcas = (t: string): string => t.replace(/<\/?[a-zA-Z][^>]*>/g, '').replace(/<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}>/g, '').replace(/\{\\[^}]*\}/g, '').replace(/&(?:amp|lt|gt|nbsp|quot|#39);/g, (e) => ENTIDADES[e]!);

const RE_FLECHA = /^\s*(\S+)\s*-->\s*(\S+)/;

/** Bloques separados por líneas en blanco (admite CRLF y BOM). */
function bloques(txt: string): string[][] {
  const lineas = txt.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const out: string[][] = [];
  let cur: string[] = [];
  for (const l of lineas) {
    if (l.trim() === '') {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(l);
  }
  if (cur.length) out.push(cur);
  return out;
}

function leerBloques(txt: string, vtt: boolean): Subtitulo[] {
  const out: Subtitulo[] = [];
  let n = 0;
  for (const b of bloques(txt)) {
    if (vtt && /^(WEBVTT|NOTE|STYLE|REGION)\b/.test(b[0]!)) continue;
    const i = b.findIndex((l) => RE_FLECHA.test(l));
    if (i < 0) continue;
    n++;
    const m = RE_FLECHA.exec(b[i]!)!;
    const desde = parsearTiempo(m[1]!);
    const hasta = parsearTiempo(m[2]!);
    if (desde === null || hasta === null) throw new Error(`Subtítulo ${n}: tiempo ilegible en "${b[i]!.trim()}"`);
    const crudo = b.slice(i + 1).join('\n');
    // Etiquetas de tiempo por palabra de VTT (`<00:01.500>`): dan los tiempos del karaoke.
    let palabras: PalabraSubtitulo[] | undefined;
    if (vtt && /<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}>/.test(crudo)) palabras = palabrasDeVtt(crudo, desde, hasta);
    const texto = normalizarTexto(sinMarcas(crudo));
    const c: Subtitulo = { desde: redondearMs(desde), hasta: redondearMs(hasta), texto };
    if (palabras && palabras.length) c.palabras = palabras;
    validar(c, `Subtítulo ${n}`);
    out.push(c);
  }
  return ordenar(out);
}

function palabrasDeVtt(crudo: string, desde: number, hasta: number): PalabraSubtitulo[] {
  // Parte el texto en trozos separados por etiquetas de tiempo; cada trozo arranca en su etiqueta.
  const trozos: Array<{ t: number; txt: string }> = [];
  let t = desde;
  let resto = crudo.replace(/\n/g, ' ');
  const re = /<(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})>/;
  for (;;) {
    const m = re.exec(resto);
    const antes = m ? resto.slice(0, m.index) : resto;
    trozos.push({ t, txt: antes });
    if (!m) break;
    t = parsearTiempo(m[1]!) ?? t;
    resto = resto.slice(m.index + m[0].length);
  }
  const palabras: PalabraSubtitulo[] = [];
  trozos.forEach((tr, k) => {
    const fin = k + 1 < trozos.length ? trozos[k + 1]!.t : hasta;
    const ws = normalizarTexto(sinMarcas(tr.txt)).split(' ').filter(Boolean);
    ws.forEach((w, j) => {
      const a = tr.t + ((fin - tr.t) * j) / ws.length;
      const b = tr.t + ((fin - tr.t) * (j + 1)) / ws.length;
      palabras.push({ desde: redondearMs(a), hasta: redondearMs(b), texto: w });
    });
  });
  return palabras;
}

/** Lee un SRT (con CRLF, BOM, etiquetas `<i>` y números de orden): ignora los números y junta las líneas de cada cue en una. */
export const parsearSrt = (txt: string): Subtitulo[] => leerBloques(txt, false);

/** Lee un WebVTT (cabecera, NOTE/STYLE ignorados, identificadores, ajustes tras la flecha, y etiquetas de tiempo por palabra). */
export const parsearVtt = (txt: string): Subtitulo[] => leerBloques(txt, true);

/** Detecta SRT o VTT por la cabecera `WEBVTT`. */
export const parsearSubtitulos = (txt: string): Subtitulo[] => (/^﻿?\s*WEBVTT/.test(txt) ? parsearVtt(txt) : parsearSrt(txt));

/** Parte `texto` en renglones de a lo sumo `maxCaracteres` (por el largo, balanceados), para los archivos que leen otros reproductores. Nunca corta una palabra. */
export function partirPorCaracteres(texto: string, maxCaracteres = 42): string[] {
  const ws = normalizarTexto(texto).split(' ').filter(Boolean);
  if (ws.length === 0) return [''];
  const total = ws.join(' ').length;
  const n = Math.max(1, Math.ceil(total / maxCaracteres));
  const objetivo = total / n;
  const out: string[] = [];
  let cur = '';
  for (const w of ws) {
    const prueba = cur ? `${cur} ${w}` : w;
    if (cur && (prueba.length > maxCaracteres || (prueba.length > objetivo && Math.abs(cur.length - objetivo) < Math.abs(prueba.length - objetivo) && out.length < n - 1))) {
      out.push(cur);
      cur = w;
    } else cur = prueba;
  }
  if (cur) out.push(cur);
  return out;
}

export interface OpcionesExportar {
  /** Largo máximo de cada renglón del archivo (42 por defecto, el uso común de las plataformas). */
  maxCaracteres?: number;
}

/** Escribe un SRT. */
export function aSrt(cues: readonly Subtitulo[], o: OpcionesExportar = {}): string {
  return (
    ordenar(cues)
      .map((c, i) => `${i + 1}\n${formatearTiempo(c.desde, ',')} --> ${formatearTiempo(c.hasta, ',')}\n${partirPorCaracteres(c.texto, o.maxCaracteres).join('\n')}\n`)
      .join('\n')
  );
}

/** Escribe un WebVTT. Con `conPalabras` los cues que traen `palabras` llevan etiquetas de tiempo por palabra (karaoke). */
export function aVtt(cues: readonly Subtitulo[], o: OpcionesExportar & { conPalabras?: boolean } = {}): string {
  const cuerpo = ordenar(cues).map((c) => {
    let txt: string;
    if (o.conPalabras && c.palabras && c.palabras.length) {
      txt = c.palabras.map((p, i) => (i === 0 ? p.texto : `<${formatearTiempo(p.desde, '.')}>${p.texto}`)).join(' ');
    } else txt = partirPorCaracteres(c.texto, o.maxCaracteres).join('\n');
    return `${formatearTiempo(c.desde, '.')} --> ${formatearTiempo(c.hasta, '.')}\n${txt}\n`;
  });
  return `WEBVTT\n\n${cuerpo.join('\n')}`;
}

/** JSON en segundos, listo para guardar y para leer con `leerSubtitulosJson`. */
export const aJson = (cues: readonly Subtitulo[]): string => JSON.stringify({ unidad: 'segundos', cues: ordenar(cues) }, null, 2) + '\n';

// ------------------------------------------------------------------ palabras y guion

/**
 * Palabras de un subtítulo con sus tiempos: las de `palabras` si las trae; si no, reparte `desde..hasta` entre las palabras del texto
 * en proporción a su largo (cuenta letras y un mínimo de 2, así "a" no dura casi nada pero tampoco cero).
 */
export function palabrasDe(c: Subtitulo): PalabraSubtitulo[] {
  if (c.palabras && c.palabras.length) return c.palabras;
  const ws = normalizarTexto(c.texto).split(' ').filter(Boolean);
  if (ws.length === 0) return [];
  const pesos = ws.map((w) => Math.max(2, Array.from(w).length));
  const suma = pesos.reduce((a, b) => a + b, 0);
  let acum = 0;
  return ws.map((w, i) => {
    const a = c.desde + ((c.hasta - c.desde) * acum) / suma;
    acum += pesos[i]!;
    const b = c.desde + ((c.hasta - c.desde) * acum) / suma;
    return { desde: a, hasta: b, texto: w };
  });
}

export interface EscenaDeGuion {
  /** Texto que se dice o se lee en la escena (una frase o varias; puede ser una lista de frases). Vacío: la escena no lleva subtítulos. */
  texto?: string | string[];
  /** Duración de la escena en cuadros (con `fps`) o en segundos. Una de las dos. */
  frames?: number;
  segundos?: number;
}

export interface OpcionesGuion {
  fps: number;
  /** Segundo en que arranca la primera escena (0 por defecto). */
  desdeSec?: number;
  /** Aire al principio de cada escena antes del primer subtítulo (0,25 s por defecto). */
  entradaSec?: number;
  /** Aire al final de cada escena después del último subtítulo (0,25 s por defecto). */
  salidaSec?: number;
  /** Largo máximo (caracteres) de un subtítulo antes de partirlo en una pausa o entre palabras (84 por defecto: dos renglones de 42). */
  maxCaracteres?: number;
  /** Agrega los tiempos por palabra (para el estilo karaoke). */
  conPalabras?: boolean;
}

/** Parte un texto en frases por la puntuación fuerte y, si una frase pasa de `max` caracteres, en las comas y, al final, entre palabras. */
export function partirEnFrases(texto: string, max = 84): string[] {
  const base = normalizarTexto(texto);
  if (!base) return [];
  const fuertes = base.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const out: string[] = [];
  for (const f of fuertes) {
    if (f.length <= max) {
      out.push(f);
      continue;
    }
    const medias = f.split(/(?<=[,;:])\s+/).filter(Boolean);
    let cur = '';
    const cerrar = () => {
      if (cur) out.push(cur);
      cur = '';
    };
    for (const m of medias) {
      if (m.length > max) {
        cerrar();
        let acc = '';
        for (const w of m.split(' ')) {
          if (acc && `${acc} ${w}`.length > max) {
            out.push(acc);
            acc = w;
          } else acc = acc ? `${acc} ${w}` : w;
        }
        cur = acc;
      } else if (cur && `${cur} ${m}`.length > max) {
        cerrar();
        cur = m;
      } else cur = cur ? `${cur} ${m}` : m;
    }
    cerrar();
  }
  return out;
}

/**
 * Subtítulos a partir del guion (texto por escena y duración de cada escena), para cuando no hay locución que alinear: dentro de cada escena
 * se descuentan `entradaSec` y `salidaSec` y el resto se reparte entre las frases por su cantidad de palabras. Las escenas van una tras otra.
 */
export function subtitulosDeGuion(escenas: readonly EscenaDeGuion[], o: OpcionesGuion): Subtitulo[] {
  if (!(o.fps > 0)) throw new Error('subtitulosDeGuion: fps tiene que ser mayor que 0');
  const entrada = o.entradaSec ?? 0.25;
  const salida = o.salidaSec ?? 0.25;
  const out: Subtitulo[] = [];
  let t = o.desdeSec ?? 0;
  escenas.forEach((e, i) => {
    const dur = e.segundos ?? (e.frames !== undefined ? e.frames / o.fps : NaN);
    if (!(dur > 0)) throw new Error(`Escena ${i + 1}: falta la duración ("frames" o "segundos", mayor que 0)`);
    const frases = (Array.isArray(e.texto) ? e.texto : [e.texto ?? '']).flatMap((x) => partirEnFrases(x, o.maxCaracteres));
    const ini = t + Math.min(entrada, dur / 4);
    const fin = t + dur - Math.min(salida, dur / 4);
    const pesos = frases.map((f) => f.split(' ').length);
    const suma = pesos.reduce((a, b) => a + b, 0);
    let acum = 0;
    frases.forEach((f, k) => {
      const a = ini + ((fin - ini) * acum) / suma;
      acum += pesos[k]!;
      const b = ini + ((fin - ini) * acum) / suma;
      const c: Subtitulo = { desde: redondearMs(a), hasta: redondearMs(b), texto: f };
      if (o.conPalabras) c.palabras = palabrasDe(c).map((p) => ({ desde: redondearMs(p.desde), hasta: redondearMs(p.hasta), texto: p.texto }));
      out.push(c);
    });
    t += dur;
  });
  return out;
}

/** Cortes de escena (segundos) a partir de las duraciones de las escenas: el final de cada una menos la última. */
export function cortesDeEscenas(duraciones: readonly number[], desdeSec = 0): number[] {
  const out: number[] = [];
  let t = desdeSec;
  duraciones.forEach((d, i) => {
    t += d;
    if (i < duraciones.length - 1) out.push(redondearMs(t));
  });
  return out;
}

/** El subtítulo que se ve en el instante `t` (segundos); si hay solapados, el que empezó último. `null` si no hay. */
export function subtituloActivo(cues: readonly Subtitulo[], t: number): number | null {
  let idx: number | null = null;
  for (let i = 0; i < cues.length; i++) if (cues[i]!.desde <= t + EPS && t < cues[i]!.hasta - EPS && (idx === null || cues[i]!.desde >= cues[idx]!.desde)) idx = i;
  return idx;
}

// ------------------------------------------------------------------ maquetación en renglones

/** Mide el ancho en px de un texto de una sola línea con la letra ya elegida. */
export type Medir = (texto: string) => number;

/** Un renglón: las palabras (con sus tiempos) que lleva. */
export type Renglon = PalabraSubtitulo[];

/** Lo que se muestra de una vez: hasta dos renglones y el tramo de tiempo en que se ve. */
export interface PaginaSubtitulo {
  desde: number;
  hasta: number;
  renglones: Renglon[];
}

export interface OpcionesLayout {
  /** Ancho máximo de un renglón (px). */
  ancho: number;
  /** Renglones por página (2 por defecto). */
  maxRenglones?: 1 | 2;
  /** Holgura sobre el ancho medido (0,96 por defecto: la medición y el DOM no coinciden al píxel). */
  holgura?: number;
}

const FIN_FRASE = /[.!?…;:,]$/;

/**
 * Parte las palabras de un subtítulo en páginas de hasta dos renglones que entran en `ancho`: cada palabra se mide una vez (más el espacio),
 * así que cuesta lo mismo con 6 palabras que con 40. Si el texto entra en un renglón, es uno; si no, se elige el corte que deja los dos más parejos;
 * si ni dos alcanzan, se parte en varias páginas (prefiere cortar tras una coma o un punto) y los tiempos de cada página salen de sus palabras.
 * Nunca recorta ni abrevia: una palabra más ancha que el renglón queda sola en el suyo.
 */
export function paginarSubtitulo(c: Subtitulo, medir: Medir, o: OpcionesLayout): PaginaSubtitulo[] {
  const ps = palabrasDe(c);
  if (ps.length === 0) return [];
  const maxR = o.maxRenglones ?? 2;
  const ancho = o.ancho * (o.holgura ?? 0.96);
  const esp = medir('a a') - medir('aa');
  const w = ps.map((p) => medir(p.texto));
  const pre = [0];
  w.forEach((x, i) => pre.push(pre[i]! + x));
  const largo = (i: number, j: number) => pre[j + 1]! - pre[i]! + (j - i) * esp; // palabras i..j
  // mejor corte de i..j en <= maxR renglones: devuelve los índices de inicio de cada renglón, o null si no entra
  const cortar = (i: number, j: number): number[] | null => {
    if (largo(i, j) <= ancho) return [i];
    if (maxR === 1) return null;
    let mejor: number | null = null;
    let mejorMax = Infinity;
    for (let k = i + 1; k <= j; k++) {
      const m = Math.max(largo(i, k - 1), largo(k, j));
      if (m <= ancho && m < mejorMax - 1e-9) {
        mejor = k;
        mejorMax = m;
      }
    }
    return mejor === null ? null : [i, mejor];
  };
  const paginas: Array<{ i: number; j: number; cortes: number[] }> = [];
  // Cantidad mínima de páginas: se llena cada una al máximo (codicioso).
  const codicioso: Array<[number, number]> = [];
  for (let i = 0; i < ps.length; ) {
    let jmax = i;
    for (let j = i; j < ps.length; j++) {
      if (cortar(i, j)) jmax = j;
      else if (j > i) break;
    }
    codicioso.push([i, jmax]);
    i = jmax + 1;
  }
  // Con esa cantidad, se reparten las palabras lo más parejo posible entre las páginas (que no quede una de dos palabras al final) y,
  // a igual reparto, se prefiere cortar tras una coma o un punto. Hasta 3 páginas se prueban todos los cortes; más, se queda el codicioso.
  let rangos = codicioso;
  const P = codicioso.length;
  if (P > 1 && P <= 3) {
    const n = ps.length;
    const penal = (j: number) => (FIN_FRASE.test(ps[j]!.texto) ? 0 : 0.08 * ancho);
    let mejor = Infinity;
    const probar = (cortes: number[]) => {
      const lim: Array<[number, number]> = [];
      let a0 = 0;
      for (const c of [...cortes, n]) {
        lim.push([a0, c - 1]);
        a0 = c;
      }
      let peor = 0;
      let pen = 0;
      for (let q = 0; q < lim.length; q++) {
        const [x, y] = lim[q]!;
        if (y < x || !(x === y || cortar(x, y))) return;
        peor = Math.max(peor, largo(x, y));
        if (q < lim.length - 1) pen += penal(y);
      }
      if (peor + pen < mejor - 1e-9) {
        mejor = peor + pen;
        rangos = lim;
      }
    };
    if (P === 2) for (let c = 1; c < n; c++) probar([c]);
    else for (let c1 = 1; c1 < n - 1; c1++) for (let c2 = c1 + 1; c2 < n; c2++) probar([c1, c2]);
  }
  for (const [i, j] of rangos) paginas.push({ i, j, cortes: cortar(i, j) ?? [i] });
  return paginas.map((p, k) => {
    const renglones: Renglon[] = p.cortes.map((ini, r) => ps.slice(ini, (p.cortes[r + 1] ?? p.j + 1)));
    const desde = k === 0 ? c.desde : ps[p.i]!.desde;
    const hasta = k === paginas.length - 1 ? c.hasta : paginas[k + 1]!.i < ps.length ? ps[paginas[k + 1]!.i]!.desde : c.hasta;
    return { desde: Math.max(c.desde, Math.min(desde, c.hasta)), hasta: Math.min(c.hasta, Math.max(hasta, desde)), renglones };
  });
}
