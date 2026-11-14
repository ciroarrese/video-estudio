// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CLICS, EFECTOS_SR } from './efectos';
import { PERFILES, generarMouse } from './mouse';
import { centroideEspectral, correlacion, detectarOnsets, duracion90Ms, espectroPorBandas, fraccionDeEnergia, planitudPorBandas } from './medidas';

const sr = EFECTOS_SR;
const NOMBRES = ['mouse', 'mouse-suave', 'mouse-marcado', 'mouse-apretar', 'mouse-doble'] as const;
const COMPLETAS = ['mouse', 'mouse-suave', 'mouse-marcado'] as const;
const PERFIL_DE: Record<string, keyof typeof PERFILES> = { mouse: 'normal', 'mouse-suave': 'suave', 'mouse-marcado': 'marcado' };
const x = Object.fromEntries(NOMBRES.map((n) => [n, CLICS[n].generar(sr)]));

/** Cada evento: de su inicio al inicio del siguiente (o al final del archivo). */
function eventos(sig: Float32Array) {
  const on = detectarOnsets(sig, sr);
  return on.map((t, i) => {
    const i0 = Math.round(t * sr);
    const i1 = Math.round((on[i + 1] ?? sig.length / sr) * sr);
    return { t, i0, i1, seg: sig.slice(i0, i1) };
  });
}
const energiaDb = (s: Float32Array) => 10 * Math.log10(s.reduce((a, v) => a + v * v, 0) + 1e-20);

describe('clic de mouse sintetizado', () => {
  it('están en CLICS con descripción y uso, y cada una se puede elegir por nombre', () => {
    for (const n of NOMBRES) {
      expect(CLICS[n], n).toBeDefined();
      expect(CLICS[n].descripcion.length, n).toBeGreaterThan(20);
      expect(CLICS[n].cuando.length, n).toBeGreaterThan(10);
    }
  });

  it('son deterministas', () => {
    for (const n of NOMBRES) expect(Buffer.from(CLICS[n].generar(sr).buffer).equals(Buffer.from(x[n].buffer)), n).toBe(true);
  });

  it('mono, pico cerca de -3 dBFS, primera y última muestra en cero y sin continua', () => {
    for (const n of NOMBRES) {
      const s = x[n];
      const pico = s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(20 * Math.log10(pico), n).toBeGreaterThan(-3.5);
      expect(20 * Math.log10(pico), n).toBeLessThan(-2.5);
      expect(s[0], n).toBe(0);
      expect(s[s.length - 1], n).toBe(0);
      expect(Math.abs(s.reduce((a, v) => a + v, 0) / s.length) / pico, n).toBeLessThan(0.005);
    }
  });

  it('estructura de dos eventos (bajada y subida) a la separación documentada, uno solo en mouse-apretar y cuatro en el doble', () => {
    for (const n of COMPLETAS) {
      const on = detectarOnsets(x[n], sr);
      expect(on, n).toHaveLength(2);
      const sep = (on[1] - on[0]) * 1000;
      const nominal = PERFILES[PERFIL_DE[n]].separacionMs;
      expect(Math.abs(sep - nominal), `${n}: ${sep.toFixed(1)} ms`).toBeLessThan(8);
      expect(sep, n).toBeGreaterThanOrEqual(70);
      expect(sep, n).toBeLessThanOrEqual(130);
    }
    expect(detectarOnsets(x['mouse-apretar'], sr)).toHaveLength(1);
    const d = detectarOnsets(x['mouse-doble'], sr);
    expect(d).toHaveLength(4);
    const entreClics = (d[2] - d[0]) * 1000;
    expect(entreClics).toBeGreaterThanOrEqual(180);
    expect(entreClics).toBeLessThanOrEqual(220);
    // Dentro de cada clic, bajada y subida a la separación de un clic común.
    for (const [a, b] of [[0, 1], [2, 3]]) expect(Math.abs((d[b] - d[a]) * 1000 - PERFILES.normal.separacionMs)).toBeLessThan(8);
  });

  it('cada evento junta el 90 % de su energía en menos de 25 ms', () => {
    for (const n of NOMBRES) {
      for (const e of eventos(x[n])) expect(duracion90Ms(x[n], sr, e.i0, e.i1), `${n} a ${(e.t * 1000).toFixed(0)} ms`).toBeLessThan(25);
    }
  });

  it('suenan a ruido y no a tono: planitud por bandas de tercio de octava (1 a 8 kHz) de cada evento >= 0,15, mientras un tono amortiguado da menos de 0,1', () => {
    // Medida: media geométrica sobre media aritmética de la potencia de las 9 bandas de tercio de octava de 1 a 8 kHz
    // (ventana de 21 ms desde medio milisegundo antes del evento). 0 = un solo tono; 1 = misma energía en todas las bandas.
    const tono = new Float32Array(3000);
    for (let i = 0; i < tono.length; i++) tono[i] = Math.sin((2 * Math.PI * 3000 * i) / sr) * Math.exp(-i / sr / 0.003);
    const ref = planitudPorBandas(tono, sr, 0);
    expect(ref).toBeLessThan(0.1);
    for (const n of NOMBRES) {
      for (const e of eventos(x[n])) {
        const f = planitudPorBandas(x[n], sr, e.i0 - Math.round(0.0005 * sr));
        expect(f, `${n} a ${(e.t * 1000).toFixed(0)} ms (${f.toFixed(3)})`).toBeGreaterThanOrEqual(0.15);
      }
    }
  });

  it('menos de 5 % de la energía bajo 300 Hz y sin altura musical: el centroide queda entre 1,5 y 10 kHz, en la zona donde los clics reales de mouse tienen su energía', () => {
    for (const n of NOMBRES) {
      expect(fraccionDeEnergia(x[n], sr, 0, 300), n).toBeLessThan(0.05);
      const c = centroideEspectral(x[n], sr);
      expect(c, n).toBeGreaterThan(1500);
      expect(c, n).toBeLessThan(10000);
    }
  });

  it('la subida es más baja que la bajada y más aguda (mouse y mouse-suave); en mouse-marcado es algo más fuerte', () => {
    for (const n of ['mouse', 'mouse-suave'] as const) {
      const [b, s] = eventos(x[n]);
      expect(energiaDb(s.seg), n).toBeLessThan(energiaDb(b.seg) - 2);
      expect(energiaDb(s.seg), n).toBeGreaterThan(energiaDb(b.seg) - 9);
      expect(centroideEspectral(s.seg, sr), n).toBeGreaterThan(centroideEspectral(b.seg, sr));
    }
    const [b, s] = eventos(x['mouse-marcado']);
    expect(energiaDb(s.seg)).toBeGreaterThan(energiaDb(b.seg));
    expect(energiaDb(s.seg)).toBeLessThan(energiaDb(b.seg) + 3);
    // Más fuerte que la subida del mouse común.
    const [b0, s0] = eventos(x.mouse);
    expect(energiaDb(s.seg) - energiaDb(b.seg)).toBeGreaterThan(energiaDb(s0.seg) - energiaDb(b0.seg) + 2);
  });

  it('las variantes se distinguen: suave < común < marcado en centroide (más de 0,25 octavas entre cada par) y espectros con correlación < 0,95', () => {
    const c = Object.fromEntries(COMPLETAS.map((n) => [n, centroideEspectral(x[n], sr)]));
    expect(Math.log2(c.mouse / c['mouse-suave'])).toBeGreaterThan(0.25);
    expect(Math.log2(c['mouse-marcado'] / c.mouse)).toBeGreaterThan(0.25);
    const sp = Object.fromEntries(COMPLETAS.map((n) => [n, espectroPorBandas(x[n], sr)]));
    expect(correlacion(sp.mouse, sp['mouse-suave'])).toBeLessThan(0.95);
    expect(correlacion(sp.mouse, sp['mouse-marcado'])).toBeLessThan(0.95);
    // El suave tiene un ataque más blando: su primer evento tarda más en juntar la energía.
    expect(duracion90Ms(x['mouse-suave'], sr, eventos(x['mouse-suave'])[0].i0, eventos(x['mouse-suave'])[0].i1)).toBeGreaterThan(duracion90Ms(x['mouse-marcado'], sr, eventos(x['mouse-marcado'])[0].i0, eventos(x['mouse-marcado'])[0].i1));
  });

  it('mouse-apretar es la bajada de mouse y el doble repite el clic completo', () => {
    const [bajada] = eventos(x.mouse);
    const [apretar] = eventos(x['mouse-apretar']);
    expect(Math.abs(energiaDb(apretar.seg.slice(0, Math.round(0.02 * sr))) - energiaDb(bajada.seg.slice(0, Math.round(0.02 * sr))))).toBeLessThan(0.5);
    expect(x['mouse-apretar'].length).toBeLessThan(x.mouse.length);
    expect(x['mouse-doble'].length / sr).toBeGreaterThan(0.28);
    expect(x['mouse-doble'].length / sr).toBeLessThan(0.45);
  });

  it('generarMouse acepta las opciones: sin subida y con tres clics da tres eventos', () => {
    expect(detectarOnsets(generarMouse(sr, 'normal', { subida: false, clics: 3, entreClicsMs: 150 }), sr)).toHaveLength(3);
  });
});
