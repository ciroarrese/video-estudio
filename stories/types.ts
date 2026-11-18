import type React from "react";
import type { SceneCue, SceneOwnAudio } from "../engine";
import type { CloudOptions } from "../kit";
import { MIN_COMPACT_FRAMES, MIN_REVEAL_FRAMES } from "./durations";

/** Una escena de tema que entra en la historia. */
export type TopicScene = {
  id: string;
  component: React.FC;
  durationInFrames: number;
  /** Panel pequeño (560x340 de lienzo) que se muestra en el cierre. Por defecto, una tarjeta neutra con el nombre del tema. */
  thumbnail?: React.FC;
  /** Sonidos de la escena en cuadros relativos a su inicio (ver `SceneCue`): `audio -- mezcla --video <id>` los suma al `from` de la escena. */
  cues?: SceneCue[];
  /** La escena trae audio propio (ver `SceneOwnAudio`): la mezcla termina o baja la música antes. */
  audioPropio?: SceneOwnAudio;
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
  /**
   * Solo para un tema SIN escena: `true` lo muestra ya tildado (visto) desde el principio en todas las vueltas al listado. Sin él, un tema
   * sin escena se ve "plano" (atenuado, sin tilde ni subrayado y nunca como "el que sigue"). Ver "Temas sin escena" en `stories/README.md`.
   */
  seen?: boolean;
  /**
   * `"late"`: tema sorpresa. NO aparece en la lista de la apertura ni en las vueltas anteriores a su escena (no cuenta para el muro ni para
   * las filas de esas listas, salvo que su nombre esté en `labels`); su escena sigue directo a la anterior (sin vuelta, ver `interludeBefore`) y
   * después la lista vuelve con la fila nueva, que entra y se tilda (`timing.interludeReveal`). Lleva el último número y sale en el cierre como
   * cualquier otro. Reglas: a lo sumo uno, tiene que ser el último de `topics`, tiene que tener escena y una escena anterior, y quedan al
   * menos 2 temas que no son tardíos. Con `interludes: false` no hay vuelta de revelación (solo aparece en el cierre).
   */
  reveal?: "late";
  /**
   * `false`: la escena de este tema sigue directo a la escena anterior, sin vuelta al listado entre las dos ni nada que inserte la historia
   * (el último cuadro de la anterior va seguido del primero de esta; las escenas hacen continuo el movimiento, ver `useTopic().handoff`).
   * La tilde del tema anterior se pospone a la vuelta que viene después. Por defecto `true` (hay vuelta), salvo en un tema `reveal: "late"`
   * (donde es `false` y no se puede pedir `true`). No rige en el primer tema con escena (sigue a la apertura).
   */
  interludeBefore?: boolean;
};

/** Cómo termina una escena de tema: `"list"` (sigue la vuelta al listado), `"next-scene"` (sigue directo la escena del tema que viene) o `"closing"` (sigue el cierre). */
export type TopicHandoff = "list" | "next-scene" | "closing";
/** Cómo empieza una escena de tema: `"opening"` (viene de la apertura), `"list"` (de una vuelta al listado) o `"previous-scene"` (continúa la escena anterior). */
export type TopicArrival = "opening" | "list" | "previous-scene";

/** Opciones de la lista de temas (forma larga de `design.list`). */
export type StoryListOptions = {
  /** `"stacked"` (por defecto) o `"inline"` (`01 Nombre · línea`; solo en formatos anchos). */
  layout?: "stacked" | "inline";
  /** Largo del subrayado del tema que sigue: `"row"` (por defecto, hasta el borde derecho de la fila) o `"name"` (lo que mide el nombre). */
  underline?: "row" | "name";
};

/** Opciones normalizadas de la lista (acepta la forma corta `"stacked" | "inline"`). */
export const listOptions = (d: StoryDesign | undefined): { layout: "stacked" | "inline"; underline: "row" | "name" } => {
  const l = d?.list;
  if (l && typeof l === "object") return { layout: l.layout ?? "stacked", underline: l.underline ?? "row" };
  return { layout: l ?? "stacked", underline: "row" };
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
  list?: "stacked" | "inline" | StoryListOptions;
  /**
   * Cómo termina la apertura: `"wash"` (por defecto: se atraviesa el primer titular y un velo cubre el cuadro), `"dock"` (el titular del
   * primer tema CON escena queda acoplado arriba a la izquierda, la píldora de `TopicHeadline`, y la escena arranca con ella ya puesta;
   * es la misma píldora, con el mismo diseño y tamaño, en el último cuadro de la apertura y en el primero de la escena) o `"through"` (se
   * atraviesa el primer titular como en `"wash"` pero sin velo: las nubes siguen sin salto y la escena entra sobre el fondo, con su
   * titular entrando por su cuenta). Sin escenas, `"dock"` y `"through"` se ignoran.
   */
  handoff?: "wash" | "dock" | "through";
  /**
   * Cómo se revela el tema tardío (`reveal: "late"`) en su vuelta al listado: `"fade"` (por defecto: la fila entra con un fundido, se subraya y se
   * tilda) o `"stage"` (escenificada: las filas vistas se corren apenas, la fila nueva entra con resorte y una leve escala, un barrido de luz de acento
   * la recorre, la miniatura de su escena aparece al costado y vuela hasta el lugar del número, y la tilde cierra con un anillo que se expande). Todo sale
   * de `theme.style` (resorte de `motion.overshoot`, acentos, esquinas). La miniatura solo se muestra donde hay lugar libre a la derecha de la fila (formato ancho; en vertical y cuadrado la fila
   * nueva entra igual, sin miniatura). Dura 200 cuadros de referencia: conviene `timing.interludeReveal: 200` (con el valor por defecto, 150, todo se acorta en proporción).
   */
  reveal?: "fade" | "stage";
  /** Píldora del titular (`TopicHeadline` y la que acopla la apertura). */
  headline?: {
    /** `"md"` (por defecto) o `"sm"` (85 % de la letra y del relleno). */
    size?: "md" | "sm";
  };
  /** Degradado de los textos de la historia (resalte del título, números de la lista y de la píldora, firma). */
  gradient?: {
    /** Cuadros de un vaivén completo (entero >= 2). Sin él el degradado queda quieto, como siempre. */
    loop?: number;
  };
  /** Cierre. */
  closing?: {
    /** Rol del tema para el fondo del cierre cuando entra la firma (`"bg"` por defecto, p. ej. `"surface"`). */
    bg?: string;
    /** Marca de acento bajo la firma (la barra de degradado, el filete o el punto según `decor.accent` del tema). `true` por defecto; `false` la quita. */
    bar?: boolean;
  };
  /** Muro de etiquetas de la apertura (y del cierre, en lo que toca al desenfoque). */
  wall?: {
    /** Columnas del muro de la apertura (por defecto 6 en horizontal, 3 en vertical). */
    columns?: number;
    /** Filas del muro de la apertura (por defecto 6 en horizontal, 12 en vertical). Columnas × filas = piezas. */
    rows?: number;
    /**
     * `false`: las piezas no se desenfocan con la distancia (apertura) ni el muro del cierre arranca desenfocado. Por defecto `true`.
     * Un objeto lo decide por separado: `{ opening?: boolean, closing?: boolean }` (lo que falte es `true`).
     */
    blur?: boolean | { opening?: boolean; closing?: boolean };
    /** Tamaño de las piezas del muro de la apertura (1 por defecto; de 0,5 a 3). */
    chipScale?: number;
    /** Recorrido extra de la cámara hacia el muro durante la apertura, en px (0 por defecto = el de siempre; de -240 a 2000). */
    dolly?: number;
    /** Multiplicador de la dispersión en profundidad de las piezas del muro de la apertura (1 por defecto; de 0 a 3). */
    depth?: number;
    /** Multiplicador de la separación horizontal entre columnas del muro (1 por defecto = la de siempre; de 0,4 a 3). */
    gapX?: number;
    /** Multiplicador de la separación vertical entre filas del muro (1 por defecto; de 0,4 a 3). */
    gapY?: number;
    /** Multiplicador del corrimiento "ladrillo" entre filas alternas (1 por defecto = 200 px; de 0 a 3; 0 = columnas alineadas, una grilla ajustada). */
    brick?: number;
    /** Multiplicador del temblor de posición de cada pieza (1 por defecto; de 0 a 4; 0 = sin temblor). Sembrado por el índice de la pieza: determinista. */
    jitter?: number;
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
  /** Vuelta con la revelación del tema tardío (`reveal: "late"`; mínimo 90, por defecto 150). Con vueltas compactas rige `interludeCompact`. */
  interludeReveal?: number;
  closing?: number;
};

export type StorySpec = {
  /** `highlight` es un fragmento de `text` que se pinta con el degradado del tema. */
  title: { text: string; highlight?: string };
  /** De 2 a 6 temas (un tema `reveal: "late"` cuenta, pero quedan al menos 2 que no lo son). */
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

const TIMING_KEYS = ["opening", "interlude", "interludeCompact", "interludeReveal", "closing"];
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
  spec.topics.forEach((t, i) => { if (t.seen !== undefined && typeof t.seen !== "boolean") throw new Error(`StorySpec: topics[${i}].seen debe ser true o false`); });
  validateTopicFlow(spec);
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
    const min = k === "interludeCompact" ? MIN_COMPACT_FRAMES : k === "interludeReveal" ? MIN_REVEAL_FRAMES : 60;
    if (v !== undefined && (!isInt(v) || v < min)) throw new Error(`StorySpec: timing.${k} debe ser un número entero de cuadros >= ${min}`);
  }
}

/** Índice desde el cual los temas son tardíos (`reveal: "late"`), o `spec.topics.length` si no hay ninguno. */
export const lateStart = (spec: StorySpec): number => {
  const i = spec.topics.findIndex((t) => t.reveal === "late");
  return i < 0 ? spec.topics.length : i;
};

/** El mismo `spec` sin los temas tardíos (los que todavía no se revelaron). Sin ninguno devuelve el mismo objeto. */
export const withoutLate = (spec: StorySpec): StorySpec => {
  const k = lateStart(spec);
  return k === spec.topics.length ? spec : { ...spec, topics: spec.topics.slice(0, k) };
};

/** Valida `reveal` e `interludeBefore` de los temas. */
function validateTopicFlow(spec: StorySpec): void {
  spec.topics.forEach((t, i) => {
    if (t.reveal !== undefined && t.reveal !== "late") throw new Error(`StorySpec: topics[${i}].reveal debe ser "late" (recibió ${JSON.stringify(t.reveal)})`);
    if (t.interludeBefore !== undefined && typeof t.interludeBefore !== "boolean") throw new Error(`StorySpec: topics[${i}].interludeBefore debe ser true o false`);
    if (t.reveal === "late" && t.interludeBefore === true) throw new Error(`StorySpec: topics[${i}] es reveal: "late": su escena sigue directo a la anterior, no admite interludeBefore: true`);
  });
  const late = spec.topics.flatMap((t, i) => (t.reveal === "late" ? [i] : []));
  if (late.length === 0) return;
  if (late.length > 1) throw new Error("StorySpec: solo un tema puede ser reveal: \"late\"");
  if (late[0] !== spec.topics.length - 1) throw new Error("StorySpec: el tema reveal: \"late\" tiene que ser el último de topics (lleva el último número)");
  if (spec.topics.length - 1 < MIN_TOPICS) throw new Error(`StorySpec: con un tema reveal: \"late\" hacen falta al menos ${MIN_TOPICS} temas más (los de la lista)`);
}

const DESIGN_ENUMS: Record<string, string[]> = { titleCard: ["solid", "glass"], handoff: ["wash", "dock", "through"], reveal: ["fade", "stage"] };
const DESIGN_KEYS = ["titleCard", "list", "handoff", "reveal", "wall", "clouds", "headline", "gradient", "closing"];
const inRange = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

function validateDesign(d: StoryDesign | undefined): void {
  if (d === undefined) return;
  const bad = (m: string) => { throw new Error(`StorySpec: design.${m}`); };
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    if (k in DESIGN_ENUMS) { if (v !== undefined && !DESIGN_ENUMS[k]!.includes(v as string)) bad(`${k} debe ser ${DESIGN_ENUMS[k]!.map((x) => `"${x}"`).join(" o ")} (recibió ${JSON.stringify(v)})`); }
    else if (!DESIGN_KEYS.includes(k)) bad(`${k} no existe (las claves válidas son ${DESIGN_KEYS.join(", ")})`);
  }
  const l = d.list as unknown;
  if (l !== undefined) {
    if (typeof l === "string") { if (l !== "stacked" && l !== "inline") bad(`list debe ser "stacked", "inline" o un objeto { layout, underline } (recibió ${JSON.stringify(l)})`); }
    else if (l && typeof l === "object") {
      const o = l as Record<string, unknown>;
      for (const k of Object.keys(o)) if (k !== "layout" && k !== "underline") bad(`list.${k} no existe (las claves válidas son layout, underline)`);
      if (o.layout !== undefined && o.layout !== "stacked" && o.layout !== "inline") bad(`list.layout debe ser "stacked" o "inline" (recibió ${JSON.stringify(o.layout)})`);
      if (o.underline !== undefined && o.underline !== "row" && o.underline !== "name") bad(`list.underline debe ser "row" o "name" (recibió ${JSON.stringify(o.underline)})`);
    } else bad("list debe ser \"stacked\", \"inline\" o un objeto { layout, underline }");
  }
  if (d.headline !== undefined && d.headline.size !== undefined && d.headline.size !== "md" && d.headline.size !== "sm") bad(`headline.size debe ser "md" o "sm" (recibió ${JSON.stringify(d.headline.size)})`);
  if (d.gradient?.loop !== undefined && (!isInt(d.gradient.loop) || d.gradient.loop < 2)) bad("gradient.loop debe ser un número entero de cuadros >= 2");
  if (d.closing !== undefined) {
    if (d.closing === null || typeof d.closing !== "object") bad("closing debe ser un objeto { bg?, bar? }");
    for (const k of Object.keys(d.closing)) if (k !== "bg" && k !== "bar") bad(`closing.${k} no existe (las claves válidas son bg, bar)`);
  }
  if (d.closing?.bg !== undefined && (typeof d.closing.bg !== "string" || d.closing.bg === "")) bad("closing.bg debe ser el nombre de un rol del tema (p. ej. \"surface\")");
  if (d.closing?.bar !== undefined && typeof d.closing.bar !== "boolean") bad(`closing.bar debe ser true o false (recibió ${JSON.stringify(d.closing.bar)})`);
  const w = d.wall;
  if (w) {
    for (const k of ["columns", "rows"] as const) {
      const v = w[k];
      if (v !== undefined && (!isInt(v) || v < 2 || v > 12)) bad(`wall.${k} debe ser un entero entre 2 y 12`);
    }
    const b = w.blur as unknown;
    if (b !== undefined && typeof b !== "boolean") {
      const okObj = b && typeof b === "object" && Object.entries(b as Record<string, unknown>).every(([k, v]) => (k === "opening" || k === "closing") && (v === undefined || typeof v === "boolean"));
      if (!okObj) bad("wall.blur debe ser true, false o { opening?: boolean, closing?: boolean }");
    }
    if (w.chipScale !== undefined && !inRange(w.chipScale, 0.5, 3)) bad("wall.chipScale debe ser un número entre 0,5 y 3");
    if (w.dolly !== undefined && !inRange(w.dolly, -240, 2000)) bad("wall.dolly debe ser un número de px entre -240 y 2000");
    if (w.depth !== undefined && !inRange(w.depth, 0, 3)) bad("wall.depth debe ser un número entre 0 y 3");
    for (const k of ["gapX", "gapY"] as const) if (w[k] !== undefined && !inRange(w[k], 0.4, 3)) bad(`wall.${k} debe ser un número entre 0,4 y 3`);
    if (w.brick !== undefined && !inRange(w.brick, 0, 3)) bad("wall.brick debe ser un número entre 0 y 3");
    if (w.jitter !== undefined && !inRange(w.jitter, 0, 4)) bad("wall.jitter debe ser un número entre 0 y 4");
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

/** Opciones del muro con sus valores por defecto: desenfoque por bloque, tamaño de piezas, recorrido extra de cámara y dispersión en profundidad, separación entre piezas, corrimiento ladrillo y temblor. */
export function wallOptions(d: StoryDesign | undefined) {
  const w = d?.wall;
  const b = w?.blur;
  return {
    blurOpening: typeof b === "object" && b ? b.opening !== false : b !== false,
    blurClosing: typeof b === "object" && b ? b.closing !== false : b !== false,
    chipScale: w?.chipScale ?? 1,
    dolly: w?.dolly ?? 0,
    depth: w?.depth ?? 1,
    gapX: w?.gapX ?? 1,
    gapY: w?.gapY ?? 1,
    brick: w?.brick ?? 1,
    jitter: w?.jitter ?? 1,
  };
}
