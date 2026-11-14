/** Pure pieces of the privacy check: deny-list parsing/matching, e-mail / domain / phone detection. */

/** Letras que NFKD no descompone y que se usan para esquivar una lista (ø, đ, ł, ß...). */
const LETTER_MAP: Record<string, string> = { 'ø': 'o', 'đ': 'd', 'ð': 'd', 'ł': 'l', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'þ': 'th', 'ı': 'i', 'ħ': 'h', 'ŧ': 't' };
const LETTER_RE = /[øđðłßæœþıħŧ]/g;

/**
 * Forma canonica para comparar: NFKD (letras de ancho completo, ligaduras, superindices), sin marcas combinantes,
 * sin caracteres de formato invisibles (\p{Cf}: ancho cero, joiners, bidi, BOM) ni guion blando (U+00AD), en minusculas,
 * y con ø/đ/ł/ß... llevadas a su equivalente ASCII.
 */
export const fold = (s: string): string =>
  s.normalize('NFKD').replace(/[\p{Cf}\u00AD]+/gu, '').replace(/\p{M}+/gu, '').toLowerCase().replace(LETTER_RE, (c) => LETTER_MAP[c] ?? c);

/** `word`: palabra entera; `substring`: aparece en cualquier parte (CamelCase, identificadores); `auto`: substring salvo terminos cortos. */
export type MatchMode = 'word' | 'substring' | 'auto';
/** En modo `auto`, los terminos de menos letras que esto se buscan como palabra entera (evita `ana` en `banana`). */
export const AUTO_MIN_SUBSTRING = 4;

export type Term = { raw: string; kind: 'term' | 'regex'; re: RegExp; /** Termino plegado y sin espacios (solo `term`). */ squashed?: string };

/** Largo maximo de texto que se le da de una vez a una regex del usuario (acota el costo de una regex patologica). */
export const REGEX_WINDOW = 10_000;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORD_L = '(?<![\\p{L}\\p{N}_])';
const WORD_R = '(?![\\p{L}\\p{N}_])';

/**
 * Deny/allow list: one term or /regex/flags per line, `#` starts a comment (whole line or after a term).
 * Terms are accent- and case-insensitive; `mode` decides word-boundary vs substring matching (default: whole words).
 * Regexes run on the folded text with the `u` flag always on (so `\p{L}` works); an invalid pattern is an error, never a silent literal.
 */
export function parseTermList(text: string, mode: MatchMode = 'word'): Term[] {
  const out: Term[] = [];
  for (const line0 of text.split(/\r?\n/)) {
    const line = line0.trim();
    if (!line || line.startsWith('#')) continue;
    const rx = /^\/(.+)\/([a-z]*)$/.exec(line);
    if (rx) {
      const flags = [...new Set(`${rx[2]}giu`.split('').filter((c) => c !== 'y'))].join('');
      try {
        out.push({ raw: line, kind: 'regex', re: new RegExp(rx[1]!, flags) });
      } catch (e) {
        throw new Error(`Regex invalida en la lista: ${line} (${(e as Error).message}). Se evalua siempre con la bandera u (modo unicode): revisa los escapes (p. ej. \\- no es valido).`);
      }
      continue;
    }
    const term = fold(line.replace(/\s+#.*$/, '').trim());
    if (!term) continue;
    const body = term.split(/\s+/).map(escapeRe).join('\\s+');
    const whole = mode === 'word' || (mode === 'auto' && term.replace(/\s+/g, '').length < AUTO_MIN_SUBSTRING);
    out.push({
      raw: line.replace(/\s+#.*$/, '').trim(), kind: 'term', squashed: term.replace(/\s+/g, ''),
      re: new RegExp(whole ? `${WORD_L}${body}${WORD_R}` : body, 'gu'),
    });
  }
  return out;
}

export type Match = { term: string; match: string; index: number };

/** Cada ventana de una regex del usuario: textos largos se miran por tramos con solape (acota el backtracking). */
function* windows(f: string): Generator<[string, number]> {
  if (f.length <= REGEX_WINDOW) { yield [f, 0]; return; }
  const step = REGEX_WINDOW - 256;
  for (let i = 0; i < f.length; i += step) yield [f.slice(i, i + REGEX_WINDOW), i];
}

/** Largo minimo (sin espacios) de un termino para buscarlo en texto sin espacios (letras sueltas en spans). */
export const SQUASH_MIN = 4;

/**
 * All hits of the terms in `text` (index refers to the folded text).
 * `squash`: el texto se compara sin ningun espacio contra el termino sin espacios (texto armado con un span por letra o por palabra);
 * solo terminos (no regex) de >= SQUASH_MIN caracteres.
 */
export function matchTerms(text: string, terms: Term[], opts: { squash?: boolean } = {}): Match[] {
  const f = fold(text);
  const out: Match[] = [];
  if (opts.squash) {
    const g = f.replace(/\s+/g, '');
    for (const t of terms) {
      if (t.kind !== 'term' || !t.squashed || t.squashed.length < SQUASH_MIN) continue;
      for (let i = g.indexOf(t.squashed); i >= 0; i = g.indexOf(t.squashed, i + t.squashed.length)) out.push({ term: t.raw, match: t.squashed, index: i });
    }
    return out;
  }
  for (const t of terms) {
    for (const [chunk, off] of t.kind === 'regex' ? windows(f) : ([[f, 0]] as [string, number][])) {
      t.re.lastIndex = 0;
      for (let m = t.re.exec(chunk); m; m = t.re.exec(chunk)) {
        if (m[0] === '') { t.re.lastIndex++; continue; }
        out.push({ term: t.raw, match: m[0], index: m.index + off });
      }
    }
  }
  return out;
}

export const SAFE_DOMAIN_SUFFIXES = ['example.com', 'example.org', 'example.net', 'example', 'test', 'invalid', 'localhost'];
const FILE_EXT = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'css', 'html', 'htm', 'md', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp4', 'mp3', 'wav', 'woff', 'woff2', 'ttf', 'otf', 'py', 'rb', 'sh', 'go', 'rs', 'yml', 'yaml', 'lock', 'log', 'pdf', 'csv', 'xml', 'zip', 'gz', 'pl', 'cs', 'rt', 'sql', 'ini']);
const TLDS = new Set(['com', 'net', 'org', 'io', 'co', 'app', 'dev', 'ai', 'edu', 'gov', 'info', 'biz', 'me', 'tv', 'cloud', 'tech', 'xyz', 'online', 'site', 'store', 'shop', 'ly', 'gl', 'sh', 'cc', 'us', 'uk', 'eu', 'es', 'mx', 'ar', 'cl', 'pe', 'br', 'de', 'fr', 'it', 'nl', 'pt', 'ca', 'au', 'nz', 'in', 'jp', 'cn', 'ru', 'ch', 'se', 'no', 'fi', 'dk', 'be', 'at', 'pl', 'ie', 'uy', 'py', 'bo', 'ec', 've', 'gt', 'cr', 'pa', 'do', 'mil', 'int', 'pro', 'agency', 'studio', 'digital', 'software', 'systems', 'solutions', 'services', 'company', 'group', 'team', 'live', 'life', 'world', 'today', 'news', 'email', 'link', 'page', 'website', 'space', 'work', 'zone', 'one']);

const EMAIL_RE = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
const DOMAIN_RE = /(?<![\p{L}\p{N}@._-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+([a-z]{2,24})(?![\p{L}\p{N}_-])/giu;
const PHONE_RE = /(?<![\w.])\+?\(?\d[\d\s().-]{5,}\d(?![\w])/g;

export const isSafeDomain = (domain: string): boolean => {
  const d = fold(domain).replace(/\.$/, '');
  return SAFE_DOMAIN_SUFFIXES.some((s) => d === s || d.endsWith(`.${s}`));
};

export const detectEmails = (text: string): string[] => (text.match(EMAIL_RE) ?? []).map((m) => m.replace(/[.,;:]+$/, ''));

/** Domain-like tokens (not e-mails) with a plausible TLD; file names such as index.html are ignored. */
export function detectDomains(text: string): string[] {
  const noMail = text.replace(EMAIL_RE, ' ');
  const out: string[] = [];
  for (const m of noMail.matchAll(DOMAIN_RE)) {
    const tld = m[1]!.toLowerCase();
    if (FILE_EXT.has(tld) || !TLDS.has(tld)) continue;
    if (/^\d+(?:\.\d+)+$/.test(m[0])) continue;
    out.push(m[0]);
  }
  return out;
}

const DATE_RE = /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$/;

export function detectPhones(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(PHONE_RE)) {
    const s = m[0].trim().replace(/[\s.-]+$/, '');
    const digits = s.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) continue;
    if (DATE_RE.test(s) || /^\d{1,3}(?:\.\d{3})+$/.test(s)) continue;
    if (/^\(?555\)?[\s.-]*01\d\d$/.test(s) || /555[\s.-]*01\d\d$/.test(s)) continue; // fictional range
    const plus = s.startsWith('+');
    const dashed = /^\d{3}[-.]\d{4}$/.test(s);
    if ((plus && digits.length >= 8) || digits.length >= 9 || dashed) out.push(s);
  }
  return out;
}

/** `deny-joined`: el termino solo aparece al juntar textos de nodos o elementos distintos (nunca dentro de un solo nodo). */
export type HitKind = 'deny' | 'deny-joined' | 'email' | 'domain' | 'phone';
export type Hit = { kind: HitKind; value: string; term?: string };

const allowed = (value: string, allow: Term[]): boolean =>
  allow.some((t) => {
    t.re.lastIndex = 0;
    const ok = t.re.test(fold(value));
    t.re.lastIndex = 0;
    return ok;
  });

/** Scans one text: deny terms, plus e-mails / domains / phone-like numbers not covered by the allow-list or example domains. */
export function scanText(text: string, deny: Term[], allow: Term[] = [], opts: { phones?: boolean; domains?: boolean; squash?: boolean } = {}): Hit[] {
  const hits: Hit[] = [];
  for (const m of matchTerms(text, deny, { squash: opts.squash })) hits.push({ kind: 'deny', value: m.match, term: m.term });
  if (opts.squash) return hits; // la version sin espacios solo sirve para terminos
  const f = fold(text); // mismos recortes que en los terminos: ancho cero, ancho completo, guion blando
  for (const e of detectEmails(f)) {
    const dom = e.slice(e.lastIndexOf('@') + 1);
    if (!isSafeDomain(dom) && !allowed(e, allow)) hits.push({ kind: 'email', value: e });
  }
  if (opts.domains !== false) {
    for (const d of detectDomains(f)) if (!isSafeDomain(d) && !allowed(d, allow)) hits.push({ kind: 'domain', value: d });
  }
  if (opts.phones !== false) {
    for (const p of detectPhones(f)) if (!allowed(p, allow)) hits.push({ kind: 'phone', value: p });
  }
  return hits;
}

const isWordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}_]/u.test(c);

/**
 * Texto armado de un bloque (o del escenario) tal como lo devuelve `collectAllText`: \u0001 separa bloques (no se cruza), \u0002 separa
 * items de un flex/grid (se lee como espacio; un termino partido en una letra por item sigue coincidiendo).
 * Una coincidencia de la deny-list en este texto tiene que empezar y terminar en limite de palabra: asi "mercado pago" no sale de
 * "Super" + "mercado" ni de "...mercado" + "Pagó" de dos elementos distintos pegados. Se devuelve como `deny-joined`.
 * Correos y dominios se buscan en cada segmento (sin cruzar bloques); los telefonos no (los numeros de vecinos se pegarian).
 */
export function scanJoined(text: string, deny: Term[], allow: Term[] = [], opts: { domains?: boolean } = {}): Hit[] {
  const hits: Hit[] = [];
  for (const seg of text.split('\u0001')) {
    const spaced = seg.replace(/\u0002+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!spaced) continue;
    const f = fold(spaced);
    const ok = (index: number, len: number) => !isWordChar(f[index - 1]) && !isWordChar(f[index + len]);
    for (const t of deny) {
      if (t.kind === 'regex') {
        for (const m of matchTerms(spaced, [t])) hits.push({ kind: 'deny-joined', value: m.match, term: m.term });
        continue;
      }
      for (const m of matchTerms(spaced, [t])) if (ok(m.index, m.match.length)) hits.push({ kind: 'deny-joined', value: m.match, term: m.term });
      // un span por letra o por palabra: sin espacios; el limite de palabra se mira en el texto con espacios
      if (!t.squashed || t.squashed.length < SQUASH_MIN) continue;
      const map: number[] = []; // posicion en `f` de cada caracter de `g`
      let g = '';
      for (let i = 0; i < f.length; i++) if (!/\s/.test(f[i]!)) { g += f[i]; map.push(i); }
      for (let i = g.indexOf(t.squashed); i >= 0; i = g.indexOf(t.squashed, i + t.squashed.length)) {
        const start = map[i]!, end = map[i + t.squashed.length - 1]! + 1;
        if (ok(start, end - start)) hits.push({ kind: 'deny-joined', value: t.squashed, term: t.raw });
      }
    }
    for (const h of scanText(spaced, [], allow, { phones: false, domains: opts.domains })) hits.push(h);
  }
  return hits;
}

/** Every string inside a JSON-like value. */
export function collectStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); collectStrings(x, out); }
  return out;
}
