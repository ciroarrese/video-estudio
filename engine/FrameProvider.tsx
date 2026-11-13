import { useMemo, type ReactNode } from 'react';
import type { VideoConfig } from './config';
import { ConfigContext, TimeContext } from './context';

export function FrameProvider({
  frame,
  config,
  children,
}: {
  frame: number;
  config: VideoConfig;
  children?: ReactNode;
}) {
  const time = useMemo(() => ({ frame, offset: 0, end: Infinity }), [frame]);
  return (
    <ConfigContext.Provider value={config}>
      <TimeContext.Provider value={time}>{children}</TimeContext.Provider>
    </ConfigContext.Provider>
  );
}
