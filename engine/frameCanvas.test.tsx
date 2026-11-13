import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FrameCanvas, FrameProvider } from './index';
import { quiet } from './testUtils';

const config = { fps: 30, width: 100, height: 50, durationInFrames: 10 };

function fakeCtx() {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => void calls.push(`${k}(${a.join(',')})`)),
    set: (t, k: string, v) => ((t[k] = v), true),
  });
  return { ctx, calls };
}

describe('FrameCanvas', () => {
  it('clears and redraws on every frame with the right frame number and size', () => {
    const { ctx, calls } = fakeCtx();
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const seen: number[] = [];
    const draw = (_c: CanvasRenderingContext2D, f: number, s: { width: number; height: number }) => {
      seen.push(f);
      expect(s).toEqual({ width: 100, height: 50 });
    };
    const el = (f: number) => (
      <FrameProvider frame={f} config={config}>
        <FrameCanvas width={100} height={50} draw={draw} />
      </FrameProvider>
    );
    const { rerender, container } = render(el(3));
    rerender(el(7));
    rerender(el(1));
    expect(seen).toEqual([3, 7, 1]);
    expect(calls.filter((c) => c.startsWith('clearRect')).length).toBe(3);
    expect(container.querySelector('canvas')!.getAttribute('width')).toBe('100');
    spy.mockRestore();
  });
  it('tolerates a missing 2d context', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() => render(<FrameProvider frame={0} config={config}><FrameCanvas width={10} height={10} draw={() => {}} /></FrameProvider>)).not.toThrow();
    spy.mockRestore();
  });
  it('resets the context before every draw, even after a draw that threw or left save() unbalanced', () => {
    const { ctx, calls } = fakeCtx();
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const el = (f: number, draw: () => void) => (
      <FrameProvider frame={f} config={config}>
        <FrameCanvas width={100} height={50} draw={draw} />
      </FrameProvider>
    );
    quiet(() => {
      expect(() => render(el(1, () => { (ctx as unknown as CanvasRenderingContext2D).save(); throw new Error('boom'); }))).toThrow('boom');
    });
    // el restore() del try/finally corre aunque el dibujo haya lanzado
    expect(calls.filter((c) => c.startsWith('restore')).length).toBe(1);
    calls.length = 0;
    render(el(2, () => { (ctx as unknown as CanvasRenderingContext2D).save(); (ctx as unknown as CanvasRenderingContext2D).save(); }));
    const first = calls.findIndex((c) => c.startsWith('reset'));
    expect(first).toBe(0);
    expect(calls.findIndex((c) => c.startsWith('clearRect'))).toBeGreaterThan(first);
    spy.mockRestore();
  });
});
