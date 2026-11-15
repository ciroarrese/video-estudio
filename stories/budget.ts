import { CLOSING_FRAMES, INTERLUDE_COMPACT_FRAMES, INTERLUDE_FRAMES, INTERLUDE_REVEAL_FRAMES, MIN_COMPACT_FRAMES, MIN_REVEAL_FRAMES, OPENING_FRAMES } from "./durations";
import { planScenes } from "./plan";
import type { StorySpec } from "./types";

/** Mínimo de cuadros por bloque generado (el mismo que valida `timing`). */
export const MIN_BLOCK_FRAMES = 60;

export type BudgetBlock = { frames: number; min: number };
export type StoryBudget = {
  fps: number;
  opening: BudgetBlock;
  /** `frames` y `min` son de UNA vuelta; `count` cuántas hay (n con vueltas, 0 sin ellas). */
  interlude: BudgetBlock & { count: number; compact: boolean };
  /** Vuelta que revela el tema tardío (`reveal: "late"`): `count` es 1 con vueltas completas y 0 si no hay tema tardío (o con vueltas compactas, donde cuenta como una compacta). */
  reveal: BudgetBlock & { count: number };
  closing: BudgetBlock;
  /** Escenas de tema (suma). */
  scenes: { frames: number; each: number[] };
  /** Todo lo que no es una escena de tema: apertura + vueltas (con la de revelación) + cierre. */
  generated: number;
  total: number;
  /** Duración mínima posible con este número de temas (bloques generados al mínimo + las escenas tal cual). */
  minTotal: number;
};

/** Duraciones por defecto de los bloques generados (cuadros). */
export const DEFAULT_BLOCK_FRAMES = { opening: OPENING_FRAMES, interlude: INTERLUDE_FRAMES, interludeReveal: INTERLUDE_REVEAL_FRAMES, closing: CLOSING_FRAMES };

/**
 * Presupuesto de cuadros de una historia: cuánto dura cada bloque y cuánto es lo mínimo. `scenes` son las duraciones de las
 * escenas de tema (o las escenas mismas). Ayuda a ver, antes de renderizar, si un largo objetivo es posible: con los valores por
 * defecto (apertura 300, vuelta 120, cierre 480) solo los bloques generados de una historia de 3 temas suman 1140 cuadros (38 s a 30 fps);
 * para una pieza más corta hay que bajar `timing`.
 */
export function storyBudget(spec: StorySpec, scenes?: (number | { durationInFrames: number } | null)[], opts: { interludes?: boolean | "compact"; fps?: number } = {}): StoryBudget {
  // una vuelta por escena de tema (salvo las que siguen directo a la anterior: `interludeBefore: false`, tema tardío); sin la lista de escenas se supone
  // una por tema; los temas sin escena (`null`) no tienen vuelta. La vuelta que sigue a un tema tardío es la de revelación.
  const hasScene = scenes === undefined ? spec.topics.map(() => true) : spec.topics.map((_, i) => scenes[i] !== null && scenes[i] !== undefined);
  const plan = planScenes(spec, hasScene, opts.interludes ?? true).filter((p) => p.interlude);
  const compact = opts.interludes === "compact";
  const revealN = compact ? 0 : plan.filter((p) => p.interlude!.kind === "reveal").length;
  const count = plan.length - revealN;
  const imin = compact ? MIN_COMPACT_FRAMES : MIN_BLOCK_FRAMES;
  const t = spec.timing ?? {};
  const opening = t.opening ?? OPENING_FRAMES, interlude = compact ? (t.interludeCompact ?? INTERLUDE_COMPACT_FRAMES) : (t.interlude ?? INTERLUDE_FRAMES), closing = t.closing ?? CLOSING_FRAMES;
  const reveal = t.interludeReveal ?? INTERLUDE_REVEAL_FRAMES;
  const each = (scenes ?? []).filter((s): s is number | { durationInFrames: number } => s !== null && s !== undefined).map((s) => (typeof s === "number" ? s : s.durationInFrames));
  const sceneFrames = each.reduce((a, b) => a + b, 0);
  const generated = opening + interlude * count + reveal * revealN + closing;
  return {
    fps: opts.fps ?? 30,
    opening: { frames: opening, min: MIN_BLOCK_FRAMES },
    interlude: { frames: interlude, min: imin, count, compact },
    reveal: { frames: reveal, min: MIN_REVEAL_FRAMES, count: revealN },
    closing: { frames: closing, min: MIN_BLOCK_FRAMES },
    scenes: { frames: sceneFrames, each },
    generated,
    total: generated + sceneFrames,
    minTotal: MIN_BLOCK_FRAMES * 2 + imin * count + MIN_REVEAL_FRAMES * revealN + sceneFrames,
  };
}

const sec = (frames: number, fps: number) => `${(frames / fps).toFixed(1).replace(".", ",")} s`;

/** Resumen en texto (español) del presupuesto: una línea por bloque, con el mínimo de cada uno. */
export function formatStoryBudget(b: StoryBudget): string {
  const row = (label: string, frames: number, min?: number) => `  ${label.padEnd(22)} ${String(frames).padStart(5)} cuadros  ${sec(frames, b.fps).padStart(8)}${min !== undefined ? `   (mínimo ${min})` : ""}`;
  const lines = [
    "presupuesto de la historia:",
    row("apertura", b.opening.frames, b.opening.min),
    b.interlude.count ? row(`vueltas ${b.interlude.compact ? "compactas" : "al listado"} ×${b.interlude.count}`, b.interlude.frames * b.interlude.count, b.interlude.min * b.interlude.count) : "  sin vueltas al listado",
    ...(b.reveal.count ? [row("vuelta de revelación", b.reveal.frames * b.reveal.count, b.reveal.min * b.reveal.count)] : []),
    row("cierre", b.closing.frames, b.closing.min),
    ...(b.scenes.frames ? [row(`escenas de tema ×${b.scenes.each.length}`, b.scenes.frames)] : []),
    row("total", b.total),
    `  bloques generados      ${String(b.generated).padStart(5)} cuadros  ${sec(b.generated, b.fps).padStart(8)}   (con todo al mínimo: ${b.minTotal - b.scenes.frames} cuadros, ${sec(b.minTotal - b.scenes.frames, b.fps)}; las escenas se suman aparte)`,
    "  cambiar duraciones: StorySpec.timing { opening, interlude, interludeReveal, closing }; vueltas compactas: interludes: \"compact\" (por defecto 40 cuadros, mínimo 24, timing.interludeCompact); sin vueltas: interludes: false",
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
  const revealScene = scenes.find((s) => s.id === "interlude-reveal");
  const topics = scenes.filter((s) => s !== opening && s !== closing && !inter.includes(s) && s !== revealScene);
  const each = topics.map((s) => s.durationInFrames);
  // la vuelta de revelación (tema tardío) cuenta aparte, salvo que dure como una compacta (vueltas compactas: cuenta con ellas)
  const revealSeparate = !!revealScene && revealScene.durationInFrames >= MIN_BLOCK_FRAMES;
  const lapScenes = revealScene && !revealSeparate ? [...inter, revealScene] : inter;
  const generated = opening.durationInFrames + lapScenes.reduce((a, s) => a + s.durationInFrames, 0) + (revealSeparate ? revealScene!.durationInFrames : 0) + closing.durationInFrames;
  const sceneFrames = each.reduce((a, b) => a + b, 0);
  // sin la opción a mano se infiere: una vuelta de menos de 60 cuadros solo puede ser la compacta
  const compact = lapScenes.length > 0 && lapScenes[0]!.durationInFrames < MIN_BLOCK_FRAMES;
  const imin = compact ? MIN_COMPACT_FRAMES : MIN_BLOCK_FRAMES;
  return {
    fps,
    opening: { frames: opening.durationInFrames, min: MIN_BLOCK_FRAMES },
    interlude: { frames: lapScenes[0]?.durationInFrames ?? 0, min: imin, count: lapScenes.length, compact },
    reveal: { frames: revealSeparate ? revealScene!.durationInFrames : 0, min: MIN_REVEAL_FRAMES, count: revealSeparate ? 1 : 0 },
    closing: { frames: closing.durationInFrames, min: MIN_BLOCK_FRAMES },
    scenes: { frames: sceneFrames, each },
    generated, total: generated + sceneFrames, minTotal: MIN_BLOCK_FRAMES * 2 + imin * lapScenes.length + (revealSeparate ? MIN_REVEAL_FRAMES : 0) + sceneFrames,
  };
}
