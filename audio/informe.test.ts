// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { codificar, decodificar, escribirWav16, hayFfmpeg } from './ffmpeg';
import { estadoDeMargen, formatearInforme, informar, intervalosActivos } from './informe';
import { mezclar } from './mezcla';
import { rmsDb } from './medidas';
import { pistaDeBateria, pistaDeVoz, ruidoDeterminista } from './pistas-de-prueba';
import { sonoridadIntegrada } from './sonoridad';
import { rasgosDeVoz, vozProbable } from './voz';

const sr = 48000;
const ok = hayFfmpeg();
let dir = '';
const w = (n: string) => join(dir, n);

/** Música sintética: colchón de acordes y percusión (sin voz). */
function musicaDePrueba(seconds: number, amp = 0.12): Float32Array {
  const bat = pistaDeBateria({ bpm: 120, seconds, sr });
  for (let i = 0; i < bat.length; i++) bat[i]! += amp * (Math.sin((2 * Math.PI * 220 * i) / sr) + Math.sin((2 * Math.PI * 277 * i) / sr) + Math.sin((2 * Math.PI * 330 * i) / sr));
  return bat;
}
/** Un efecto corto de 1 kHz de amplitud `amp` (200 ms). */
function efecto(amp: number): Float32Array {
  const x = new Float32Array(Math.round(0.2 * sr));
  for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * 1000 * i) / sr) * Math.exp(-i / sr / 0.08);
  return x;
}

beforeAll(() => {
  if (!ok) return;
  dir = mkdtempSync(join(tmpdir(), 've-informe-'));
  escribirWav16(w('musica.wav'), musicaDePrueba(12), sr, 1);
  escribirWav16(w('fuerte.wav'), efecto(0.6), sr, 1);
  escribirWav16(w('suave.wav'), efecto(0.01), sr, 1);
  escribirWav16(w('voz.wav'), pistaDeVoz({ seconds: 3, sr, frases: [[0.2, 2.8]] }), sr, 1);
});
afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('estadoDeMargen', () => {
  it('umbrales documentados', () => {
    expect(estadoDeMargen(-20, -40)).toBe('sobresale');
    expect(estadoDeMargen(-20, -23)).toBe('justo');
    expect(estadoDeMargen(-20, -17)).toBe('casi-tapado');
    expect(estadoDeMargen(-30, -17)).toBe('tapado');
    expect(estadoDeMargen(-20, null)).toBe('libre');
    expect(estadoDeMargen(-80, -40)).toBe('inaudible');
  });
});

describe('intervalosActivos', () => {
  it('une los huecos cortos y devuelve donde suena', () => {
    const x = new Float32Array(10 * sr);
    for (let i = 1 * sr; i < 3 * sr; i++) x[i] = 0.2 * Math.sin(i * 0.3);
    for (let i = Math.round(3.1 * sr); i < 4 * sr; i++) x[i] = 0.2 * Math.sin(i * 0.3);
    for (let i = 6 * sr; i < 7 * sr; i++) x[i] = 0.2 * Math.sin(i * 0.3);
    const t = intervalosActivos(x, sr);
    expect(t.map((q) => [Math.round(q.desde), Math.round(q.hasta)])).toEqual([[1, 4], [6, 7]]);
  });
});

describe('voz probable', () => {
  it('detecta la voz sintética y no la música ni el ruido', () => {
    const v = pistaDeVoz({ seconds: 8, sr: 16000, frases: [[0.2, 2], [2.6, 5], [5.4, 7.8]] });
    const tv = vozProbable(v, 16000);
    expect(tv.length).toBe(3);
    expect(tv[0]!.desde).toBeCloseTo(0.2, 1);
    expect(vozProbable(musicaDePrueba(8).filter((_, i) => i % 3 === 0), 16000)).toEqual([]);
    const r = ruidoDeterminista(5);
    expect(vozProbable(Float32Array.from({ length: 8 * 16000 }, () => 0.2 * r()), 16000)).toEqual([]);
    expect(rasgosDeVoz(v.subarray(3200, 32000), 16000).silabico).toBeGreaterThan(0.5);
  });
  it('encuentra la voz dentro de una pista más larga y la ubica en el tiempo', () => {
    const x = new Float32Array(20 * 16000);
    x.set(pistaDeVoz({ seconds: 4, sr: 16000, frases: [[0, 4]] }), 9 * 16000);
    const t = vozProbable(x, 16000);
    expect(t).toHaveLength(1);
    expect(t[0]!.desde).toBeCloseTo(9, 0);
    expect(t[0]!.hasta).toBeCloseTo(13, 0);
  });
});

describe.skipIf(!ok)('informe de mezcla', () => {
  it('detecta un efecto tapado, uno que sobresale, y los margenes salen en dB', async () => {
    const i = await informar({
      fps: 30, durationFrames: 360, sfxDir: dir, sr,
      cues: [{ frame: 30, sfx: 'fuerte' }, { frame: 150, sfx: 'suave' }],
      musica: { archivo: w('musica.wav'), gain: 0.4 }, duck: { db: 0 },
    });
    const [a, b] = i.cues;
    expect(a!.estado).toBe('sobresale');
    expect(b!.estado).toBe('tapado');
    expect(a!.margenDb!).toBeGreaterThan(6);
    expect(b!.margenDb!).toBeLessThan(-6);
    expect(i.avisos.some((x) => /Cue 2 .*TAPADO/.test(x))).toBe(true);
    expect(i.resumen.porEstado.tapado).toBe(1);
    expect(i.lineaDeTiempo.some((e) => e.tipo === 'cue' && e.texto.includes('tapado'))).toBe(true);
    expect(formatearInforme(i)).toContain('Cues: 2');
  });

  it('el ducking sube el margen de un efecto y el informe lo muestra contra el caso sin ducking', async () => {
    const i = await informar({ fps: 30, durationFrames: 360, sfxDir: dir, sr, cues: [{ frame: 60, sfx: 'fuerte' }], musica: { archivo: w('musica.wav') }, duck: { db: 10 } });
    const c = i.cues[0]!;
    expect(c.margenDb! - c.margenSinDuckDb!).toBeGreaterThan(6);
  });

  it('detecta la música pisando una escena con audio propio y un efecto dentro de ella', async () => {
    const i = await informar({
      fps: 30, durationFrames: 360, sfxDir: dir, sr, cues: [{ frame: 270, sfx: 'fuerte' }], musica: { archivo: w('musica.wav') },
      propios: [{ escena: 'cierre', desdeSec: 8, hastaSec: 12 }],
    });
    const tipos = i.solapamientos.map((s) => s.tipo);
    expect(tipos).toContain('musica-audio-propio');
    expect(tipos).toContain('cue-audio-propio');
    const m = i.solapamientos.find((s) => s.tipo === 'musica-audio-propio')!;
    expect(m.desdeSec).toBeCloseTo(8, 1);
    expect(i.cues[0]!.enAudioPropio).toBe(true);
  });

  it('con el hueco de la música no hay solapamiento y el silencio se atribuye al audio propio', async () => {
    const i = await informar({
      fps: 30, durationFrames: 360, sfxDir: dir, sr, cues: [], musica: { archivo: w('musica.wav'), huecos: [{ desdeSec: 8, fadeSec: 0.5 }] },
      propios: [{ escena: 'cierre', desdeSec: 8, hastaSec: 12 }],
    });
    expect(i.solapamientos).toEqual([]);
    expect(i.silencios.find((s) => s.pista === 'musica')?.motivo).toMatch(/cierre/);
    expect(i.pistas.find((p) => p.nombre === 'musica')!.hastaSec!).toBeLessThan(8.1);
  });

  it('avisa los silencios de una pista y que la música termina antes del video', async () => {
    const x = musicaDePrueba(12);
    x.fill(0, 4 * sr, 7 * sr); // pausa propia de 3 s
    escribirWav16(w('con-pausa.wav'), x.subarray(0, 9 * sr), sr, 1); // y termina a los 9 s
    const i = await informar({ fps: 30, durationFrames: 360, sfxDir: dir, sr, cues: [], musica: { archivo: w('con-pausa.wav') }, silencioMinSec: 1 });
    const m = i.silencios.filter((s) => s.pista === 'musica');
    expect(m.find((s) => s.ubicacion === 'interno')).toMatchObject({ desdeSec: expect.closeTo(4, 1), hastaSec: expect.closeTo(7, 1) });
    expect(m.find((s) => s.ubicacion === 'final')!.desdeSec).toBeGreaterThan(8.5);
    expect(i.avisos.some((a) => /La música termina/.test(a))).toBe(true);
  });

  it('detecta una voz sintética en una pista que no es la de voz y la marca como no pedida; --voz-esperada la acepta', async () => {
    const base = { fps: 30, durationFrames: 360, sfxDir: dir, sr, cues: [], musica: { archivo: w('musica.wav') }, pistas: [{ nombre: 'cierre', archivo: w('voz.wav'), enSec: 8 }] };
    const i = await informar(base);
    const v = i.voz.filter((x) => x.pista === 'cierre');
    expect(v).toHaveLength(1);
    expect(v[0]!.desdeSec).toBeCloseTo(8.2, 1);
    expect(v[0]!.esperada).toBe(false);
    expect(i.resumen.vozInesperada).toBe(1);
    expect(i.avisos.some((a) => /voz probable en "cierre"/.test(a))).toBe(true);
    expect(i.voz.filter((x) => x.pista === 'musica')).toEqual([]);
    const j = await informar({ ...base, vozEsperada: ['cierre'] });
    expect(j.resumen.vozInesperada).toBe(0);
    // la pista extra suena a la vez que la música: solapamiento entre pistas
    expect(i.solapamientos.some((s) => s.tipo === 'pistas')).toBe(true);
  });

  it('es determinista: dos corridas dan el mismo informe', async () => {
    const o = { fps: 30, durationFrames: 360, sfxDir: dir, sr, cues: [{ frame: 30, sfx: 'fuerte' as const }], musica: { archivo: w('musica.wav') } };
    expect(JSON.stringify(await informar(o))).toBe(JSON.stringify(await informar(o)));
  });
});

describe.skipIf(!ok)('musica y efectos', () => {
  const cues = [{ frame: 30, sfx: 'fuerte' }, { frame: 120, sfx: 'fuerte', gain: 0.7 }, { frame: 240, sfx: 'suave', gain: 3 }];
  const base = { fps: 30, durationFrames: 360, sfxDir: '', sr, duck: { db: 0 } };

  it('--lufs con --musica-gain avisa que el objetivo fija el nivel; sin --lufs no avisa; con --musica-bajo-efectos tampoco', async () => {
    const o = { ...base, sfxDir: dir, cues };
    const salida = w('a.wav');
    const a = await mezclar({ ...o, musica: { archivo: w('musica.wav'), gain: 0.3 }, lufs: -16, salida });
    expect(a.advertencias.some((x) => /--lufs -16 y --musica-gain 0.3/.test(x) && /--musica-bajo-efectos/.test(x))).toBe(true);
    const b = await mezclar({ ...o, musica: { archivo: w('musica.wav'), gain: 0.3 }, salida });
    expect(b.advertencias.some((x) => /--musica-gain 0.3 a la vez/.test(x))).toBe(false);
    const c = await mezclar({ ...o, musica: { archivo: w('musica.wav'), bajoEfectosDb: 10 }, lufs: -16, salida });
    expect(c.advertencias.some((x) => /a la vez/.test(x))).toBe(false);
  });

  it('la música queda a la distancia pedida de los efectos (medida en archivos separados, dentro de 1 dB)', async () => {
    const o = { ...base, sfxDir: dir, cues };
    for (const pedido of [6, 12, -3]) {
      const m = await mezclar({ ...o, musica: { archivo: w('musica.wav'), bajoEfectosDb: pedido }, salida: w('rel.wav') });
      const g = m.info.relacionMusicaEfectos!;
      expect(g.pedidoDb).toBe(pedido);
      // medida independiente: efectos solos y música sola (con la ganancia que se le aplicó), cada uno en su propio archivo
      await mezclar({ ...o, salida: w('solo-sfx.wav') });
      await mezclar({ ...o, cues: [], musica: { archivo: w('musica.wav'), gain: 0.6 * Math.pow(10, g.gananciaMusicaDb / 20) }, salida: w('solo-mus.wav') });
      const sfx = await decodificar(w('solo-sfx.wav'), { sr, canales: 2 });
      const mus = await decodificar(w('solo-mus.wav'), { sr, canales: 2 });
      const dif = sonoridadIntegrada(sfx, sr, 2) - sonoridadIntegrada(mus, sr, 2);
      expect(Math.abs(dif - pedido)).toBeLessThan(1);
    }
  });

  it('--lufs lleva el conjunto al objetivo y la relación se mantiene', async () => {
    const o = { ...base, sfxDir: dir, cues };
    const a = await mezclar({ ...o, musica: { archivo: w('musica.wav'), bajoEfectosDb: 9 }, salida: w('r1.wav') });
    const b = await mezclar({ ...o, musica: { archivo: w('musica.wav'), bajoEfectosDb: 9 }, lufs: -20, techoDbtp: 0, salida: w('r2.wav') });
    expect(a.info.relacionMusicaEfectos).toEqual(b.info.relacionMusicaEfectos);
    expect(b.info.lufsFinal!).toBeCloseTo(-20, 0);
  });

  it('sin efectos no se puede medir la relación: avisa y no la aplica', async () => {
    const m = await mezclar({ ...base, sfxDir: dir, cues: [], musica: { archivo: w('musica.wav'), bajoEfectosDb: 12 }, salida: w('s.wav') });
    expect(m.advertencias.some((x) => /--musica-bajo-efectos necesita/.test(x))).toBe(true);
    expect(m.info.relacionMusicaEfectos).toBeUndefined();
  });

  it('un hueco calla la música ANTES del audio propio y la deja volver después', async () => {
    const m = await mezclar({ ...base, sfxDir: dir, cues: [], musica: { archivo: w('musica.wav'), fadeOutSec: 0, huecos: [{ desdeSec: 4, hastaSec: 6, fadeSec: 0.5 }] }, salida: w('h.wav') });
    expect(m.stems).toBe('musica');
    const x = await decodificar(w('h.wav'), { sr, canales: 1 });
    const nivel = (a: number, b: number) => rmsDb(x, Math.round(a * sr), Math.round((b - a) * sr));
    expect(nivel(2, 3)).toBeGreaterThan(-35);
    expect(nivel(4, 6)).toBeLessThan(-80); // callada en todo el tramo del audio propio
    expect(nivel(3.85, 3.95)).toBeLessThan(nivel(2, 3) - 6); // ya está bajando antes de que empiece
    expect(nivel(7, 9)).toBeGreaterThan(-35); // vuelve
  });

  it('la mezcla es determinista (mismas entradas, mismo wav)', async () => {
    const o = { ...base, sfxDir: dir, cues, musica: { archivo: w('musica.wav'), bajoEfectosDb: 12, huecos: [{ desdeSec: 9, fadeSec: 0.5 }] } };
    await mezclar({ ...o, salida: w('d1.wav') });
    await mezclar({ ...o, salida: w('d2.wav') });
    const a = await decodificar(w('d1.wav'), { sr, canales: 2 });
    const b = await decodificar(w('d2.wav'), { sr, canales: 2 });
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(true);
    void codificar;
  });
});
