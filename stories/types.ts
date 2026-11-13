import type React from "react";
import type { CloudOptions } from "../kit";
import { MIN_COMPACT_FRAMES } from "./durations";

/** Una escena de tema que entra en la historia. */
export type TopicScene = {
  id: string;
  component: React.FC;
  durationInFrames: number;
  /** Panel pequeño (560x340 de lienzo) que se muestra en el cierre. Por defecto, una tarjeta neutra con el nombre del tema. */
  thumbnail?: React.FC;
};

export type StoryTopic = {
  id: string;
  name: string;
  line: string;
  /**
   * Panel pequeño (560x340 de lienzo) para el cierre cuando el tema no tiene escena (o su escena no trae `thumbnail`).
   * Sin él, una tarjeta derivada del tema.
   */
  thumbnail?: React.FC;
};

/**
 * Opciones de diseño de los bloques generados. Todas son opcionales y lo que no se indica deja el aspecto de siempre
 * (cartel sólido, lista apilada, apertura que termina en un velo, muro de 6 x 6 con desenfoque por distancia).
 */
export type StoryDesign = {
  /**
   * Cartel del título en la apertura: `"solid"` (por defecto, superficie opaca) o `"glass"` (superficie translúcida con borde fino
   * que deja ver el muro). El vidrio se emula con una superficie semiopaca y no con `backdrop-filter`, que no es determinista en `--check`.
   */
  titleCard?: "solid" | "glass";
  /**
   * Filas de la lista de temas: `"stacked"` (por defecto: número y nombre arriba, la línea debajo) o `"inline"` (`01 Nombre · línea` en un
   * solo renglón). `"inline"` solo rige en formatos anchos (horizontal); en vertical y cuadrado se usa la apilada.
   */
  list?: "stacked" | "inline";
  /**
   * Cómo termina la apertura: `"wash"` (por defecto: se atraviesa el primer titular y un velo cubre el cuadro) o `"dock"` (el titular del
   * primer tema con escena queda acoplado arriba a la izquierda, la píldora de `TopicHeadline`, y la escena arranca con ella ya puesta).
   * Sin escenas, `"dock"` se ignora.
   */
  handoff?: "wash" | "dock";
  /** Muro de etiquetas de la apertura (y del cierre, en lo que toca al desenfoque). */
  wall?: {
    /** Columnas del muro de la apertura (por defecto 6 en horizontal, 3 en vertical). */
    columns?: number;
    /** Filas del muro de la apertura (por defecto 6 en horizontal, 12 en vertical). Columnas × filas = piezas. */
    rows?: number;
    /** `false`: las piezas no se desenfocan con la distancia (apertura) ni el muro del cierre arranca desenfocado. Por defecto `true`. */
    blur?: boolean;
  };
  /** Fondo de nubes de todos los bloques generados: colores, manchas, opacidad, cantidad y semilla (lo que falte sale de `theme.cloud`). */
  clouds?: CloudOptions;
};

/** Duraciones (en cuadros) de los tres bloques generados; lo que no se indica usa el valor por defecto. */
export type StoryTiming = {
  opening?: number;
  /** Vuelta al listado completa (mínimo 60). */
  interlude?: number;
  /** Vuelta compacta (`interludes: "compact"`; mínimo 24, por defecto 40). */
  interludeCompact?: number;
  closing?: number;
};

export type StorySpec = {
  /** `highlight` es un fragmento de `text` que se pinta con el degradado del tema. */
  title: { text: string; highlight?: string };
  /** De 2 a 6 temas. */
  topics: StoryTopic[];
  /** Palabras del muro; si faltan, se repiten de forma determinista. */
  labels: string[];
    /**
   * `logo` es una ruta de /public (se resuelve con `asset()`); `slot` es un nodo propio (marca, ícono, sello) que va arriba del texto y
   * reemplaza al logo; `text` es la línea de cierre (opcional si hay `logo` o `slot`). `text` y `tagline` admiten un fragmento en
   * negrita entre `**dobles asteriscos**` (ver `parseRich`).
   */
  signoff: { logo?: string; slot?: React.ReactNode; tagline?: string; text?: string };
  timing?: StoryTiming;
  design?: StoryDesign;
};

export const MIN_TOPICS = 2;
export const MAX_TOPICS = 6;

/** Ids que usa la composición para sus propios bloques: un tema no puede llamarse así. */
export const isReservedSceneId = (id: string) => id === "opening" || id === "closing" || /^interlude(-.*)?$/.test(id);

const TIMING_KEYS = ["opening", "interlude", "interludeCompact", "closing"];
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/** Lanza un error claro si la configuración no se puede componer. */
export function validateSpec(spec: StorySpec): void {
  const n = spec?.topics?.length ?? 0;
  if (n < MIN_TOPICS || n > MAX_TOPICS) {
    throw new Error(`StorySpec: hacen falta entre ${MIN_TOPICS} y ${MAX_TOPICS} temas (hay ${n})`);
  }
  if (!spec.title?.text) throw new Error("StorySpec: falta title.text");
  if (!spec.signoff) throw new Error("StorySpec: falta signoff");
  if (!spec.signoff.text && !spec.signoff.logo && !spec.signoff.slot) throw new Error("StorySpec: falta signoff.text (o signoff.logo / signoff.slot)");
  validateDesign(spec.design);
  const ids = new Set(spec.topics.map((t) => t.id));
  if (ids.size !== n) throw new Error("StorySpec: los id de los temas deben ser únicos");
  // `labels` vacío o ausente es válido (el muro usa los nombres de los temas); si viene, tiene que ser una lista de textos.
  if (spec.labels !== undefined) {
    if (!Array.isArray(spec.labels)) throw new Error("StorySpec: labels debe ser una lista de textos");
    spec.labels.forEach((l, i) => {
      if (typeof l !== "string" || l.trim() === "") throw new Error(`StorySpec: labels[${i}] debe ser un texto no vacío`);
    });
  }
  const timing = (spec.timing ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(timing)) {
    if (!TIMING_KEYS.includes(k)) throw new Error(`StorySpec: timing.${k} no existe (las claves válidas son ${TIMING_KEYS.join(", ")})`);
    const min = k === "interludeCompact" ? MIN_COMPACT_FRAMES : 60;
    if (v !== undefined && (!isInt(v) || v < min)) throw new Error(`StorySpec: timing.${k} debe ser un número entero de cuadros >= ${min}`);
  }
}

const DESIGN_ENUMS: Record<string, string[]> = { titleCard: ["solid", "glass"], list: ["stacked", "inline"], handoff: ["wash", "dock"] };

function validateDesign(d: StoryDesign | undefined): void {
  if (d === undefined) return;
  const bad = (m: string) => { throw new Error(`StorySpec: design.${m}`); };
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    if (k in DESIGN_ENUMS) { if (v !== undefined && !DESIGN_ENUMS[k]!.includes(v as string)) bad(`${k} debe ser ${DESIGN_ENUMS[k]!.map((x) => `"${x}"`).join(" o ")} (recibió ${JSON.stringify(v)})`); }
    else if (k !== "wall" && k !== "clouds") bad(`${k} no existe (las claves válidas son titleCard, list, handoff, wall, clouds)`);
  }
  const w = d.wall;
  if (w) {
    for (const k of ["columns", "rows"] as const) {
      const v = w[k];
      if (v !== undefined && (!isInt(v) || v < 2 || v > 12)) bad(`wall.${k} debe ser un entero entre 2 y 12`);
    }
    if (w.blur !== undefined && typeof w.blur !== "boolean") bad("wall.blur debe ser true o false");
  }
}

/** Fragmentos de un texto con `**negrita**`: `[{ text, bold }]`. Sin marcas, un solo fragmento. */
export function parseRich(text: string): { text: string; bold: boolean }[] {
  const out: { text: string; bold: boolean }[] = [];
  text.split("**").forEach((part, i) => {
    if (part !== "") out.push({ text: part, bold: i % 2 === 1 });
  });
  return out.length ? out : [{ text: "", bold: false }];
}

/** El mismo texto sin las marcas de negrita (para medirlo). */
export const plainRich = (text: string): string => text.replace(/\*\*/g, "");
