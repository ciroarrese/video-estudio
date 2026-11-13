/** Pure pieces of the privacy check: deny-list parsing/matching, e-mail / domain / phone detection. */

/** Lower case, no accents/diacritics (NFD without combining marks). */
export const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

export type Term = { raw: string; kind: 'term' | 'regex'; re: RegExp };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORD_L = '(?<![\\p{L}\\p{N}_])';
const WORD_R = '(?![\\p{L}\\p{N}_])';

/**
 * Deny/allow list: one term or /regex/flags per line, `#` starts a comment (whole line or after a term).
 * Terms are accent- and case-insensitive and match whole words; regexes run on the folded text.
 */
export function parseTermList(text: string): Term[] {
  const out: Term[] = [];
  for (const line0 of text.split(/\r?\n/)) {
    const line = line0.trim();
    if (!line || line.startsWith('#')) continue;
    const rx = /^\/(.+)\/([a-z]*)$/.exec(line);
    if (rx) {
      const flags = [...new Set(`${rx[2]}gi`.split('').filter((c) => c !== 'u' && c !== 'y'))].join('');
      try {
        out.push({ raw: line, kind: 'regex', re: new RegExp(rx[1]!, flags) });
      } catch (e) {
        throw new Error(`Regex invalida en la lista: ${line} (${(e as Error).message})`);
      }
      continue;
    }
    const term = fold(line.replace(/\s+#.*$/, '').trim());
    if (!term) continue;
    const body = term.split(/\s+/).map(escapeRe).join('\\s+');
    out.push({ raw: line.replace(/\s+#.*$/, '').trim(), kind: 'term', re: new RegExp(`${WORD_L}${body}${WORD_R}`, 'gu') });
  }
  return out;
}

export type Match = { term: string; match: string; index: number };

/** All hits of the terms in `text` (index refers to the folded text). */
export function matchTerms(text: string, terms: Term[]): Match[] {
  const f = fold(text);
  const out: Match[] = [];
  for (const t of terms) {
    t.re.lastIndex = 0;
    for (let m = t.re.exec(f); m; m = t.re.exec(f)) {
      if (m[0] === '') { t.re.lastIndex++; continue; }
      out.push({ term: t.raw, match: m[0], index: m.index });
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

export type HitKind = 'deny' | 'email' | 'domain' | 'phone';
export type Hit = { kind: HitKind; value: string; term?: string };

const allowed = (value: string, allow: Term[]): boolean =>
  allow.some((t) => {
    t.re.lastIndex = 0;
    const ok = t.re.test(fold(value));
    t.re.lastIndex = 0;
    return ok;
  });

/** Scans one text: deny terms, plus e-mails / domains / phone-like numbers not covered by the allow-list or example domains. */
export function scanText(text: string, deny: Term[], allow: Term[] = [], opts: { phones?: boolean; domains?: boolean } = {}): Hit[] {
  const hits: Hit[] = [];
  for (const m of matchTerms(text, deny)) hits.push({ kind: 'deny', value: m.match, term: m.term });
  for (const e of detectEmails(text)) {
    const dom = e.slice(e.lastIndexOf('@') + 1);
    if (!isSafeDomain(dom) && !allowed(e, allow)) hits.push({ kind: 'email', value: e });
  }
  if (opts.domains !== false) {
    for (const d of detectDomains(text)) if (!isSafeDomain(d) && !allowed(d, allow)) hits.push({ kind: 'domain', value: d });
  }
  if (opts.phones !== false) {
    for (const p of detectPhones(text)) if (!allowed(p, allow)) hits.push({ kind: 'phone', value: p });
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
