import type React from "react";

/** Una escena de tema que entra en la historia. */
export type TopicScene = {
  id: string;
  component: React.FC;
  durationInFrames: number;
  /** Panel pequeño (560x340 de lienzo) que se muestra en el cierre. Por defecto, una tarjeta neutra con el nombre del tema. */
  thumbnail?: React.FC;
};

export type StoryTopic = { id: string; name: string; line: string };

/** Duraciones (en cuadros) de los tres bloques generados; lo que no se indica usa el valor por defecto. */
export type StoryTiming = { opening?: number; interlude?: number; closing?: number };

export type StorySpec = {
  /** `highlight` es un fragmento de `text` que se pinta con el degradado del tema. */
  title: { text: string; highlight?: string };
  /** De 2 a 6 temas. */
  topics: StoryTopic[];
  /** Palabras del muro; si faltan, se repiten de forma determinista. */
  labels: string[];
  /** `logo` es una ruta de /public (se resuelve con `asset()`); `text` es la línea de cierre. */
  signoff: { logo?: string; tagline?: string; text: string };
  timing?: StoryTiming;
};

export const MIN_TOPICS = 2;
export const MAX_TOPICS = 6;

/** Lanza un error claro si la configuración no se puede componer. */
export function validateSpec(spec: StorySpec): void {
  const n = spec?.topics?.length ?? 0;
  if (n < MIN_TOPICS || n > MAX_TOPICS) {
    throw new Error(`StorySpec: hacen falta entre ${MIN_TOPICS} y ${MAX_TOPICS} temas (hay ${n})`);
  }
  if (!spec.title?.text) throw new Error("StorySpec: falta title.text");
  if (!spec.signoff?.text) throw new Error("StorySpec: falta signoff.text");
  const ids = new Set(spec.topics.map((t) => t.id));
  if (ids.size !== n) throw new Error("StorySpec: los id de los temas deben ser únicos");
  for (const [k, v] of Object.entries(spec.timing ?? {})) {
    if (v !== undefined && (!Number.isFinite(v) || v < 60)) throw new Error(`StorySpec: timing.${k} debe ser un número de cuadros >= 60`);
  }
}
