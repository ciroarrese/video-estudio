import React, { createContext, useContext } from "react";
import { DockedHeadline } from "../kit";
import { useVideoConfig } from "../engine";
import { useTheme } from "../themes";
import { AVG_REG, fitText, textWidth } from "./layout";
import { listOptions } from "./types";
import type { StorySpec } from "./types";

export type TopicInfo = {
  index: number;
  name: string;
  line: string;
  /** La apertura terminó acoplando el titular de este tema (`design.handoff: "dock"`): `TopicHeadline` arranca ya puesto, sin volver a entrar. */
  docked?: boolean;
  /** Cómo se dibuja el titular: sale de `spec.design` (ver `headlineDefaults`); sin él, apilado y tamaño medio. */
  headline?: HeadlineDefaults;
};

/** Lo que la historia decide de la píldora del titular: `design.list` ("inline" → una sola línea con la del tema), `design.headline.size` y `design.gradient.loop`. */
export type HeadlineDefaults = { layout: "stacked" | "inline"; size: "md" | "sm"; gradientLoop?: number };

export const headlineDefaults = (spec: StorySpec): HeadlineDefaults => ({
  layout: listOptions(spec.design).layout,
  size: spec.design?.headline?.size ?? "md",
  gradientLoop: spec.design?.gradient?.loop,
});

/** Cuadros que tarda en entrar la píldora del titular (los de `DockedHeadline`). */
const DOCK_IN = 18;

export const TopicContext = createContext<TopicInfo | null>(null);

/**
 * Da el tema `index` de `spec` a lo que va dentro (`useTopic()`, `<TopicHeadline />`): es lo que hace `composeStory` con cada escena, para
 * quien arma la historia a mano con `Sequence`. `docked`: la apertura terminó acoplando este titular (ver `StoryDesign.handoff`).
 */
export function TopicProvider({ spec, index, docked, children }: { spec: StorySpec; index: number; docked?: boolean; children?: React.ReactNode }) {
  const t = spec.topics[index];
  if (!t) throw new Error(`TopicProvider: el tema ${index} no existe (hay ${spec.topics.length})`);
  return <TopicContext.Provider value={{ index, name: t.name, line: t.line, docked, headline: headlineDefaults(spec) }}>{children}</TopicContext.Provider>;
}

/**
 * Tema que se está mostrando (`index` desde 0): lo da la historia armada por `composeStory`.
 * Una escena renderizada SOLA (fuera de la historia) no tiene tema: pasá un `fallback` (p. ej. `{ name: "Panel de ventas" }`) y
 * lo usa, completando `index` en 0 y `line` vacía. Sin `fallback` fuera de una historia lanza un error que dice cómo resolverlo.
 */
export function useTopic(fallback?: Partial<TopicInfo>): TopicInfo {
  const t = useContext(TopicContext);
  if (t) return t;
  if (fallback) return { index: 0, name: "", line: "", ...fallback };
  throw new Error("useTopic: no hay tema fuera de una historia (composeStory). Para renderizar la escena sola, usá useTopic({ name: \"...\" }) o <TopicHeadline title=\"...\" />");
}

/** Igual que `useTopic` pero devuelve null fuera de una historia (no lanza). */
export const useTopicOrNull = (): TopicInfo | null => useContext(TopicContext);

const warned = new Set<string>();
/** Aviso de desarrollo, una sola vez por mensaje (no cambia lo que se dibuja: el cuadro sigue siendo función pura de sus props). */
function warnOnce(msg: string) {
  if (warned.has(msg)) return;
  warned.add(msg);
  if (typeof console !== "undefined") console.warn(msg);
}

/**
 * Titular del tema (píldora arriba a la izquierda) ya armado con el nombre y la línea del tema.
 * La escena decide cuándo mostrarlo (`start`) y cuándo apartarlo (`hide`, 0..1, p. ej. `hideFromScale(cam.scale)`). Si la apertura
 * terminó acoplando este titular (`design.handoff: "dock"`) ya está puesto en el cuadro 0 y `start` no se usa.
 *
 * Fuera de una historia (escena renderizada sola) no hay tema: usa `title` y `number` (1 por defecto) si los pasás; si no pasás
 * `title`, no dibuja nada y avisa una vez en la consola. Dentro de una historia, `title`/`number` pisan al tema.
 */
export function TopicHeadline({ start = 0, hide = 0, frame, title, number, layout, subtitle, size }: {
  start?: number;
  hide?: number;
  frame?: number;
  title?: string;
  number?: number;
  /** `"stacked"` o `"inline"` (una sola línea: `01 Nombre · línea`). Por defecto el de la historia (`design.list`); inline solo rige en formatos anchos. */
  layout?: "stacked" | "inline";
  /** Línea bajo el título (o tras el `·` en inline). Por defecto, la del tema en inline y ninguna en apilado. */
  subtitle?: string;
  /** `"md"` o `"sm"`. Por defecto el de la historia (`design.headline.size`). */
  size?: "md" | "sm";
}) {
  const t = useTopicOrNull();
  const theme = useTheme();
  const { width, height } = useVideoConfig();
  const name = title ?? t?.name;
  if (name === undefined) {
    warnOnce("TopicHeadline: no hay tema (la escena se renderiza fuera de una historia) y falta la prop `title`; no se dibuja el titular. Pasá title=\"...\" para verla sola.");
    return null;
  }
  // con la apertura acoplada la píldora ya está puesta desde el cuadro 0 de la escena: su entrada ocurrió al final de la apertura
  const at = t?.docked && title === undefined ? Math.min(start, -DOCK_IN) : start;
  const def = t?.headline;
  // inline solo en formatos anchos (igual que la lista); en vertical y cuadrado, apilado
  const wide = width / height >= 1.3;
  const lay = (layout ?? def?.layout ?? "stacked") === "inline" && wide ? "inline" : "stacked";
  const topicLine = t && (title === undefined || title === t.name) ? t.line : undefined;
  const sub = subtitle ?? (lay === "inline" ? topicLine : undefined);
  const sz = size ?? def?.size ?? "md";
  // el titular y la línea se ajustan al ancho disponible de la píldora (sin medir): en una línea comparten el ancho seguro
  const room = Math.max(300, width - 2 * theme.safe.x - 140);
  const k = sz === "sm" ? 0.85 : 1;
  const titleFit = fitText(name, lay === "inline" && sub ? Math.min(760, room * 0.6) : 760, 32, { min: 22 });
  const subFit = sub && lay === "inline" ? fitText(sub, Math.max(120, room - textWidth(titleFit.text, theme.type.caption * k) - 60), theme.type.eyebrow * k, { min: theme.type.eyebrow * k, avg: AVG_REG }).text : sub;
  return <DockedHeadline index={number ?? (t ? t.index + 1 : 1)} title={titleFit.text} subtitle={subFit} layout={lay} size={sz} gradientLoop={def?.gradientLoop} start={at} hide={hide} frame={frame} />;
}
