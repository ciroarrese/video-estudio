import type { Stage } from './stage';

/** Firma de un cuadro: el HTML mas el contenido de los `<canvas>` (si el stage los expone). */
const signature = (stage: Stage): string => {
  let c = '';
  try {
    c = stage.canvasData?.() ?? '';
  } catch {
    c = '';
  }
  return stage.html() + c;
};

export type DeterminismResult = { frame: number; ok: boolean };

/**
 * For each frame f: render it after frame 0 and again after a different frame, then compare the
 * stage HTML. A scene that is a pure function of the frame gives identical markup; scenes that
 * accumulate state in refs/useState/timers do not. `settle` (optional) is awaited after each render
 * (the runtime passes fonts/holds/animation frames). Restores the frame shown before.
 */
export async function checkDeterminism(
  stage: Stage,
  frames: number[],
  settle: () => Promise<void> = async () => {},
): Promise<DeterminismResult[]> {
  const last = stage.def.durationInFrames - 1;
  const prev = stage.current();
  const out: DeterminismResult[] = [];
  const show = async (n: number) => {
    stage.render(n);
    await settle();
  };
  for (const f of frames) {
    if (!Number.isInteger(f) || f < 0 || f > last) throw new RangeError(`checkDeterminism: frame ${f} out of range [0, ${last}]`);
    if (f !== 0) await show(0);
    await show(f);
    const a = signature(stage);
    await show(f === last ? Math.max(0, last - 1) : last);
    await show(f);
    out.push({ frame: f, ok: a === signature(stage) });
  }
  if (prev !== null) await show(prev);
  return out;
}
