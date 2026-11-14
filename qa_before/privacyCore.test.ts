import { describe, expect, it } from 'vitest';
import { collectStrings, detectDomains, detectEmails, detectPhones, fold, isSafeDomain, matchTerms, parseTermList, scanJoined, scanText } from './privacyCore';

describe('deny list', () => {
  it('parses terms, regexes and comments', () => {
    const t = parseTermList('# comment\n\nAcme Corp  # trailing\n/proy-\\d+/\n');
    expect(t.map((x) => [x.raw, x.kind])).toEqual([['Acme Corp', 'term'], ['/proy-\\d+/', 'regex']]);
    expect(() => parseTermList('/(/')).toThrow(/Regex invalida/);
  });
  it('is case and accent insensitive', () => {
    const t = parseTermList('Zutano Pérez\ncanción');
    expect(matchTerms('hola ZUTANO PEREZ!', t)).toHaveLength(1);
    expect(matchTerms('Cancion y CANCIÓN', t)).toHaveLength(2);
    expect(fold('Ñandú Ç')).toBe('nandu c');
  });
  it('respects word boundaries', () => {
    const t = parseTermList('sol');
    expect(matchTerms('Sol', t)).toHaveLength(1);
    expect(matchTerms('girasol, solar, sol.', t)).toHaveLength(1);
    expect(matchTerms('sol-y-luna', t)).toHaveLength(1);
    expect(matchTerms('solo', t)).toHaveLength(0);
  });
  it('matches multi-word terms across whitespace and regexes on folded text', () => {
    const t = parseTermList('Estudio  Fantasma\n/proy-\\d{3}/');
    expect(matchTerms('el estudio\nfantasma cierra', t)).toHaveLength(1);
    expect(matchTerms('ref PROY-123', t)).toHaveLength(1);
    expect(matchTerms('proy-12', t)).toHaveLength(0);
  });
});

describe('e-mail / domain / phone detection', () => {
  it('finds e-mails', () => {
    expect(detectEmails('Escribi a persona.ejemplo@dominio-ficticio.com, gracias')).toEqual(['persona.ejemplo@dominio-ficticio.com']);
    expect(detectEmails('sin correo @ aca')).toEqual([]);
  });
  it('finds real-looking domains but not files, versions or sentences', () => {
    expect(detectDomains('visita www.dominio-ficticio.com/ayuda')).toEqual(['www.dominio-ficticio.com']);
    expect(detectDomains('index.html v1.2.3 foo.png Elemento.beta 3.14')).toEqual([]);
    expect(detectDomains('mail a@dominio-ficticio.com')).toEqual([]);
  });
  it('treats example.com, .test and .example as safe', () => {
    for (const d of ['example.com', 'a.b.example.org', 'demo.test', 'x.example', 'localhost']) expect(isSafeDomain(d)).toBe(true);
    expect(isSafeDomain('notexample.com')).toBe(false);
  });
  it('detects phone-like numbers and ignores dates, money and stats', () => {
    expect(detectPhones('Llama al +54 11 5555 1234')).toHaveLength(1);
    expect(detectPhones('Tel 011-4555-7890')).toHaveLength(1);
    expect(detectPhones('Tel 555-0123')).toEqual([]); // fictional range
    expect(detectPhones('2026-11-13 y 13/11/2026')).toEqual([]);
    expect(detectPhones('1.284.000 y 128 42 87 y 312')).toEqual([]);
  });
  it('scanText applies the allow-list and safe domains', () => {
    const deny = parseTermList('ficticio');
    const hits = scanText('Mail persona@dominio-ficticio.com y ayuda@example.com y www.dominio-ficticio.com', deny);
    expect(hits.map((h) => h.kind).sort()).toEqual(['deny', 'deny', 'domain', 'email']);
    const allow = parseTermList('dominio-ficticio.com');
    expect(scanText('persona@dominio-ficticio.com www.dominio-ficticio.com', [], allow)).toEqual([]);
    expect(scanText('otro.io', [], allow).map((h) => h.value)).toEqual(['otro.io']);
  });
  it('collects every string of the props', () => {
    expect(collectStrings({ a: 'x', b: [{ c: 'y' }], n: 3 })).toEqual(['a', 'x', 'b', 'c', 'y', 'n']);
  });
});

describe('fold: normalizacion contra esquivos', () => {
  const deny = parseTermList('Acme Corp\nGlobex', 'substring');
  it('quita caracteres de ancho cero, guion blando y de formato', () => {
    expect(fold('Ac\u200Bme')).toBe('acme');
    expect(fold('Ac\u00ADme\u2060 \uFEFFCorp\u200D')).toBe('acme corp');
    expect(fold('Ac\u202Eme')).toBe('acme'); // bidi
    expect(matchTerms('hola Ac\u200Bme\u00AD Corp', deny)).toHaveLength(1);
  });
  it('lleva letras de ancho completo a ASCII (NFKD)', () => {
    expect(fold('ＡＣＭＥ')).toBe('acme');
    expect(fold('ＧＬＯＢＥＸ １２３')).toBe('globex 123');
    expect(matchTerms('ＧＬＯＢＥＸ', deny)).toHaveLength(1);
  });
  it('mapea ø, đ, ł, ß y otras que NFD no descompone', () => {
    expect(fold('Øđłß')).toBe('odlss');
    expect(matchTerms('Gløbex', deny)).toHaveLength(1);
    expect(matchTerms('Aćmę Çorp', parseTermList('acme corp', 'substring'))).toHaveLength(1);
    expect(matchTerms('Straße', parseTermList('strasse', 'substring'))).toHaveLength(1);
  });
  it('los correos y dominios tambien se detectan tras plegar', () => {
    expect(scanText('persona\u200B.ejemplo@dominio\u00AD-ficticio.com', []).map((h) => h.kind)).toEqual(['email']);
    expect(scanText('ｐｅｒｓｏｎａ＠ｄｏｍｉｎｉｏ-ficticio.com', []).map((h) => h.kind)).toContain('email');
  });
});

describe('modo de coincidencia', () => {
  it('substring atrapa identificadores CamelCase y snake_case; word no', () => {
    const sub = parseTermList('Acme\nGlobex', 'substring');
    const word = parseTermList('Acme\nGlobex', 'word');
    for (const t of ['AcmeClient', 'GlobexCloud', 'ACME_KEY', 'miAcmeApi']) {
      expect(matchTerms(t, sub), t).toHaveLength(1);
      expect(matchTerms(t, word), t).toHaveLength(0);
    }
  });
  it('auto: substring desde 4 letras, palabra entera para terminos cortos', () => {
    const auto = parseTermList('acme\nsol', 'auto');
    expect(matchTerms('AcmeClient', auto)).toHaveLength(1);
    expect(matchTerms('girasol solar', auto)).toHaveLength(0);
    expect(matchTerms('el sol', auto)).toHaveLength(1);
  });
  it('texto armado con spans: sin espacios coincide solo con terminos largos', () => {
    const t = parseTermList('Acme Corp\nsol', 'auto');
    expect(matchTerms('AcmeCorp', t, { squash: true })).toHaveLength(1);
    expect(matchTerms('A c m e C o r p', t, { squash: true })).toHaveLength(1);
    expect(matchTerms('un s o l', t, { squash: true })).toHaveLength(0); // 'sol' es corto: queda fuera
    expect(scanText('AcmeCorp', t, [], { squash: true }).map((h) => h.kind)).toEqual(['deny']);
  });
});

describe('regex del usuario', () => {
  it('conserva la bandera u: \\p{L} es una clase unicode, no un literal', () => {
    const t = parseTermList('/proy-\\p{L}{3}/');
    expect(t[0]!.re.flags).toContain('u');
    expect(matchTerms('ref PROY-abc', t)).toHaveLength(1);
    expect(matchTerms('ref proy-123', t)).toHaveLength(0);
    expect(matchTerms('ref proy-p{L}{3}', t)).toHaveLength(0);
  });
  it('un patron invalido (con u) da un error claro', () => {
    expect(() => parseTermList('/foo\\-bar/')).toThrow(/Regex invalida.*bandera u/);
  });
  it('textos largos se miran por ventanas y no se pierde un hit en el medio', () => {
    const t = parseTermList('/secreto-\\d+/');
    const long = `${'x '.repeat(30_000)}SECRETO-42${' y'.repeat(30_000)}`;
    expect(matchTerms(long, t)).toHaveLength(1);
  });
});

describe('scanJoined: texto armado de varios elementos', () => {
  const deny = parseTermList('mercado pago\nAcme Corp', 'auto');
  const kinds = (t: string) => scanJoined(t, deny).map((h) => `${h.kind}:${h.value}`);
  it('no fabrica un termino con el final de un elemento y el inicio de otro ("Supermercado" + "Pagó")', () => {
    expect(kinds('Supermercado\u0001Pagó 120')).toEqual([]);
    expect(kinds('Supermercado \u0002Pagó 120')).toEqual([]); // vecinos de un flex: no hay limite de palabra al empezar
    expect(kinds('Supermercadopago')).toEqual([]);
  });
  it('no cruza el limite de bloque aunque las palabras sean enteras', () => {
    expect(kinds('mercado\u0001pago')).toEqual([]);
    expect(kinds('Hola mercado\u0001Pago hoy')).toEqual([]);
  });
  it('un termino partido en spans de UNA linea sigue coincidiendo, con limite de palabra, y se informa aparte', () => {
    expect(kinds('Hola Acme Corp hoy')).toEqual(['deny-joined:acme corp', 'deny-joined:acmecorp']);
    expect(kinds('AcmeCorp')).toEqual(['deny-joined:acmecorp']);
    expect(kinds('A\u0002c\u0002m\u0002e\u0002C\u0002o\u0002r\u0002p')).toEqual(['deny-joined:acmecorp']);
    expect(kinds('MiAcmeCorp')).toEqual([]); // empieza en medio de una palabra
    expect(kinds('Acme Corporation')).toEqual([]); // termina en medio de una palabra
  });
  it('mercado pago en una sola linea de varios spans: coincide', () => {
    expect(kinds('Cuenta Mercado Pago activa')).toContain('deny-joined:mercado pago');
  });
  it('los correos se buscan por segmento, sin cruzar bloques', () => {
    expect(scanJoined('persona@dominio-ficticio.com', []).map((h) => h.kind)).toEqual(['email']);
    expect(scanJoined('persona\u0001@dominio-ficticio.com', []).map((h) => h.kind)).toEqual([]);
  });
});
