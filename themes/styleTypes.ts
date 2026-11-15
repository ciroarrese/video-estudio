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
  captionCase: ["eyebrow", "as-is", "upper", "lower"],
  captionWeight: ["auto", "regular", "medium", "semibold", "stat"],
  numerals: ["gradient", "solid", "outline", "muted"],
  highlight: ["gradient", "underline", "marker", "accent"],
  backgroundKind: ["clouds", "plain", "grid", "dots", "gradient", "noise"],
  entrance: ["auto", "rise", "fade", "scale", "slide", "wipe", "depth"],
  transition: ["wash", "through", "cut", "wipe"],
  exit: ["dive", "settle"],
  annotationMark: ["auto", "hand", "arrow", "elbow", "bracket", "tag", "ring", "focus", "underline", "none"],
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
  character: ["auto", "geometrico-sobrio", "editorial", "ludico-manual", "tecnico-oscuro"],
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
export type ExitStyle = Of<"exit">;
/** Cómo señala algo el design system (`style.annotation.mark`). `auto` deriva de `decor` (ver `annotationLook`); el resto es una forma concreta. */
export type AnnotationMarkSetting = Of<"annotationMark">;
export type AccentDecor = Of<"accent">;
export type CaptionCase = Of<"captionCase">;
export type CaptionWeight = Of<"captionWeight">;

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
/** Carácter declarado de un design system (`style.decor.character`); `auto` lo deduce `themeCharacter` del resto del estilo. */
export type CharacterSetting = Of<"character">;

export interface ThemeStyle {
  /** Lenguaje de esquinas y bordes de chips, píldoras, tarjetas y paneles. */
  shape: {
    /** `pill` (chips y píldoras redondeados del todo, tarjetas con `radius.lg`), `rounded` (chips con `radius.md`) o `sharp` (sin radio). */
    corners: Corners;
    /** Grosor base del borde en px (0 a 6): las piezas suman lo suyo (chip +1, píldora +2). */
    border: number;
    /** `false`: las superficies no llevan borde (salvo `surface.kind: "outline"`, que es un borde). */
    outlined: boolean;
    /**
     * Radio del cartel del título (rol `hero`) como múltiplo de `radius.lg` (0,5 a 4). `null` (por defecto): el de siempre (2 con `pill`, 1,5 con `rounded`).
     * Con `sharp` no rige: todo es recto.
     */
    heroScale: number | null;
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
    /**
     * Caja de los subtítulos y de las líneas de apoyo de las historias (rol `caption`, distinto del eyebrow): `eyebrow` (por defecto) sigue a
     * `eyebrowCase`, como siempre; `as-is`, `upper` y `lower` la deciden aparte. Así un design system con eyebrows en mayúsculas puede dejar las líneas en caja normal.
     */
    captionCase: CaptionCase;
    /** Interletrado de los subtítulos y líneas de apoyo, en em (0 a 0,4). `null` (por defecto): el de `eyebrowTracking`. */
    captionTracking: number | null;
    /** Peso de los subtítulos y líneas de apoyo. `auto` (por defecto): el que ya lleva la pieza. */
    captionWeight: CaptionWeight;
    /** Cómo se dibujan los números de pasos y listas: degradado de marca, acento sólido, solo contorno o atenuado. */
    numerals: NumeralsStyle;
    /** Cómo se resalta una palabra: degradado, subrayado, marcador o color de acento. */
    highlight: HighlightStyle;
  };
  background: {
    kind: BackgroundKind;
    /** 0 a 1: multiplica la opacidad de las nubes (`theme.cloud.opacity`) o la fuerza del patrón. */
    intensity: number;
    /**
     * Deriva de las nubes (`clouds`), como multiplicador de la velocidad del vaivén lento de cada mancha (y de su amplitud, hasta el doble; 0 a 4). 1 (por defecto) es el
     * movimiento de siempre (unos 120 px de amplitud en ciclos de 570 a 1070 cuadros: a simple vista, casi quieto); 0 las deja quietas; 2 a 3 se nota
     * en un video corto sin llamar la atención. Una escena puede pasar `cloud.drift` para pisarlo.
     */
    drift: number;
  };
  motion: {
    /** Cómo entran los elementos genéricos (tarjetas, filas, chips). `auto` (por defecto): cada pieza conserva su entrada propia de siempre. */
    entrance: EntranceStyle;
    /** Rebote al asentarse, como fracción (0 = ninguno, hasta 0,3). */
    overshoot: number;
    /** Cuadros entre un elemento y el siguiente de un conjunto escalonado (0 a 12). Es la base: los de contexto de abajo la pisan donde se indican. */
    stagger: number;
    /** Paso (cuadros, 0 a 60) entre las filas grandes de la lista de la apertura. `null` (por defecto): el de siempre, escalado por `stagger`. */
    staggerList: number | null;
    /** Paso (cuadros, 0 a 60) entre filas de interfaces y de la vuelta al listado (`Interlude`) y de las filas de `kit-demo`. `null`: el de siempre, escalado por `stagger`. */
    staggerRows: number | null;
    /** Paso (cuadros, 0 a 60) entre elementos pequeños (paneles del cierre, tarjetas, ítems sueltos). `null`: el de siempre, escalado por `stagger`. */
    staggerItems: number | null;
    /** Paso (cuadros por pieza, 0 a 10, admite decimales) con que aparecen las piezas del muro de la apertura (0,5 de siempre). `null`: el de siempre. */
    staggerChips: number | null;
    /**
     * Cuadros (a la duración de referencia del bloque: se escalan con `timing`) que la apertura y la vuelta al listado se quedan con el velo cerrado, en blanco, antes de
     * entrar a la escena que sigue. `null` (por defecto): lo de siempre, unos 20 cuadros en la apertura y 18 en la vuelta. Menos cuadros = el atravesado y el velo ocurren más
     * tarde y la escena entra antes; 0 = el velo se cierra justo en el último cuadro. En la vuelta el blanco no pasa de 22 cuadros (antes empezaría el atravesado sobre la lista que todavía se arma). No afecta a
     * `handoff: "dock"`/`"through"`, a la vuelta compacta ni a la de revelación (no tienen velo).
     */
    handoffHold: number | null;
    /** `false` apaga el desenfoque de movimiento de la cámara en los viajes. */
    cameraBlur: boolean;
    /** Multiplicador de la inclinación de la cámara (0 a 3; 1 = la de siempre). */
    cameraTilt: number;
    /** Cierre de una escena hacia la siguiente. */
    transition: TransitionStyle;
    /**
     * Cómo sale la cámara hacia la escena siguiente: `dive` (atraviesa un elemento con `zoomThrough`: la escala se multiplica por 40 a 70, como siempre) o
     * `settle` (empuja con suavidad, sin atravesar: la transición la hace el velo). Con `transition: "through"` la salida tiene que ser `dive`: sin velo,
     * el atravesado es la transición (`checkTheme` lo avisa). Ayuda: `exitPower`.
     */
    exit: ExitStyle;
  };
  /**
   * Cómo se señala algo en pantalla (llamadas, énfasis sobre una zona, rótulos que apuntan). Un design system decide la señal que usaría:
   * un trazo a mano, una flecha recta, una línea con codo y punto, un corchete, una etiqueta pegada, un anillo, un foco que atenúa el resto,
   * un subrayado o ninguna. `Callout` la resuelve con `annotationLook`; una escena puede forzar otra con la prop `variant` (excepción explícita).
   */
  annotation: {
    /**
     * `auto` (por defecto, el de un tema que no declara el grupo): se deriva de `decor` (sin garabatos: sin señal; con trazo a mano: a mano; con trazo
     * geométrico: flecha recta). El resto fija la forma: `hand`, `arrow`, `elbow`, `bracket`, `tag` (píldora pegada, sin flecha), `ring`, `focus`
     * (anillo; la escena atenúa el resto con `focusOpacity`), `underline` y `none` (solo el rótulo, sin señal).
     */
    mark: AnnotationMarkSetting;
    /** 0,2 a 0,9: cuánto se atenúa el resto del cuadro con `focus` (opacidad del fondo que se le superpone). */
    dim: number;
  };
  decor: {
    /** `false`: los garabatos del kit no se dibujan. */
    doodles: boolean;
    /** `hand` (temblor de mano) o `geometric` (trazo limpio, sin temblor). */
    doodleStroke: "hand" | "geometric";
    /**
     * Carácter del design system para elegir efectos (`docs/animaciones.md`, "Afinidad"): `auto` (por defecto) lo deduce `themeCharacter` de
     * la señal, las líneas, las esquinas, la superficie y el fondo; con un valor, el design system lo declara y la deducción queda de respaldo.
     */
    character: CharacterSetting;
    /** Multiplicador de la viñeta (0 = apagada; hasta 2). */
    vignette: number;
    /** Rol del tema con que se tiñe la viñeta (`accent` por defecto, como siempre). Una escena puede pasar su propio `color`. */
    vignetteColor: string;
    /** Marca de acento de listas y cierres. */
    accent: AccentDecor;
    /** Multiplicador del grosor de la marca de acento (0,25 a 4; 1 = el de cada pieza: 8 px en la lista y la firma, 10 px en la vuelta compacta). */
    accentThickness: number;
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
    /** Multiplicador de la separación horizontal entre columnas del muro de la apertura (0,4 a 3; 1 = la de siempre). */
    wallGapX: number;
    /** Multiplicador de la separación vertical entre filas del muro (0,4 a 3; 1 = la de siempre). */
    wallGapY: number;
    /** Multiplicador del corrimiento "ladrillo" entre filas alternas (0 a 3; 1 = el de siempre, 200 px; 0 = columnas alineadas, grilla ajustada). */
    wallBrick: number;
    /** Multiplicador del temblor de posición de cada pieza del muro (0 a 4; 1 = el de siempre; 0 = sin temblor). Sembrado: determinista. */
    wallJitter: number;
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
export type CornerRole = "chip" | "card" | "panel" | "window" | "hero" | "control" | "bar";
export type SurfaceRole = "card" | "panel" | "window" | "headline" | "chip" | "pill" | "title";
