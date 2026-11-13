import { createContext } from 'react';
import type { VideoConfig } from './config';

export type TimeState = {
  /** Frame as seen by the current component (local to the nearest Sequence). */
  frame: number;
  /** Absolute frame at which the current local time 0 happens. */
  offset: number;
  /** Absolute frame where the enclosing Sequence ends (exclusive); Infinity if unbounded. */
  end: number;
};

export const TimeContext = createContext<TimeState | null>(null);
export const ConfigContext = createContext<VideoConfig | null>(null);
