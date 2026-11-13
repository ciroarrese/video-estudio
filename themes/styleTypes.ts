/**
 * Capa de estilo del tema (`theme.style`): lo que hace que dos design systems den dos estéticas y no el mismo video reteñido.
 * Los colores, las tipografías, los radios y las sombras siguen en el resto del tema; acá van las decisiones de forma, superficie,
 * tratamiento del texto, fondo, movimiento, decoración y diseño de las historias. Contrato completo: `docs/estilo.md`.
 */

/** Valores aceptados de cada campo enumerado. Es la única fuente: los tipos, la validación y los informes salen de acá. */
export const STYLE_ENUMS = {
  corners: ["pill", "rounded", "sharp"],
  surfaceKind: ["solid", "glass", "outline", "tinted"],
  elevation: ["shadow", "flat", "border", "glow"],
  weight: ["regular", "medium", "semibold", "stat"],
  eyebrowCase: ["as-is", "upper"],
  numerals: ["gradient", "solid", "outline", "muted"],
  highlight: ["gradient", "underline", "marker", "accent"],
  backgroundKind: ["clouds", "plain", "grid", "dots", "gradient", "noise"],
  entrance: ["auto", "rise", "fade", "scale", "slide", "wipe"],
  transition: ["wash", "through", "cut", "wipe"],
  doodleStroke: ["hand", "geometric"],
  accent: ["underline", "bar", "dot", "none"],
  titleCard: ["solid", "glass"],
  listLayout: ["stacked", "inline"],
  listUnderline: ["row", "name"],
  handoff: ["wash", "dock", "through"],
  headlineSize: ["md", "sm"],
  barRadius: ["none", "sm", "md", "lg", "pill"],
  chartGrid: ["auto", "on", "off"],
  chartFill: ["solid", "gradient", "hatched"],
  lineWeight: ["regular", "hairline", "bold"],
  lineDash: ["solid", "dashed", "dotted"],
  lineCap: ["round", "square"],
  dotShape: ["round", "square", "cross"],
  accentUse: ["balanced", "sparse", "rich"],
  solidFill: ["shaded", "flat", "outline", "translucent"],
  solidEdge: ["gap", "ink", "accent", "none"],
  extrude: ["stack", "long-shadow", "outline-stack", "none"],
  arrival: ["rise", "fade", "slide", "scale"],
  caret: ["bar", "block", "underscore"],
  tile: ["card", "flat", "outline"],
  charset: ["caps", "hex", "binary", "symbols"],
  decoration: ["none", "underline", "marker", "box"],
} as const;

type Of<K extends keyof typeof STYLE_ENUMS> = (typeof STYLE_ENUMS)[K][number];

export type Corners = Of<"corners">;
export type SurfaceKind = Of<"surfaceKind">;
export type Elevation = Of<"elevation">;
export type FontWeightStep = Of<"weight">;
export type NumeralsStyle = Of<"numerals">;
export type HighlightStyle = Of<"highlight">;
export type BackgroundKind = Of<"backgroundKind">;
export type EntranceStyle = Of<"entrance">;
export type TransitionStyle = Of<"transition">;
export type AccentDecor = Of<"accent">;

export type LineWeight = Of<"lineWeight">;
export type LineDash = Of<"lineDash">;
export type LineCap = Of<"lineCap">;
export type DotShape = Of<"dotShape">;
export type AccentUse = Of<"accentUse">;
export type SolidFill = Of<"solidFill">;
export type SolidEdge = Of<"solidEdge">;
export type ExtrudeStyle = Of<"extrude">;
export type TextArrival = Of<"arrival">;
export type CaretStyle = Of<"caret">;
export type TileStyle = Of<"tile">;
export type Charset = Of<"charset">;
export type TextDecoration = Of<"decoration">;

export interface ThemeStyle {
  /** Lenguaje de esquinas y bordes de chips, píldoras, tarjetas y paneles. */
  shape: {
    /** `pill` (chips y píldoras redondeados del todo, tarjetas con `radius.lg`), `rounded` (chips con `radius.md`) o `sharp` (sin radio). */
    corners: Corners;
    /** Grosor base del borde en px (0 a 6): las piezas suman lo suyo (chip +1, píldora +2). */
    border: number;
    /** `false`: las superficies no llevan borde (salvo `surface.kind: "outline"`, que es un borde). */
    outlined: boolean;
  };
  /** Tratamiento de las tarjetas y paneles. */
  surface: {
    /** `solid` (relleno `surface`), `glass` (translúcido), `outline` (relleno del fondo y borde de tinta) o `tinted` (`surface` teñida de acento). */
    kind: SurfaceKind;
    /** `shadow` (sombra del tema), `flat` (sin sombra), `border` (filo duro desplazado, sin desenfoque) o `glow` (halo de acento). */
    elevation: Elevation;
    /** Opacidad (0,3 a 1) de las superficies translúcidas (`glass`). */
    opacity: number;
  };
  /** Tratamiento del texto. */
  type: {
    titleWeight: FontWeightStep;
    labelWeight: FontWeightStep;
    /** Interletrado extra de los titulares, en em, que se suma al que ya tenga la pieza (-0,1 a 0,2). */
    titleTracking: number;
    /** `upper` pasa a mayúsculas los rótulos pequeños (eyebrows). */
    eyebrowCase: "as-is" | "upper";
    /** Interletrado de los eyebrows, en em (0 a 0,4). */
    eyebrowTracking: number;
    /** Cómo se dibujan los números de pasos y listas: degradado de marca, acento sólido, solo contorno o atenuado. */
    numerals: NumeralsStyle;
    /** Cómo se resalta una palabra: degradado, subrayado, marcador o color de acento. */
    highlight: HighlightStyle;
  };
  background: {
    kind: BackgroundKind;
    /** 0 a 1: multiplica la opacidad de las nubes (`theme.cloud.opacity`) o la fuerza del patrón. */
    intensity: number;
  };
  motion: {
    /** Cómo entran los elementos genéricos (tarjetas, filas, chips). `auto` (por defecto): cada pieza conserva su entrada propia de siempre. */
    entrance: EntranceStyle;
    /** Rebote al asentarse, como fracción (0 = ninguno, hasta 0,3). */
    overshoot: number;
    /** Cuadros entre un elemento y el siguiente de un conjunto escalonado (0 a 12). */
    stagger: number;
    /** `false` apaga el desenfoque de movimiento de la cámara en los viajes. */
    cameraBlur: boolean;
    /** Multiplicador de la inclinación de la cámara (0 a 3; 1 = la de siempre). */
    cameraTilt: number;
    /** Cierre de una escena hacia la siguiente. */
    transition: TransitionStyle;
  };
  decor: {
    /** `false`: los garabatos del kit no se dibujan. */
    doodles: boolean;
    /** `hand` (temblor de mano) o `geometric` (trazo limpio, sin temblor). */
    doodleStroke: "hand" | "geometric";
    /** Multiplicador de la viñeta (0 = apagada; hasta 2). */
    vignette: number;
    /** Marca de acento de listas y cierres. */
    accent: AccentDecor;
    /** Cuadros de un vaivén del degradado de los textos (0 = quieto; si no, entero >= 2). */
    gradientLoop: number;
  };
  /** Valores por defecto del diseño de las historias (`stories/`); `spec.design` los pisa video por video. */
  story: {
    titleCard: "solid" | "glass";
    listLayout: "stacked" | "inline";
    listUnderline: "row" | "name";
    handoff: "wash" | "dock" | "through";
    headlineSize: "md" | "sm";
    /** Rol del tema para el fondo del cierre. */
    closingBg: string;
    /** Barra de la firma del cierre. */
    signoffBar: boolean;
    /** `null`: lo decide el formato (6 en horizontal, 3 en vertical). */
    wallColumns: number | null;
    /** `null`: lo decide el formato (6 en horizontal, 12 en vertical). */
    wallRows: number | null;
    wallChipScale: number;
    wallDolly: number;
    wallDepth: number;
    wallBlurOpening: boolean;
    wallBlurClosing: boolean;
  };
  chart: {
    /** Radio de las esquinas superiores de las barras, como escalón de `theme.radius`. */
    barRadius: Of<"barRadius">;
    /** Grosor de las líneas de datos, en px (1 a 12). */
    lineWidth: number;
    /** `auto`: cada gráfico como hoy; `on` / `off` fuerzan las líneas de guía. */
    grid: "auto" | "on" | "off";
    fill: "solid" | "gradient" | "hatched";
  };
  /** Dibujo lineal y puntos de las piezas de `fx/three` (alambres, puntos, trazos). Ayuda: `lineLook`. */
  line: {
    /** Escala del grosor de los trazos: `regular` (x1), `hairline` (x0,5) o `bold` (x1,8). */
    weight: LineWeight;
    /** Carácter de las líneas guía (las principales siempre van llenas): `solid`, `dashed` o `dotted`. */
    dash: LineDash;
    /** Terminación de los trazos: `round` (redondeada) o `square` (corte recto y esquinas vivas). */
    cap: LineCap;
    /** 0 a 1: halo de los trazos y los puntos (segunda pasada ancha y tenue; sin `shadowBlur`, para que pase el chequeo de determinismo). */
    glow: number;
    /** Forma de los puntos: `round`, `square` o `cross`. */
    dotShape: DotShape;
    /** Cuánto de una figura va en acento: `balanced` (como siempre), `sparse` (solo lo principal) o `rich` (también lo secundario). */
    accentUse: AccentUse;
    /** 0 a 1: temblor de trazo a mano, una función fija de la posición en pantalla (no del azar ni del cuadro). */
    sketch: number;
  };
  /** Cómo se dibujan las caras rellenas de los sólidos 3D (cubos, ciudad, capas, esfera, sol). Ayuda: `solidLook`. */
  solid: {
    /** `shaded` (sombreado por cara), `flat` (un tono por pieza), `outline` (solo contorno, tapa lo de atrás) o `translucent` (cristal con borde). */
    fill: SolidFill;
    /** 0,2 a 1,6: diferencia de luz entre las caras de un sólido sombreado (1 = la de siempre). */
    contrast: number;
    /** Arista: `gap` (color del fondo, como siempre), `ink`, `accent` o `none`. */
    edge: SolidEdge;
  };
  /** Profundidad: extrusión de texto y volumen en el espacio. Ayuda: `depthLook`. */
  depth: {
    /** `stack` (capas con degradé), `long-shadow` (sombra larga que se desvanece), `outline-stack` (capas de contorno) o `none`. */
    extrude: ExtrudeStyle;
    /** `true`: lo lejano se atenúa y se afina; `false`: trazos parejos y nítidos a cualquier distancia. */
    fog: boolean;
  };
  /** Llegada y adorno de los efectos de texto (`fx/text`). Ayuda: `textLook`. */
  text: {
    /** Cómo entran las letras de `MaskedRise` / `KineticWords` y el extra de `Typewriter` y `DigitRoll`: `rise`, `fade`, `slide` o `scale`. */
    arrival: TextArrival;
    /** Cursor de `Typewriter` (y de `ScrambleDecode` con `block` o `underscore`): `bar`, `block` o `underscore`. */
    caret: CaretStyle;
    /** Losetas de `SplitFlap` y bandas de `MarqueeBands`: `card` (como siempre), `flat` (sin bisagra ni redondeo) u `outline` (solo contorno). */
    tile: TileStyle;
    /** Alfabeto de los glifos de `ScrambleDecode` y `SplitFlap`: `caps` (el propio de cada efecto), `hex`, `binary` o `symbols`. */
    charset: Charset;
    /** Adorno bajo el texto cuando termina de llegar: `none`, `underline`, `marker` o `box`. */
    decoration: TextDecoration;
  };
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Lo que un tema puede declarar: cualquier subconjunto de `ThemeStyle`; lo que falte sale de los valores por defecto (o de la base). */
export type ThemeStyleInput = DeepPartial<ThemeStyle>;

/** Roles de superficie que entienden `cornerRadius` y `surfaceStyle`. */
export type CornerRole = "chip" | "card" | "panel" | "hero" | "control" | "bar";
export type SurfaceRole = "card" | "panel" | "headline" | "chip" | "pill" | "title";
