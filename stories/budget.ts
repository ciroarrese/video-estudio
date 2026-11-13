import { CLOSING_FRAMES, INTERLUDE_FRAMES, OPENING_FRAMES } from "./durations";
import type { StorySpec } from "./types";

/** Mínimo de cuadros por bloque generado (el mismo que valida `timing`). */
export const MIN_BLOCK_FRAMES = 60;

export type BudgetBlock = { frames: number; min: number };
export type StoryBudget = {
  fps: number;
  opening: BudgetBlock;
  /** `frames` y `min` son de UNA vuelta; `count` cuántas hay (n con vueltas, 0 sin ellas). */
  interlude: BudgetBlock & { count: number };
  closing: BudgetBlock;
  /** Escenas de tema (suma). */
  scenes: { frames: number; each: number[] };
  /** Todo lo que no es una escena de tema: apertura + vueltas + cierre. */
  generated: number;
  total: number;
  /** Duración mínima posible con este número de temas (bloques generados al mínimo + las escenas tal cual). */
  minTotal: number;
};

/** Duraciones por defecto de los bloques generados (cuadros). */
export const DEFAULT_BLOCK_FRAMES = { opening: OPENING_FRAMES, interlude: INTERLUDE_FRAMES, closing: CLOSING_FRAMES };

/**
 * Presupuesto de cuadros de una historia: cuánto dura cada bloque y cuánto es lo mínimo. `scenes` son las duraciones de las
 * escenas de tema (o las escenas mismas). Ayuda a ver, antes de renderizar, si un largo objetivo es posible: con los valores por
 * defecto (apertura 300, vuelta 120, cierre 480) solo los bloques generados de una historia de 3 temas suman 1140 cuadros (38 s a 30 fps);
 * para una pieza más corta hay que bajar `timing`.
 */
export function storyBudget(spec: StorySpec, scenes: (number | { durationInFrames: number })[] = [], opts: { interludes?: boolean; fps?: number } = {}): StoryBudget {
  const n = spec.topics.length;
  const count = (opts.interludes ?? true) ? n : 0;
  const t = spec.timing ?? {};
  const opening = t.opening ?? OPENING_FRAMES, interlude = t.interlude ?? INTERLUDE_FRAMES, closing = t.closing ?? CLOSING_FRAMES;
  const each = scenes.map((s) => (typeof s === "number" ? s : s.durationInFrames));
  const sceneFrames = each.reduce((a, b) => a + b, 0);
  const generated = opening + interlude * count + closing;
  return {
    fps: opts.fps ?? 30,
    opening: { frames: opening, min: MIN_BLOCK_FRAMES },
    interlude: { frames: interlude, min: MIN_BLOCK_FRAMES, count },
    closing: { frames: closing, min: MIN_BLOCK_FRAMES },
    scenes: { frames: sceneFrames, each },
    generated,
    total: generated + sceneFrames,
    minTotal: MIN_BLOCK_FRAMES * (2 + count) + sceneFrames,
  };
}

const sec = (frames: number, fps: number) => `${(frames / fps).toFixed(1).replace(".", ",")} s`;

/** Resumen en texto (español) del presupuesto: una línea por bloque, con el mínimo de cada uno. */
export function formatStoryBudget(b: StoryBudget): string {
  const row = (label: string, frames: number, min?: number) => `  ${label.padEnd(22)} ${String(frames).padStart(5)} cuadros  ${sec(frames, b.fps).padStart(8)}${min !== undefined ? `   (mínimo ${min})` : ""}`;
  const lines = [
    "presupuesto de la historia:",
    row("apertura", b.opening.frames, b.opening.min),
    b.interlude.count ? row(`vueltas al listado ×${b.interlude.count}`, b.interlude.frames * b.interlude.count, b.interlude.min * b.interlude.count) : "  sin vueltas al listado",
    row("cierre", b.closing.frames, b.closing.min),
    ...(b.scenes.frames ? [row(`escenas de tema ×${b.scenes.each.length}`, b.scenes.frames)] : []),
    row("total", b.total),
    `  bloques generados      ${String(b.generated).padStart(5)} cuadros  ${sec(b.generated, b.fps).padStart(8)}   (con todo al mínimo: ${b.minTotal - b.scenes.frames} cuadros, ${sec(b.minTotal - b.scenes.frames, b.fps)}; las escenas se suman aparte)`,
    "  cambiar duraciones: StorySpec.timing { opening, interlude, closing }; sin vueltas: composeStory/defineStory({ interludes: false })",
  ];
  return lines.join("\n");
}

/**
 * Presupuesto a partir de la lista de escenas de un video armado con `defineStory` (ids `opening`, `interlude-N`, `closing`
 * y el resto de temas), para `--list-scenes`. Devuelve null si la lista no parece una historia.
 */
export function budgetFromScenes(scenes: { id: string; durationInFrames: number }[], fps: number): StoryBudget | null {
  const opening = scenes.find((s) => s.id === "opening"), closing = scenes.find((s) => s.id === "closing");
  if (!opening || !closing) return null;
  const inter = scenes.filter((s) => /^interlude-\d+$/.test(s.id));
  const topics = scenes.filter((s) => s !== opening && s !== closing && !inter.includes(s));
  const each = topics.map((s) => s.durationInFrames);
  const generated = opening.durationInFrames + inter.reduce((a, s) => a + s.durationInFrames, 0) + closing.durationInFrames;
  const sceneFrames = each.reduce((a, b) => a + b, 0);
  return {
    fps,
    opening: { frames: opening.durationInFrames, min: MIN_BLOCK_FRAMES },
    interlude: { frames: inter[0]?.durationInFrames ?? 0, min: MIN_BLOCK_FRAMES, count: inter.length },
    closing: { frames: closing.durationInFrames, min: MIN_BLOCK_FRAMES },
    scenes: { frames: sceneFrames, each },
    generated, total: generated + sceneFrames, minTotal: MIN_BLOCK_FRAMES * (2 + inter.length) + sceneFrames,
  };
}
