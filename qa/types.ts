export type Rect = { x: number; y: number; w: number; h: number };

/** `info`: probably intentional (element in motion, faded out); hidden by default, shown with --verbose. */
export type Severity = 'error' | 'warn' | 'info';
export type RuleId = 'clip' | 'offscreen' | 'safe-area' | 'overlap' | 'min-size' | 'texto-chico' | 'contrast' | 'covered' | 'unjudged' | 'signal' | 'vacio' | 'story-fit' | 'svg-escala' | 'salto' | 'foco-centro';
/** Las reglas que juzgan el texto de cada cuadro. `story-fit` no mira cuadros (mide los largos del guion de una historia): va aparte, ver `QA_RULES`. */
export const ALL_RULES: RuleId[] = ['clip', 'offscreen', 'safe-area', 'overlap', 'min-size', 'texto-chico', 'contrast', 'covered', 'unjudged', 'signal', 'svg-escala'];
/** Todas las reglas que corre `qa` por defecto: las de cada cuadro y `story-fit` (largos de títulos, nombres y bajadas de una historia por formato; solo para videos hechos con `defineStory`). */
/** `vacio`, `salto` y `foco-centro` no juzgan texto sino la composición del cuadro o el paso de un cuadro al siguiente: van aparte de `ALL_RULES`. `salto` y `foco-centro` solo miran videos que usan `data-qa-world`, `data-qa-overlay` o `data-qa-target`. */
export const QA_RULES: RuleId[] = [...ALL_RULES, 'vacio', 'salto', 'foco-centro', 'story-fit'];

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
  /** El texto completo (no el extracto de `text`) termina en "…" escrito en el propio texto: un recorte hecho al maquetar (regla `clip`). */
  endsEllipsis?: boolean;
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
  /** El texto está bajo `data-qa-decor` (adorno de una interfaz recreada) y, si el valor es `main`, es el contenido principal del cuadro. */
  decor?: boolean;
  decorMain?: boolean;
  /** El texto está bajo `data-qa-fixed-scale` (reproducción a escala fija): queda fuera del estrés de tipografía, no de las reglas. */
  fixedScale?: boolean;
  /** El texto es de un SVG (`<text>`, `<tspan>`, `<textPath>`) y si su `text-rendering` computado es `geometricPrecision` (regla `svg-escala`). */
  svgText?: boolean;
  svgPrecise?: boolean;
  /** El texto está bajo un `FocusGroup` que lo atenúa a propósito (`data-qa-focus`, kit/FocusGroup.tsx): su contraste bajo es el efecto buscado (`contrast` lo baja a info). */
  focusDim?: boolean;
  /**
   * Está dentro de un `data-qa-world` (el mundo que la cámara transforma): `zoom` es la escala de ese mundo en pantalla (ancho en pantalla / ancho de diseño),
   * `settled` que el mundo lleva `data-qa-settled` (cámara asentada sobre una señal), `key` lo identifica entre cuadros. `null`/ausente: fuera de un mundo marcado.
   */
  world?: { key: string; zoom: number; settled: boolean } | null;
  /** Está dentro de un `data-qa-overlay` (capa fija en espacio de pantalla que es anotación del video). */
  overlay?: boolean;
  /** Está dentro del `data-qa-target` (objetivo de la señal activa): nunca se exceptúa del corte de borde ni del tapado. */
  target?: boolean;
  /** Se descartó como tapa una capa `data-qa-overlay` (este texto es del mundo y no es el objetivo): se cuenta en el resumen. */
  skippedOverlay?: number;
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
  /**
   * Evidencia de pixeles: fraccion de los pixeles de las lineas del texto que cambian entre la captura normal y la captura con el texto
   * oculto (qa/png.ts `inkFractions`). Si es alta, el texto SE VE en pantalla, diga lo que diga la heuristica de tapados. La llena el runner;
   * sin ella (pruebas sobre datos, `--rules` sin contrast ni unjudged) las reglas se apoyan solo en la heuristica.
   */
  ink?: { frac: number } | null;
  /**
   * Una capa de cuadro completo, de color liso y opaca del todo, marcada `data-qa-ignore="covered"` (un `Wash` cerrado) tapa TODOS los puntos
   * muestreados del texto. No es una tapa que se informe (la marca lo dice), pero el texto no se ve: ver `visibleRuns`.
   */
  hiddenBy?: { key: string; testid: string | null } | null;
  /** Cuantas tapas candidatas (solidas) se descartaron por llevar `data-qa-ignore="covered"` (propio o heredado): la marca callo algo; se cuenta en el resumen. */
  skippedCovers?: number;
};

/** Pieza que señala algo (`data-ve-signal`, kit/signal.ts): qué es, la señal que resuelve el tema (`mark`) y si la escena la forzó. */
export type SignalMark = { kind: 'callout' | 'doodle' | 'marker' | string; piece: string; mark: string; forced: boolean; tag: string; rect: Rect; /** Reglas que una marca `data-qa-ignore` (propia o de un ancestro) calla para esta pieza. */ ignore?: string[] };

/**
 * Lo que ocupa el cuadro, para la regla `vacio` (solo formatos angostos): los tramos verticales [y0, y1] (px, unidos) donde algún elemento visible pinta algo
 * (texto, fondo, borde, imagen, svg; sin los fondos de cuadro completo), y la opacidad más alta de un velo de transición (`data-qa-veil`).
 */
export type Occupancy = { bands: number[][]; veil: number };

/** Un `data-qa-world`: su caja en pantalla, la escala (zoom de cámara) y si la cámara está asentada (`data-qa-settled`). */
export type WorldInfo = { key: string; rect: Rect; zoom: number; settled: boolean };
/** Un `data-qa-overlay` o un `data-qa-target`: su caja, su opacidad efectiva y (overlay) las cajas de lo que pinta (sin los envoltorios de cuadro completo). */
export type AnchorInfo = { key: string; tag: string; testid: string | null; text: string; rect: Rect; opacity: number; ignore: string[]; paint?: Rect[]; /** Valor de `data-qa-overlay` (`progreso`: barra fija, sin ancla). */ kind?: string };

export type PageData = { frame: number; width: number; height: number; runs: TextRun[]; /** Ocupación del cuadro (solo si la regla `vacio` está activa y el formato es angosto). */ occupancy?: Occupancy; elems: Record<string, Rect>; /** Cajas de los elementos `data-qa-fixed-scale` del cuadro. */ fixedRoots?: Rect[]; /** Coverage alpha of the elements in `elems` (same keys). */ opac?: Record<string, number>; /** Piezas que señalan algo en el cuadro (regla `signal`). */ signals?: SignalMark[]; /** Mundos, capas fijas y objetivos marcados del cuadro (solo si hay alguno). */ worlds?: WorldInfo[]; overlays?: AnchorInfo[]; targets?: AnchorInfo[] };

/**
 * Resumen de lo que `min-size` reclasificó como "detalle que se lee al acercar" (info): textos por debajo del mínimo en el cuadro
 * muestreado que, dentro de la misma escena, se ven por encima del mínimo en otro cuadro.
 */
export type DetailSummary = { texts: number; frames: number };

/** Hallazgos que callaron `data-qa-ignore` y `data-qa-decor`, por regla (solo las reglas donde callaron algo). */
export type SilencedSummary = Record<string, { ignore: number; decor: number }>;

/**
 * Cuanto del texto que hay en pantalla juzgo realmente el control (suma de textos x cuadros revisados). El ciego es peor que el defecto:
 * esta cuenta se imprime siempre y va en el JSON, para que un control que "da 0 errores" porque no mira nada se note.
 */
export type JudgedSummary = {
  /** Textos x cuadros que hay en pantalla (cada nodo de texto de cada cuadro revisado). */
  texts: number;
  /** Los que pasaron por las reglas (por lo menos `clip`, `overlap`, etc.; ver `partial` para lo que se saltearon algunas). */
  judged: number;
  /** Los que NO juzgo ninguna regla, por motivo. `total` es la suma. */
  notJudged: { total: number; hidden: number; ignoredAll: number; outside: number; invisible: number };
  /** Juzgados solo en parte: adorno (sin min-size ni contrast), bajo un velo de transicion (contrast baja a info), con una marca `data-qa-ignore` de algunas reglas, o con relleno de degradado (sin contrast). */
  partial: { decor: number; veil: number; ignoredSome: number; /** Texto con relleno transparente (degradado): `contrast` no lo puede juzgar. */ gradientText: number; /** Solo con marcas `data-qa-world`: texto del mundo que no es el objetivo (`texto-chico` solo juzga el objetivo). */ worldText?: number; /** De esos, los que el borde del cuadro corta con el mundo acercado: sus hallazgos de offscreen, covered, overlap y contrast bajan a info. */ worldCut?: number };
  /** Cuantos textos x cuadros esquivo cada regla por una marca `data-qa-ignore` (propia o heredada; `all` cuenta en todas). */
  ignoredByRule: Record<string, number>;
  /** Tapas solidas descartadas por llevar `data-qa-ignore="covered"` (textos x cuadros): la marca callo un `covered` posible. */
  coverMarkerSkipped: number;
  /** Textos del mundo con una capa `data-qa-overlay` encima que no se cuenta como tapa (textos x cuadros). */
  overlayCoverSkipped?: number;
  /** Textos que la heuristica daba por tapados de cuadro completo pero que se ven en pantalla (se juzgaron igual): no deberia pasar. */
  hiddenButVisible: number;
  /** Textos que se ven en pantalla y no los juzgo ninguna regla (cada uno es un error de la regla `unjudged`). */
  unjudgedVisible: number;
};

/** Textos de adorno (`data-qa-decor`) que quedaron fuera de `min-size` y `contrast`: cuántos textos distintos y en cuántos cuadros. */
export type DecorSummary = { texts: number; frames: number };

/**
 * Textos que `data-qa-fixed-scale` dejó fuera del estrés de tipografía (`--font-scale`): cuántos textos distintos y en cuántos cuadros.
 * `refused`: la marca cubre todo el escenario sin que haya otro texto juzgado en ningún cuadro; se rechazó (el estrés se aplicó igual) y `texts` cuenta lo que se habría eximido.
 */
export type FixedScaleSummary = { texts: number; frames: number; refused?: boolean };

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
  'texto-chico': { minPx1080: number; minOpacity: number; tolerancePx: number };
  vacio: { minFraction: number; /** Un hueco en el borde de arriba o de abajo no avisa si el del borde opuesto mide al menos esta parte de él (contenido centrado). */ balance: number };
  'min-size': { minPx1080: number; minOpacity: number; tolerancePx: number; /** Cuadros que se miran dentro de la escena para saber si un texto chico se lee al acercar la cámara (0 = no mirar: todo texto chico es error). Es el mínimo: en escenas largas se mira uno cada `probeEvery` cuadros si eso da más. */ probeFrames: number; /** Un cuadro de prueba cada tantos cuadros de la escena (con tope de 600 por escena); 0 = solo `probeFrames`, sin escalar con la duración. */ probeEvery: number };
  contrast: { error: number; warn: number; largePx1080: number; minOpacity: number };
  covered: { minOpacity: number; maxCoverFraction: number; hiddenFully: number };
  /** `minFraction`: parte de los pixeles de un texto que tiene que cambiar al ocultarlo para decir que se ve (qa/png.ts); `minDiff` esta fijo en png.ts. */
  unjudged: { minFraction: number };
  /** `px` (a 1080 de lado corto): salto mínimo de un elemento en un solo cuadro, medido contra lo que explica la cámara; `ratio`: el cuadro vecino tiene que moverse menos que `ratio` veces el salto (si no es un movimiento continuo, no un salto); `fade`: cambio de opacidad por cuadro desde el que el elemento entra o sale (no se juzga); `minOpacity`: opacidad mínima para juzgarlo. */
  salto: { px: number; ratio: number; fade: number; minOpacity: number };
  /** `zone`: parte central del cuadro (por eje) donde tiene que caer el centro del objetivo asentado (0.6 = el 60 % central); `error`: pasado este desvío (0 = centro, 1 = borde) es error en vez de aviso; `minOpacity`: opacidad mínima del objetivo. */
  'foco-centro': { zone: number; error: number; minOpacity: number };
  /** `px`: movimiento que baja a info los recortes del cuadro y el tamaño; `crossPx` (menor): movimiento con el que dos elementos que se cruzan (superposición, tapado, contraste) son una transición. */
  motion: { px: number; crossPx: number };
};

/** Lo geométrico de un cuadro vecino que necesita la regla `salto` (lo mismo que `PageData`, sin lo demás). */
export type Geom = Pick<PageData, 'runs' | 'worlds' | 'overlays' | 'targets'>;
/** Los cuadros f-1 y f+1 de un cuadro f, y si el paso (f-1, f) o (f, f+1) cruza el inicio de una escena (un corte: no es un salto). */
export type Around = { prev?: Geom; next?: Geom; cutPrev?: boolean; cutNext?: boolean };

export type RuleContext = { frame: number; width: number; height: number; runs: TextRun[]; thresholds: Thresholds; signals?: SignalMark[]; /** Mundos, capas fijas y objetivos marcados de este cuadro. */ worlds?: WorldInfo[]; overlays?: AnchorInfo[]; targets?: AnchorInfo[]; /** Cuadros vecinos (regla `salto`). */ around?: Around; /** Ocupación de este cuadro y la de los vecinos (regla `vacio`). */ occupancy?: Occupancy; neighbourOccupancy?: Occupancy[] };

export type Rule = { id: RuleId; description: string; check(ctx: RuleContext): Finding[] };
