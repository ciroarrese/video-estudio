// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { EFECTOS, EFECTOS_SR, picosDeEfectos } from './efectos';
import { correlacion, espectroPorBandas, fraccionDeEnergia } from './medidas';

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
