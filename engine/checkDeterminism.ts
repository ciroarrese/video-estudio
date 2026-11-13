import type { Stage } from './stage';

/** Firma de un cuadro: el HTML mas el contenido de los `<canvas>` (si el stage los expone). `unreadable` avisa de un lienzo ilegible. */
const signature = (stage: Stage): { sig: string; unreadable?: string } => {
  try {
    return { sig: stage.html() + (stage.canvasData?.() ?? '') };
  } catch (e) {
    return { sig: stage.html(), unreadable: e instanceof Error ? e.message : String(e) };
  }
};

/** `ok` es false si las firmas difieren o si algun `<canvas>` no se pudo leer (en ese caso `error` dice por que). */
export type DeterminismResult = { frame: number; ok: boolean; error?: string };

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
    const b = signature(stage);
    const unreadable = a.unreadable ?? b.unreadable;
    if (unreadable !== undefined) out.push({ frame: f, ok: false, error: `no se pudo leer un canvas, no se puede verificar el cuadro: ${unreadable}` });
    else out.push({ frame: f, ok: a.sig === b.sig });
  }
  if (prev !== null) await show(prev);
  return out;
}
