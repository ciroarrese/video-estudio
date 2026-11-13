import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import {
  Sequence, Series, clearVideos, configFor, defineVideo, deriveFormatSizes, createStage, resolveScenes, setVideoSource, useFormat, useVideoConfig, VideoRegistryError, getVideo,
} from './index';

const C = () => null;
const base = { component: C, fps: 30, durationInFrames: 10 };

describe('formatos', () => {
  it('deriva vertical y cuadrado del tamaño base', () => {
    expect(deriveFormatSizes(1920, 1080)).toEqual({
      horizontal: { width: 1920, height: 1080 }, vertical: { width: 1080, height: 1920 }, cuadrado: { width: 1080, height: 1080 },
    });
    expect(deriveFormatSizes(1280, 720).vertical).toEqual({ width: 720, height: 1280 });
    expect(deriveFormatSizes(1080, 1920).horizontal).toEqual({ width: 1920, height: 1080 });
    expect(deriveFormatSizes(1000, 1000).horizontal).toEqual({ width: 1778, height: 1000 });
  });
  it('sin `formats` el video solo admite su formato base', () => {
    const d = defineVideo({ id: 'f-solo', ...base, width: 1920, height: 1080 });
    expect(Object.keys(d.formatSizes!)).toEqual(['horizontal']);
    expect(() => configFor(d, 'vertical')).toThrow(/f-solo.*no admite el formato "vertical"/);
  });
  it('acepta lista de nombres o tamaños explícitos y valida', () => {
    const a = defineVideo({ id: 'f-lista', ...base, width: 1920, height: 1080, formats: ['vertical', 'cuadrado'] });
    expect(configFor(a, 'vertical')).toMatchObject({ width: 1080, height: 1920, format: 'vertical' });
    const b = defineVideo({ id: 'f-obj', ...base, width: 1920, height: 1080, formats: { vertical: { width: 1080, height: 1350 } } });
    expect(configFor(b, 'vertical')).toMatchObject({ width: 1080, height: 1350 });
    expect(() => defineVideo({ id: 'f-mal', ...base, width: 1920, height: 1080, formats: ['diagonal' as never] })).toThrow(/formato desconocido/);
  });
  it('useFormat da el formato, el tamaño y pick con respaldo en horizontal', () => {
    let seen: unknown;
    const Probe = () => {
      const f = useFormat();
      const c = useVideoConfig();
      seen = { format: f.format, w: c.width, h: c.height, p: f.pick({ horizontal: 'h', vertical: 'v' }) };
      return null;
    };
    const def = defineVideo({ id: 'f-probe', ...base, component: Probe, width: 1920, height: 1080, formats: ['vertical', 'cuadrado'] });
    for (const [fmt, exp] of [['horizontal', { format: 'horizontal', w: 1920, h: 1080, p: 'h' }], ['vertical', { format: 'vertical', w: 1080, h: 1920, p: 'v' }], ['cuadrado', { format: 'cuadrado', w: 1080, h: 1080, p: 'h' }]] as const) {
      const host = document.createElement('div');
      const st = createStage(host, def, {}, fmt);
      st.render(0);
      expect(seen).toEqual(exp);
      expect(host.style.width).toBe(`${exp.w}px`);
      st.destroy();
    }
  });
});

describe('registro con carpeta de origen', () => {
  it('un id repetido en dos carpetas falla nombrando las dos; en la misma se reemplaza', () => {
    clearVideos();
    setVideoSource('videos/a');
    defineVideo({ id: 'dup', ...base, width: 10, height: 10 });
    defineVideo({ id: 'dup', ...base, width: 12, height: 10 });
    setVideoSource('videos/b');
    expect(() => defineVideo({ id: 'dup', ...base, width: 10, height: 10 })).toThrow(VideoRegistryError);
    expect(() => defineVideo({ id: 'dup', ...base, width: 10, height: 10 })).toThrow(/"dup".*videos\/a.*videos\/b/);
    setVideoSource(null);
    expect(getVideo('dup')?.source).toBe('videos/a');
  });
});

describe('escenas', () => {
  it('juntan los <Sequence name> y <Series.Item name> al recorrer los cuadros, y respetan las declaradas', () => {
    const Comp = () =>
      createElement(Series, null,
        createElement(Series.Item, { durationInFrames: 4, name: 'uno' }),
        createElement(Series.Item, { durationInFrames: 6 }, createElement(Sequence, { from: 1, durationInFrames: 3, name: 'dentro' })));
    const def = defineVideo({ id: 's-scan', ...base, component: Comp, width: 10, height: 10, durationInFrames: 10 });
    const st = createStage(document.createElement('div'), def);
    expect(resolveScenes(st)).toEqual([{ id: 'uno', from: 0, durationInFrames: 4 }, { id: 'dentro', from: 5, durationInFrames: 3 }]);
    st.destroy();
    const decl = defineVideo({ id: 's-decl', ...base, width: 10, height: 10, scenes: [{ id: 'b', from: 5, durationInFrames: 5 }, { id: 'a', from: 0, durationInFrames: 5 }] });
    const st2 = createStage(document.createElement('div'), decl);
    expect(resolveScenes(st2).map((s) => s.id)).toEqual(['a', 'b']);
    st2.destroy();
    expect(() => defineVideo({ id: 's-mal', ...base, width: 10, height: 10, scenes: [{ id: '', from: 0, durationInFrames: 1 }] })).toThrow(/escena/);
  });
});

describe('validación de tamaños de formato', () => {
  it('un objeto `formats` que lista el formato base con otro tamaño se rechaza (no pisa el base)', () => {
    expect(() => defineVideo({ id: 'fv-base', ...base, width: 1920, height: 1080, formats: { horizontal: { width: 1280, height: 720 } } })).toThrow(/formats\.horizontal.*1280x720.*tamaño base.*1920x1080/);
    // con el mismo tamaño no hay conflicto
    const d = defineVideo({ id: 'fv-base-ok', ...base, width: 1920, height: 1080, formats: { horizontal: { width: 1920, height: 1080 } } });
    expect(d.formatSizes!.horizontal).toEqual({ width: 1920, height: 1080 });
  });
  it('un lado impar (base o explícito) se rechaza con un mensaje que propone los pares cercanos', () => {
    expect(() => defineVideo({ id: 'fv-impar', ...base, width: 1000, height: 563, formats: ['cuadrado'] })).toThrow(/1000x563.*impar.*height = 563.*562 o 564/);
    expect(() => defineVideo({ id: 'fv-impar2', ...base, width: 1920, height: 1080, formats: { vertical: { width: 1081, height: 1920 } } })).toThrow(/formats\.vertical.*1081x1920.*impar.*width = 1081/);
  });
});
