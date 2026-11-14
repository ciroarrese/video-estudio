// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLICS, CLIC_POR_DEFECTO, EFECTOS, EFECTOS_SR, elegirClic, generarEfectos, nombreDeClic, picosDeEfectos } from './efectos';
import { correlacion, espectroDePotencia, espectroPorBandas, fraccionDeEnergia } from './medidas';

const sr = EFECTOS_SR;
const senales = Object.fromEntries(Object.entries(EFECTOS).map(([n, e]) => [n, e.generar(sr)]));
const nombres = Object.keys(senales);

describe('efectos sintetizados', () => {
  it('son deterministas', () => {
    for (const [n, e] of Object.entries(EFECTOS)) expect(Buffer.from(e.generar(sr).buffer).equals(Buffer.from(senales[n].buffer)), n).toBe(true);
  });

  it('cada uno tiene al menos 20 % de su energía entre 200 Hz y 4 kHz (se oyen en un celular o una laptop)', () => {
    for (const n of nombres) {
      expect(fraccionDeEnergia(senales[n], sr, 200, 4000), n).toBeGreaterThanOrEqual(0.2);
      // Y también con una ventana de Hann (que le resta peso al ataque).
      expect(fraccionDeEnergia(senales[n], sr, 200, 4000, true), `${n} (Hann)`).toBeGreaterThanOrEqual(0.2);
    }
  });

  it('el golpe conserva su cuerpo grave pero ya no es casi todo debajo de 150 Hz', () => {
    expect(fraccionDeEnergia(senales.golpe, sr, 0, 150)).toBeLessThan(0.5);
    expect(fraccionDeEnergia(senales.golpe, sr, 0, 400)).toBeGreaterThan(0.4);
  });

  it('el espectro de cada par es distinto (correlación de los espectros por tercios de octava < 0,7)', () => {
    const sp = Object.fromEntries(nombres.map((n) => [n, espectroPorBandas(senales[n], sr)]));
    for (let i = 0; i < nombres.length; i++) {
      for (let j = i + 1; j < nombres.length; j++) {
        expect(correlacion(sp[nombres[i]], sp[nombres[j]]), `${nombres[i]} y ${nombres[j]}`).toBeLessThan(0.7);
      }
    }
  });

  it('empiezan y terminan en cero, sin continua, y no saturan', () => {
    for (const n of nombres) {
      const x = senales[n];
      const pico = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(Math.abs(x[0]), n).toBeLessThan(1e-3);
      expect(Math.abs(x[x.length - 1]), n).toBeLessThan(1e-3);
      const media = x.reduce((a, v) => a + v, 0) / x.length;
      expect(Math.abs(media) / pico, n).toBeLessThan(0.005);
      expect(pico, n).toBeGreaterThan(0.3);
      expect(pico, n).toBeLessThanOrEqual(0.9);
    }
  });

  it('el clic es un chasquido corto y no un tono: casi toda su energía en menos de 20 ms y sin un pico espectral dominante', () => {
    const x = senales.clic;
    let eTot = 0;
    let eCorta = 0;
    for (let i = 0; i < x.length; i++) {
      eTot += x[i] ** 2;
      if (i < 0.02 * sr) eCorta += x[i] ** 2;
    }
    expect(eCorta / eTot).toBeGreaterThan(0.95);
    const b = espectroPorBandas(x, sr);
    const max = Math.max(...b);
    // Un tono puro dejaría casi todas las bandas más de 40 dB abajo; acá la mayoría de las bandas altas está cerca del máximo.
    expect(b.filter((v) => v > max - 20).length).toBeGreaterThanOrEqual(6);
  });

  it('exporta el instante del pico de cada efecto (para ancla "pico")', () => {
    const p = picosDeEfectos();
    expect(Object.keys(p).sort()).toEqual(nombres.sort());
    for (const [n, t] of Object.entries(p)) {
      expect(t, n).toBeGreaterThanOrEqual(0);
      expect(t, n).toBeLessThan(senales[n].length / sr);
    }
    // Los que llegan tarde a su pico.
    expect(p.barrido).toBeGreaterThan(0.25);
    expect(p.tilde).toBeGreaterThan(0.05);
    // Los percutidos lo tienen casi al inicio.
    expect(p.clic).toBeLessThan(0.02);
    expect(p.golpe).toBeLessThan(0.05);
  });
});

describe('variantes del clic', () => {
  // Los clics de mouse (`mouse*`) son de otra familia: dos eventos y más largos; tienen sus propias pruebas en `mouse.test.ts`.
  const esMouse = (n: string) => n.startsWith('mouse');
  const variantes = Object.keys(CLICS).filter((n) => n !== 'actual' && !esMouse(n));
  const todas = Object.keys(CLICS);
  const sinMouse = todas.filter((n) => !esMouse(n));
  const sc = Object.fromEntries(todas.map((n) => [n, CLICS[n].generar(sr)]));

  /** Centroide espectral (Hz) y tiempo (ms) hasta que la envolvente de 1 ms cae 20 dB bajo su máximo por última vez. */
  const rasgos = (x: Float32Array) => {
    const { pot, df } = espectroDePotencia(x, sr);
    let tot = 0;
    let cf = 0;
    pot.forEach((p, k) => {
      tot += p;
      cf += p * k * df;
    });
    const v = Math.round(0.001 * sr);
    const env: number[] = [];
    for (let i = 0; i + v <= x.length; i += v) env.push(x.slice(i, i + v).reduce((a, b) => a + b * b, 0) / v);
    const mx = Math.max(...env);
    let ultimo = 0;
    env.forEach((e, i) => {
      if (e > mx / 100) ultimo = i;
    });
    return { centroide: cf / tot, t20: ultimo + 1 };
  };

  it('hay ocho variantes, además de la actual, y cada una dice cómo suena y cuándo conviene', () => {
    expect(variantes).toHaveLength(8);
    expect(CLIC_POR_DEFECTO).toBe('actual');
    for (const n of todas) {
      expect(CLICS[n].descripcion.length, n).toBeGreaterThan(20);
      expect(CLICS[n].cuando.length, n).toBeGreaterThan(10);
    }
    expect(Buffer.from(sc.actual.buffer).equals(Buffer.from(senales.clic.buffer))).toBe(true);
  });

  it('son deterministas', () => {
    for (const n of todas) expect(Buffer.from(CLICS[n].generar(sr).buffer).equals(Buffer.from(sc[n].buffer)), n).toBe(true);
  });

  it('duran entre 15 y 120 ms, con pico cerca de -3 dBFS, extremos en cero y sin continua', () => {
    for (const n of variantes) {
      const x = sc[n];
      const ms = (x.length / sr) * 1000;
      expect(ms, n).toBeGreaterThanOrEqual(15);
      expect(ms, n).toBeLessThanOrEqual(120);
      const pico = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(20 * Math.log10(pico), n).toBeGreaterThan(-3.5);
      expect(20 * Math.log10(pico), n).toBeLessThan(-2.5);
      expect(Math.abs(x[0]), n).toBe(0);
      expect(Math.abs(x[x.length - 1]), n).toBe(0);
      const media = x.reduce((a, v) => a + v, 0) / x.length;
      expect(Math.abs(media) / pico, n).toBeLessThan(0.005);
    }
  });

  it('al menos 20 % de la energía entre 200 Hz y 6 kHz (se oyen en un celular), con y sin ventana de Hann', () => {
    for (const n of todas) {
      expect(fraccionDeEnergia(sc[n], sr, 200, 6000), n).toBeGreaterThanOrEqual(0.2);
      expect(fraccionDeEnergia(sc[n], sr, 200, 6000, true), `${n} (Hann)`).toBeGreaterThanOrEqual(0.2);
    }
  });

  it('cada par se distingue: espectro por tercios de octava con correlación < 0,9 y, además, centroide a más de 0,25 octavas o duración a más de 0,3 octavas', () => {
    const sp = Object.fromEntries(sinMouse.map((n) => [n, espectroPorBandas(sc[n], sr)]));
    const r = Object.fromEntries(sinMouse.map((n) => [n, rasgos(sc[n])]));
    for (let i = 0; i < sinMouse.length; i++) {
      for (let j = i + 1; j < sinMouse.length; j++) {
        const [a, b] = [sinMouse[i], sinMouse[j]];
        expect(correlacion(sp[a], sp[b]), `${a} y ${b}`).toBeLessThan(0.9);
        const dc = Math.abs(Math.log2(r[a].centroide / r[b].centroide));
        const dt = Math.abs(Math.log2(r[a].t20 / r[b].t20));
        expect(Math.max(dc / 0.25, dt / 0.3), `${a} y ${b}: centroide ${r[a].centroide.toFixed(0)} y ${r[b].centroide.toFixed(0)} Hz, duración ${r[a].t20} y ${r[b].t20} ms`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('ninguna es un tono puro ni un pitido: el ancho de banda no es angosto', () => {
    for (const n of todas) {
      const b = espectroPorBandas(sc[n], sr);
      const max = Math.max(...b);
      expect(b.filter((v) => v > max - 30).length, n).toBeGreaterThanOrEqual(4);
    }
  });

  it('generarEfectos escribe clic-<nombre> de todas y deja `clic` como el actual salvo que se elija otro', () => {
    const dir = mkdtempSync(join(tmpdir(), 'clics-'));
    try {
      generarEfectos(dir);
      const actual = readFileSync(join(dir, 'clic.wav'));
      for (const n of todas) expect(() => readFileSync(join(dir, `${nombreDeClic(n)}.wav`)), n).not.toThrow();
      expect(readFileSync(join(dir, nombreDeClic('actual'))  + '.wav').equals(actual)).toBe(true);
      generarEfectos(dir, sr, { clic: 'thock' });
      const thock = readFileSync(join(dir, 'clic.wav'));
      expect(thock.equals(readFileSync(join(dir, 'clic-thock.wav')))).toBe(true);
      expect(thock.equals(actual)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('un nombre de clic que no existe da un error que lista las opciones', () => {
    expect(() => elegirClic('inexistente')).toThrow(/thock/);
    expect(() => generarEfectos(join(tmpdir(), 'no-se-usa'), sr, { clic: 'zzz' })).toThrow(/zzz/);
  });
});
