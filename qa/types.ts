export type Rect = { x: number; y: number; w: number; h: number };

/** `info`: probably intentional (element in motion, faded out); hidden by default, shown with --verbose. */
export type Severity = 'error' | 'warn' | 'info';
export type RuleId = 'clip' | 'offscreen' | 'safe-area' | 'overlap' | 'min-size' | 'contrast' | 'covered';
export const ALL_RULES: RuleId[] = ['clip', 'offscreen', 'safe-area', 'overlap', 'min-size', 'contrast', 'covered'];

/** Short, serialisable description of an element (tag, test id, text excerpt, on-screen box). */
export type ElementInfo = { tag: string; testid: string | null; text: string; rect: Rect; /** DOM child-index path from the stage ("0.2.1"), a fallback id when there is no test id. */ path?: string };

export type ClipBox = { id: number; tag: string; testid: string | null; rect: Rect; ox: boolean; oy: boolean };

/** One text node as seen on screen, collected inside the page (see collect.inpage.js). */
export type TextRun = {
  id: number;
  /** Identity across frames (DOM path + tag + test id + text), used to measure motion. */
  key: string;
  /** Largest edge displacement (px) of this text between this frame and its neighbours; 0 when not matched. */
  motion?: number;
  /** Largest change of the effective opacity of this text between this frame and its neighbours (0 when not matched): > 0 means mid-fade. */
  fade?: number;
  /** An element at or above a surface painted behind the text has opacity < 1: the sampled background is mid-fade together with the text (see collect.inpage.js). */
  fadingBg?: boolean;
  /** Id of the element that owns the text node, and of every element up to (excluding) the stage. */
  elId: number;
  chain: number[];
  tag: string;
  testid: string | null;
  text: string;
  /** Union of the line rects, in frame pixels (transforms already applied). */
  rect: Rect;
  lines: Rect[];
  /** Product of the opacity of the element and its ancestors. */
  opacity: number;
  /** CSS font size, cumulative transform scale (vertical) and the product: font size on screen in px. */
  fontPx: number;
  scale: number;
  /** An ancestor scales/rotates the text (camera or zoom): partial visibility is then usually framing, not a layout slip. */
  transformed: boolean;
  screenPx: number;
  bold: boolean;
  /** Text colour as `rgba(r,g,b,a)`; `transparentFill` when the glyph fill is invisible (gradient text). */
  color: string;
  transparentFill: boolean;
  ignore: string[];
  clips: ClipBox[];
  own: { sw: number; cw: number; sh: number; ch: number; ox: string; oy: string; ellipsis: boolean };
  /**
   * Opaque element over the text, found by sampling 5 points along each line (elementsFromPoint). `frac` is the share
   * of the sampled points it covers (1 = all, 0.4 = two of five). Solid = opaque background colour, background image/gradient, img, video, canvas.
   */
  cover: (ElementInfo & { ignore: string[]; id: number; key: string; motion?: number; frac?: number; /** Opacidad efectiva del elemento que tapa (con la de sus ancestros). */ opacity?: number }) | null;
  /**
   * Translucent full-frame element above the text (opacity x background alpha in [0.02, 0.9): a scene wash mid-fade, or a static veil).
   * `fade` (set by applyMotion) is the largest change of that opacity between this frame and its neighbours (an absent veil counts as 0).
   */
  veil?: { key: string; opacity: number; testid: string | null; fade?: number } | null;
  /** Background under the text box (text hidden), filled by the runner when the contrast rule is on. */
  bg?: { r: number; g: number; b: number; samples: number } | null;
};

export type PageData = { frame: number; width: number; height: number; runs: TextRun[]; elems: Record<string, Rect>; /** Coverage alpha of the elements in `elems` (same keys). */ opac?: Record<string, number> };

/**
 * Resumen de lo que `min-size` reclasificó como "detalle que se lee al acercar" (info): textos por debajo del mínimo en el cuadro
 * muestreado que, dentro de la misma escena, se ven por encima del mínimo en otro cuadro.
 */
export type DetailSummary = { texts: number; frames: number };

export type Finding = {
  rule: RuleId;
  severity: Severity;
  frame: number;
  message: string;
  element: ElementInfo;
  /** Second element for pair rules (overlap) or the covering element (covered). */
  other?: ElementInfo;
  data?: Record<string, number | string | boolean>;
};

export type Thresholds = {
  clip: { tolerancePx: number; minHiddenFraction: number; minOpacity: number; maxFrames: number };
  offscreen: { tolerancePx: number; minOpacity: number; maxFrames: number; slipPct: number; /** Rebaba (px) que, con la cámara en movimiento, se informa como info. */ sliverPx: number; /** Desplazamiento mínimo (px) entre cuadros para decir que la cámara se mueve. */ cameraPx: number };
  'safe-area': { margin: number; minOpacity: number };
  overlap: { ratio: number; minOpacity: number; inkHeight: number; maxFrames: number };
  'min-size': { minPx1080: number; minOpacity: number; tolerancePx: number; /** Cuadros que se miran dentro de la escena para saber si un texto chico se lee al acercar la cámara (0 = no mirar: todo texto chico es error). */ probeFrames: number };
  contrast: { error: number; warn: number; largePx1080: number; minOpacity: number };
  covered: { minOpacity: number; maxCoverFraction: number; hiddenFully: number };
  /** `px`: movimiento que baja a info los recortes del cuadro y el tamaño; `crossPx` (menor): movimiento con el que dos elementos que se cruzan (superposición, tapado, contraste) son una transición. */
  motion: { px: number; crossPx: number };
};

export type RuleContext = { frame: number; width: number; height: number; runs: TextRun[]; thresholds: Thresholds };

export type Rule = { id: RuleId; description: string; check(ctx: RuleContext): Finding[] };
