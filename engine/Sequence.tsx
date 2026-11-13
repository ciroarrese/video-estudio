import { Children, isValidElement, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import { TimeContext } from './context';

export type SequenceProps = {
  from: number;
  durationInFrames?: number;
  children?: ReactNode;
};

export function Sequence({ from, durationInFrames, children }: SequenceProps) {
  const parent = useContext(TimeContext);
  if (!parent) throw new Error('<Sequence> must be used inside <FrameProvider>');
  const local = parent.frame - from;
  const state = useMemo(
    () => ({
      frame: local,
      offset: parent.offset + from,
      end: Math.min(parent.end, parent.offset + from + (durationInFrames ?? Infinity)),
    }),
    [local, parent.offset, parent.end, from, durationInFrames],
  );
  if (local < 0) return null;
  if (durationInFrames !== undefined && local >= durationInFrames) return null;
  return <TimeContext.Provider value={state}>{children}</TimeContext.Provider>;
}

export type SeriesItemProps = { durationInFrames: number; children?: ReactNode };

function SeriesItem({ children }: SeriesItemProps) {
  return <>{children}</>;
}

export function Series({ children }: { children?: ReactNode }) {
  let cursor = 0;
  const out: ReactNode[] = [];
  Children.forEach(children, (child, i) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<SeriesItemProps>;
    if (el.type !== SeriesItem) {
      throw new Error('<Series> only accepts <Series.Item> children');
    }
    const d = el.props.durationInFrames;
    if (!Number.isFinite(d) || d < 0) {
      throw new Error('<Series.Item> needs a non-negative durationInFrames');
    }
    out.push(
      <Sequence key={el.key ?? i} from={cursor} durationInFrames={d}>
        {el.props.children}
      </Sequence>,
    );
    cursor += d;
  });
  return <>{out}</>;
}
Series.Item = SeriesItem;
