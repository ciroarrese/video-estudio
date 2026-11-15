import type { Theme } from "./types";
import { resolveStyle } from "./style";
import type { AnnotationMarkSetting, CharacterSetting } from "./styleTypes";
import { relativeLuminance } from "./contrast";

/*
 * Ayudas puras para señalar algo en pantalla (`style.annotation`) y para leer el carácter de un design system.
 * Como el resto de `themes/`: sin estado ni azar. Una pieza no compara cadenas del estilo: llama a `annotationLook`.
 */

/** Forma concreta de una señal (`auto` ya resuelto). */
export type AnnotationMark = Exclude<AnnotationMarkSetting, "auto">;

export interface AnnotationLook {
  /** La señal que usa el design system (o la variante forzada por la escena). */
  mark: AnnotationMark;
  /** `true`: trazo con temblor de mano (solo la señal `hand`; con `auto` sigue a `decor.doodleStroke`). */
  jitter: boolean;
  /** Opacidad (0,2 a 0,9) con que `focus` atenúa el resto del cuadro. */
  dim: number;
  /** Multiplicador del grosor del trazo (`line.weight`: hairline 0,5, regular 1, bold 1,8). */
  widthK: number;
  /** `true`: terminaciones rectas y esquinas vivas (`line.cap: "square"`). */
  square: boolean;
  /** 0 a 1: halo de los trazos (`line.glow`). */
  glow: number;
  /** `true` si la escena forzó una variante distinta de la del tema (la excepción explícita). */
  forced: boolean;
}

const WEIGHT_K = { regular: 1, hairline: 0.5, bold: 1.8 } as const;

/**
 * La señal que el design system usaría. Con `mark: "auto"` (un tema que no declara `annotation`) se deriva de `decor`: sin garabatos (`doodles: false`)
 * no hay señal (`none`); con trazo a mano (`doodleStroke: "hand"`) es `hand`; con trazo geométrico, `arrow`. `variant` fuerza otra (excepción explícita
 * de una escena); un `variant: "auto"` o ausente deja al tema.
 */
export function resolveAnnotationMark(theme: Theme, variant?: AnnotationMarkSetting): AnnotationMark {
  const st = resolveStyle(theme);
  const want = variant && variant !== "auto" ? variant : st.annotation.mark;
  if (want !== "auto") return want;
  if (!st.decor.doodles) return "none";
  return st.decor.doodleStroke === "hand" ? "hand" : "arrow";
}

/** Lectura de `style.annotation` junto con lo que le corresponde de `style.line` (grosor, terminación, halo). */
export function annotationLook(theme: Theme, variant?: AnnotationMarkSetting): AnnotationLook {
  const st = resolveStyle(theme);
  const mark = resolveAnnotationMark(theme, variant);
  return {
    mark,
    jitter: mark === "hand",
    dim: st.annotation.dim,
    widthK: WEIGHT_K[st.line.weight],
    square: st.line.cap === "square",
    glow: st.line.glow,
    forced: !!variant && variant !== "auto" && variant !== resolveAnnotationMark(theme),
  };
}

/** Si la señal `mark` lleva una flecha o línea que une el rótulo con el objetivo (las demás señalan por forma o por posición). */
export const markHasConnector = (mark: AnnotationMark): boolean => mark === "hand" || mark === "arrow" || mark === "elbow";

/**
 * Salida de la cámara (`style.motion.exit`) como `power` de `zoomThrough`: `native` (el de siempre: 40 a 70) con `dive`; con `settle`,
 * un empuje suave de 1,5 (la transición la hace el velo). Con el estilo por defecto devuelve `native` sin cambios.
 */
export function exitPower(theme: Theme, native: number): number {
  return resolveStyle(theme).motion.exit === "settle" ? SETTLE_POWER : native;
}
const SETTLE_POWER = 1.5;

/** Carácter de un design system, para elegir efectos con `docs/animaciones.md` y `fx/affinity.ts`. */
export type DesignCharacter = Exclude<CharacterSetting, "auto">;

export const DESIGN_CHARACTERS: readonly DesignCharacter[] = ["geometrico-sobrio", "editorial", "ludico-manual", "tecnico-oscuro"];

/**
 * Carácter del design system. Si el tema lo declara (`style.decor.character`), es ese; si no (`auto`), se deduce de su estilo (la heurística es solo el
 * respaldo, ver `inferCharacter`).
 */
export function themeCharacter(theme: Theme): DesignCharacter {
  const declared = resolveStyle(theme).decor.character;
  return declared !== "auto" ? declared : inferCharacter(theme);
}

/**
 * Carácter deducido del estilo, sin mirar lo que el tema declara: trazo a mano o temblor de línea (`ludico-manual`); esquinas rectas con superficie de contorno o
 * eyebrows en mayúsculas con subrayado (`editorial`); fondo oscuro (`tecnico-oscuro`); el resto (`geometrico-sobrio`). Es una guía para elegir
 * efectos, no una regla: el design system puede no encajar del todo en ninguno.
 */
export function inferCharacter(theme: Theme): DesignCharacter {
  const st = resolveStyle(theme);
  if (resolveAnnotationMark(theme) === "hand" || st.line.sketch >= 0.4) return "ludico-manual";
  if (st.shape.corners === "sharp" && (st.surface.kind === "outline" || st.type.highlight === "underline")) return "editorial";
  if (relativeLuminance(theme.color.bg) < 0.18) return "tecnico-oscuro";
  return "geometrico-sobrio";
}
