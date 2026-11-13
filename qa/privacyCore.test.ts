import { describe, expect, it } from 'vitest';
import { collectStrings, detectDomains, detectEmails, detectPhones, fold, isSafeDomain, matchTerms, parseTermList, scanText } from './privacyCore';

describe('deny list', () => {
  it('parses terms, regexes and comments', () => {
    const t = parseTermList('# comment\n\nAcme Corp  # trailing\n/proy-\\d+/\n');
    expect(t.map((x) => [x.raw, x.kind])).toEqual([['Acme Corp', 'term'], ['/proy-\\d+/', 'regex']]);
    expect(() => parseTermList('/(/')).toThrow(/Regex invalida/);
  });
  it('is case and accent insensitive', () => {
    const t = parseTermList('Josefina Pérez\nmaría');
    expect(matchTerms('hola JOSEFINA PEREZ!', t)).toHaveLength(1);
    expect(matchTerms('Maria y MARÍA', t)).toHaveLength(2);
    expect(fold('Ñandú Ç')).toBe('nandu c');
  });
  it('respects word boundaries', () => {
    const t = parseTermList('ana');
    expect(matchTerms('Ana', t)).toHaveLength(1);
    expect(matchTerms('banana, anaconda, ana.', t)).toHaveLength(1);
    expect(matchTerms('ana-maria', t)).toHaveLength(1);
    expect(matchTerms('canal', t)).toHaveLength(0);
  });
  it('matches multi-word terms across whitespace and regexes on folded text', () => {
    const t = parseTermList('Estudio  Norte\n/proy-\\d{3}/');
    expect(matchTerms('el estudio\nnorte cierra', t)).toHaveLength(1);
    expect(matchTerms('ref PROY-123', t)).toHaveLength(1);
    expect(matchTerms('proy-12', t)).toHaveLength(0);
  });
});

describe('e-mail / domain / phone detection', () => {
  it('finds e-mails', () => {
    expect(detectEmails('Escribi a lucia.paredes@lumbrera-datos.com, gracias')).toEqual(['lucia.paredes@lumbrera-datos.com']);
    expect(detectEmails('sin correo @ aca')).toEqual([]);
  });
  it('finds real-looking domains but not files, versions or sentences', () => {
    expect(detectDomains('visita www.lumbrera-datos.com/ayuda')).toEqual(['www.lumbrera-datos.com']);
    expect(detectDomains('index.html v1.2.3 foo.png Elemento.beta 3.14')).toEqual([]);
    expect(detectDomains('mail a@lumbrera-datos.com')).toEqual([]);
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
    const deny = parseTermList('lumbrera');
    const hits = scanText('Mail lucia@lumbrera-datos.com y ayuda@example.com y www.lumbrera-datos.com', deny);
    expect(hits.map((h) => h.kind).sort()).toEqual(['deny', 'deny', 'domain', 'email']);
    const allow = parseTermList('lumbrera-datos.com');
    expect(scanText('lucia@lumbrera-datos.com www.lumbrera-datos.com', [], allow)).toEqual([]);
    expect(scanText('otro.io', [], allow).map((h) => h.value)).toEqual(['otro.io']);
  });
  it('collects every string of the props', () => {
    expect(collectStrings({ a: 'x', b: [{ c: 'y' }], n: 3 })).toEqual(['a', 'x', 'b', 'c', 'y', 'n']);
  });
});
