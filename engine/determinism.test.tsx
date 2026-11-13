import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useRef } from 'react';
import { checkDeterminism, diffHtml, createStage, useFrame, type Stage } from './index';
import hello from '../examples/hello';

// We drive React roots directly here (no RTL act()).
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});

const stages: Stage[] = [];
afterEach(() => {
  stages.splice(0).forEach((s) => s.destroy());
});
const mk = (def: Parameters<typeof createStage>[1]) => {
  const s = createStage(document.createElement('div'), def);
  stages.push(s);
  return s;
};

function Counter() {
  const frame = useFrame();
  const renders = useRef(0);
  renders.current += 1; // history-dependent: NOT a pure function of the frame
  return <div>{frame}:{renders.current}</div>;
}

describe('checkDeterminism', () => {
  it('flags a component that accumulates state in a ref', async () => {
    const stage = mk({ id: 'bad', component: Counter, fps: 30, width: 10, height: 10, durationInFrames: 10 });
    const res = await checkDeterminism(stage, [0, 3, 9]);
    expect(res.map((r) => r.ok)).toEqual([false, false, false]);
    // dice qué elemento cambió y cómo (no solo "falló")
    expect(res[1]!.diffs![0]).toMatch(/div.*texto cambia.*"3:\d+" vs "3:\d+"/);
  });
  it('diffHtml da la ruta, el atributo y los dos valores', () => {
    const d = diffHtml('<div><p style="left:1px" data-k="a">x</p><p>y</p></div>', '<div><p style="left:2px" data-k="a">x</p><p>y</p></div>');
    expect(d).toEqual(['div > p:nth-of-type(1) "x" [data-k="a"]: style cambia ("left:1px" vs "left:2px")']);
    expect(diffHtml('<i>a</i>', '<i>a</i>')).toEqual([]);
  });
  it('passes the hello video', async () => {
    const stage = mk(hello);
    const res = await checkDeterminism(stage, [0, 1, 20, 44, 45, 89]);
    expect(res.every((r) => r.ok)).toBe(true);
  });
  it('reports an unreadable canvas as a failure instead of counting it equal', async () => {
    const stage = mk(hello);
    stage.canvasData = () => { throw new Error('tainted'); };
    const res = await checkDeterminism(stage, [0, 5]);
    expect(res.every((r) => !r.ok && /tainted/.test(r.error ?? ''))).toBe(true);
  });
  it('validates frames and restores the previous frame', async () => {
    const stage = mk(hello);
    stage.render(7);
    await expect(checkDeterminism(stage, [999])).rejects.toThrow(/out of range/);
    await checkDeterminism(stage, [10]);
    expect(stage.current()).toBe(7);
  });
});
