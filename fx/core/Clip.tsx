import React from "react";
import { Sequence } from "../../engine";

/** Monta sus hijos solo desde `start` durante `duration` cuadros (y `holdAfter` mas); `useFrame()` adentro es local. */
export function Clip({ start, duration, holdAfter = 0, children }: { start: number; duration: number; holdAfter?: number; children?: React.ReactNode }) {
  return (
    <Sequence from={start} durationInFrames={duration + holdAfter}>
      {children}
    </Sequence>
  );
}
