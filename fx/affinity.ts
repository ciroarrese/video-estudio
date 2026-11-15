import type { DesignCharacter, Theme } from "../themes";
import { themeCharacter } from "../themes";

/**
 * Afinidad de cada efecto del catálogo con el carácter de un design system (`docs/animaciones.md`, columna "Encaja con"). Es una guía para elegir
 * (antes de escribir un guion, con el design system a la vista), no una prohibición: un efecto "evitar" se puede usar si el guion lo justifica y se
 * adapta con `theme.style`. Los caracteres: `geometrico-sobrio`, `editorial`, `ludico-manual`, `tecnico-oscuro` (`themeCharacter(theme)` deduce el de un tema).
 */
export interface FxAffinity {
  /** Caracteres donde el efecto es una elección natural. */
  fits: readonly DesignCharacter[];
  /** Caracteres donde conviene evitarlo (o adaptarlo). */
  avoid: readonly DesignCharacter[];
  /** Una línea: por qué encaja o cuándo evitarlo. */
  note: string;
}

const G = "geometrico-sobrio", E = "editorial", L = "ludico-manual", T = "tecnico-oscuro";
const ALL = [G, E, L, T] as const;
const a = (fits: readonly DesignCharacter[], avoid: readonly DesignCharacter[], note: string): FxAffinity => ({ fits, avoid, note });

export const FX_AFFINITY = {
  // texto
  MaskedRise: a(ALL, [], "Entrada limpia de titulares; sirve en cualquier sistema (el tema decide la llegada con text.arrival)."),
  KineticWords: a([G, T, L], [E], "Corte seco y energía: evitarlo en un sistema editorial sobrio."),
  Typewriter: a([T, E], [], "Comandos y citas; el cursor sigue a text.caret."),
  ScrambleDecode: a([T], [E, L], "Tono técnico o de cifrado; desentona con un sistema editorial o manual."),
  SplitFlap: a([G, T], [L], "Tablero mecánico; evitarlo donde el sistema es cálido y manual."),
  DigitRoll: a([G, T, E], [], "Cifra destacada; neutro en casi todos."),
  MarqueeBands: a([L, T], [E], "Bandas inclinadas con energía; evitarlo en un sistema sobrio y de márgenes amplios."),
  TypeRing: a([T, L], [E], "Portada con volumen; recargado para un sistema editorial."),
  // 3D
  Globe: a([G, T], [], "Alcance y red; pide líneas finas (line.weight) en sistemas editoriales."),
  ParticleSphere: a([T], [E, L], "Datos o IA en abstracto; frío y tecnológico."),
  CubeStack: a([G, T], [L], "Piezas que forman un todo, geométrico."),
  CubeFold: a([G, T], [L], "Entrega o paquete, geométrico."),
  Tunnel: a([T], [E, L], "Velocidad y avance; enérgico, no sobrio."),
  TerrainMesh: a([T], [E, L], "Fondo de malla; técnico."),
  TorusWire: a([T, G], [L], "Decoración de alambre."),
  Helix: a([T, G], [L], "Ciencia o código."),
  OrbitRings: a([G, T], [L], "Un sistema alrededor de un centro."),
  WaveDots: a([T, G], [E], "Fondo animado de puntos; evitarlo en un sistema editorial de fondo liso o de grilla."),
  LayerExplode: a([G, T, E], [], "Capas rotuladas; claro y diagramático."),
  CardFlip: a([G, E, L], [], "Antes y después; con tarjetas del tema."),
  CarouselRing: a([G, T], [E], "Galería en anillo; vistoso, no sobrio."),
  IsoCity: a([G, T], [L], "Bloques isométricos."),
  ExtrudeType: a([T, G], [E], "Volumen en el titular; el tema elige la extrusión (depth.extrude)."),
  PhoneOrbit: a([G, T], [], "Presentar una app con tu interfaz en la pantalla."),
  // datos
  LineDraw: a(ALL, [], "Tendencia; sigue chart.lineWidth y chart.grid."),
  DonutRing: a([G, T, L], [], "Porcentaje; en un sistema editorial preferí BarsGrow."),
  RadarMorph: a([G, T], [L], "Perfiles en varios ejes."),
  Bars3D: a([T, G], [E], "Barras con volumen; en un sistema editorial preferí BarsGrow."),
  BarsGrow: a(ALL, [], "Comparar categorías; sigue chart.barRadius, chart.fill y chart.grid."),
  FlowSteps: a(ALL, [], "Proceso en pasos; sigue la forma de panel del tema."),
  // interfaz
  NotificationStack: a([G, T, L], [], "Avisos; superficie y entrada del tema."),
  ChatThread: a([G, T, L], [], "Conversación."),
  CommandPalette: a([T, G], [L], "Búsqueda rápida, técnica."),
  CardFan: a([G, L], [], "Varias opciones en abanico."),
  PhoneFrame: a(ALL, [], "Marco para tu interfaz."),
  PhoneScroll: a(ALL, [], "Pantalla larga o feed."),
  BeforeAfter: a(ALL, [], "Comparación; manija neutra."),
  TileGrid: a([G, T], [E], "Progreso de muchas cosas a la vez."),
  TileDone: a(ALL, [], "Tarea completada junto a un cursor."),
  // arte y transiciones
  BlueprintDraw: a([T, E, G], [L], "Plano técnico; líneas finas."),
  MarkerDraw: a([L, E], [T], "Trazo de marcador; evitarlo en un sistema técnico oscuro (usá Callout con la señal del tema)."),
  PaperCollage: a([L], [G, T, E], "Collage artesanal; solo con un sistema manual."),
  ShapeMorph: a([G, T], [E], "Cambio de concepto, geométrico."),
  DotWipe: a([L, G], [E], "Transición con un punto que crece; lúdica. En un sistema editorial usá Wash con motion.transition wipe."),
  HalftoneWave: a([G, T, E], [], "Fondo o transición suave de semitono."),
  PixelBuild: a([T], [E, L], "Estética retro; solo si el sistema la tiene."),
  LogoLand: a(ALL, [], "Cierre con marca."),
  LiquidBlob: a([L, G], [E, T], "Fondo orgánico; evitarlo en un sistema editorial o técnico."),
  SealSpin: a([E, L, G], [T], "Sello de cierre."),
  RibbonTwist: a([L, G], [E, T], "Decoración con cinta."),
} as const satisfies Record<string, FxAffinity>;

export type FxName = keyof typeof FX_AFFINITY;

/** Afinidad de un efecto por nombre (`undefined` si no está en el catálogo). */
export const affinityOf = (name: string): FxAffinity | undefined => (FX_AFFINITY as Record<string, FxAffinity>)[name];

/** Efectos que encajan con un carácter, y los que conviene evitar. Con un tema: `fxFor(themeCharacter(theme))` (o pasá el tema directo). */
export function fxFor(character: DesignCharacter | Theme): { fits: string[]; avoid: string[] } {
  const c = typeof character === "string" ? character : themeCharacter(character);
  const names = Object.keys(FX_AFFINITY) as FxName[];
  return {
    fits: names.filter((n) => (FX_AFFINITY[n].fits as readonly string[]).includes(c)),
    avoid: names.filter((n) => (FX_AFFINITY[n].avoid as readonly string[]).includes(c)),
  };
}
