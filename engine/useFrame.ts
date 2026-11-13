import { useContext } from 'react';
import { ConfigContext, TimeContext } from './context';
import type { VideoConfig } from './config';

/** Current frame, local to the nearest enclosing Sequence. */
export function useFrame(): number {
  const t = useContext(TimeContext);
  if (!t) throw new Error('useFrame must be used inside <FrameProvider>');
  return t.frame;
}

export function useVideoConfig(): VideoConfig {
  const c = useContext(ConfigContext);
  if (!c) throw new Error('useVideoConfig must be used inside <FrameProvider>');
  return c;
}
