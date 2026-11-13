import { describe, expect, it } from 'vitest';
import { quiet } from './testUtils';
import { render, within } from '@testing-library/react';
import { FrameProvider, Sequence, Series, useFrame, Fill, type VideoConfig } from './index';

const config: VideoConfig = { fps: 30, width: 100, height: 100, durationInFrames: 300 };

function Show({ id }: { id: string }) {
  return <span data-testid={id}>{useFrame()}</span>;
}
const at = (frame: number, ui: React.ReactNode) => {
  const r = render(<FrameProvider frame={frame} config={config}>{ui}</FrameProvider>);
  return within(r.container);
};

describe('Sequence', () => {
  it('shifts the frame', () => {
    const r = at(25, <Sequence from={10}><Show id="a" /></Sequence>);
    expect(r.getByTestId('a').textContent).toBe('15');
  });
  it('renders nothing before from and after the duration', () => {
    expect(at(9, <Sequence from={10} durationInFrames={5}><Show id="a" /></Sequence>).queryByTestId('a')).toBeNull();
    expect(at(10, <Sequence from={10} durationInFrames={5}><Show id="a" /></Sequence>).queryByTestId('a')).not.toBeNull();
    expect(at(14, <Sequence from={10} durationInFrames={5}><Show id="a" /></Sequence>).queryByTestId('a')).not.toBeNull();
    expect(at(15, <Sequence from={10} durationInFrames={5}><Show id="a" /></Sequence>).queryByTestId('a')).toBeNull();
  });
  it('unmounts when the frame moves out of range', () => {
    const ui = (f: number) => (
      <FrameProvider frame={f} config={config}>
        <Sequence from={0} durationInFrames={5}><Show id="a" /></Sequence>
      </FrameProvider>
    );
    const r = render(ui(2));
    expect(r.queryByTestId('a')).not.toBeNull();
    r.rerender(ui(7));
    expect(r.queryByTestId('a')).toBeNull();
  });
  it('supports a negative from (starts before frame 0)', () => {
    const r = at(5, <Sequence from={-10}><Show id="a" /></Sequence>);
    expect(r.getByTestId('a').textContent).toBe('15');
    expect(at(5, <Sequence from={-10} durationInFrames={15}><Show id="a" /></Sequence>).queryByTestId('a')).toBeNull();
    expect(at(5, <Sequence from={-10} durationInFrames={16}><Show id="b" /></Sequence>).getByTestId('b').textContent).toBe('15');
  });
  it('composes when nested', () => {
    const r = at(
      100,
      <Sequence from={20}>
        <Sequence from={30}><Show id="a" /></Sequence>
      </Sequence>,
    );
    expect(r.getByTestId('a').textContent).toBe('50');
  });
  it('nested out-of-range parent hides the child', () => {
    const r = at(
      25,
      <Sequence from={0} durationInFrames={20}>
        <Sequence from={0}><Show id="a" /></Sequence>
      </Sequence>,
    );
    expect(r.queryByTestId('a')).toBeNull();
  });
});

describe('Series', () => {
  const ui = (
    <Series>
      <Series.Item durationInFrames={10}><Show id="a" /></Series.Item>
      <Series.Item durationInFrames={20}><Show id="b" /></Series.Item>
    </Series>
  );
  it('lays items back to back', () => {
    const r1 = at(5, ui);
    expect(r1.getByTestId('a').textContent).toBe('5');
    expect(r1.queryByTestId('b')).toBeNull();
    const r2 = at(10, ui);
    expect(r2.queryByTestId('a')).toBeNull();
    expect(r2.getByTestId('b').textContent).toBe('0');
    const r3 = at(29, ui);
    expect(r3.getByTestId('b').textContent).toBe('19');
    expect(at(30, ui).queryByTestId('b')).toBeNull();
  });
  it('composes inside a Sequence and a nested Series', () => {
    const r = at(
      60,
      <Sequence from={40}>
        <Series>
          <Series.Item durationInFrames={10}><Show id="a" /></Series.Item>
          <Series.Item durationInFrames={20}>
            <Series>
              <Series.Item durationInFrames={5}><Show id="x" /></Series.Item>
              <Series.Item durationInFrames={15}><Show id="y" /></Series.Item>
            </Series>
          </Series.Item>
        </Series>
      </Sequence>,
    );
    // local 20 -> second item starts at 10 -> local 10 -> y starts at 5 -> 5
    expect(r.getByTestId('y').textContent).toBe('5');
    expect(r.queryByTestId('x')).toBeNull();
  });
  it('rejects non-Item children', () => {
    quiet(() => expect(() => at(0, <Series><div /></Series>)).toThrow(/Series.Item/));
  });
});

describe('Fill', () => {
  it('is absolutely positioned', () => {
    const r = at(0, <Fill style={{ background: 'red' }}><i data-testid="c" /></Fill>);
    const div = r.getByTestId('c').parentElement!;
    expect(div.style.position).toBe('absolute');
    expect(div.style.background).toBe('red');
  });
});
