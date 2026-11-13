// Casos de las pruebas de determinismo de historias: cada uno es un video temporal con su propio `StorySpec`.
import { join, resolve } from 'node:path';
import { engineDir } from '../render/testing';

const root = resolve(__dirname, '..');
const storiesDir = join(root, 'stories');

type Topic = { id: string; name: string; line: string };
export type Case = {
  id: string;
  spec: Record<string, any>;
  storyOpts?: Record<string, unknown>;
  /** Índices de temas sin escena (`null` en la lista de escenas). */
  noScene?: number[];
  /** Pone un `signoff.slot` propio (un nodo no se puede guardar en el JSON del spec). */
  slot?: boolean;
  /** Design system con el que se renderiza (`neutral` por defecto): los de estilo propio cambian el cartel, la lista, el fondo y el movimiento. */
  theme?: "neutral" | "dark" | "editorial" | "neon" | "papel";
  /** Formatos extra que se verifican además del horizontal. */
  formats?: ("vertical" | "cuadrado")[];
};

const T = (n: number, long = false): Topic[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: long ? `Un nombre de tema bastante largo número ${i + 1} del recorrido` : `Tema ${i + 1}`, line: long ? "una línea descriptiva que también es larga, para forzar el ajuste del texto" : `línea del tema ${i + 1}` }));

export const CASES: Case[] = [
  { id: "d-corto", spec: { title: { text: "Hola" }, topics: T(2), labels: ["Uno", "Dos"], signoff: { text: "Chau" } } },
  { id: "d-resaltado", spec: { title: { text: "Un día en la oficina", highlight: "la oficina" }, topics: T(3), labels: ["Resumen diario", "Metas del mes", "Pedidos nuevos"], signoff: { text: "Gracias por mirar", tagline: "Datos ficticios" } } },
  { id: "d-largo", spec: { title: { text: "Cómo ordenamos el trabajo de todo el equipo durante el año entero, paso por paso", highlight: "paso por paso" }, topics: T(4), labels: [], signoff: { text: "Hasta la próxima vez que nos veamos por acá", tagline: "Una nota de pie algo más larga que de costumbre" } } },
  { id: "d-seis", spec: { title: { text: "Seis temas con nombres largos" }, topics: T(6, true), labels: ["A", "B", "C", "D", "E", "F", "G", "H"], signoff: { text: "Fin" } } },
  { id: "d-acentos", spec: { title: { text: "¿Qué hicimos esta semana? Ñandú, óptica y más", highlight: "Ñandú" }, topics: T(3, true), labels: ["Año nuevo", "Ñoquis", "Canción", "Pingüino", "Éxito", "Último"], signoff: { text: "¡Gracias!" } } },
  { id: "d-una-palabra", spec: { title: { text: "Resumen" }, topics: T(5), labels: ["Etiqueta con bastante texto para ajustar el ancho de la pieza del muro"], signoff: { text: "Listo", tagline: "Fin" } } },
  { id: "d-timing", spec: { title: { text: "Tiempos propios del recorrido", highlight: "propios" }, topics: T(3), labels: ["x", "y", "z"], signoff: { text: "Cierre" }, timing: { opening: 150, interlude: 70, closing: 200 } } },
  // ---- opciones de diseño (cartel de vidrio, lista en un renglón, acople, muro, nubes, temas sin escena, firma solo con marca) ----
  { id: "o-vidrio", formats: ["vertical", "cuadrado"], spec: { title: { text: "Cartel de vidrio sobre el muro", highlight: "vidrio" }, topics: T(3), labels: ["Alfa", "Beta", "Gamma", "Delta", "Épsilon"], signoff: { text: "Gracias por **mirar**", tagline: "Con una nota **destacada** al pie" },
      design: { titleCard: "glass", wall: { columns: 4, rows: 5, blur: false }, clouds: { colors: ["accent", "chart[2]"], opacity: 0.3, blobs: [{ x: 0.2, y: 0.3, size: 800 }, { x: 0.8, y: 0.7, size: 900, color: "accent2" }] } } } },
  { id: "o-renglon", formats: ["vertical"], storyOpts: { interludes: "compact" }, spec: { title: { text: "Lista en un renglón" }, topics: T(4, true), labels: [], signoff: { text: "Fin" }, design: { list: "inline" } } },
  { id: "o-acople", noScene: [0], spec: { title: { text: "Apertura que se acopla a la escena", highlight: "acopla" }, topics: T(4), labels: ["Uno", "Dos", "Tres"], signoff: { text: "Hasta pronto" }, design: { handoff: "dock", list: "inline" } } },
  { id: "o-parcial", noScene: [1, 3], formats: ["cuadrado"], spec: { title: { text: "Cuatro temas, dos escenas" }, topics: T(4), labels: ["A", "B", "C"], signoff: { text: "Cierre" }, design: { titleCard: "glass", wall: { columns: 8, rows: 4 } } } },
  { id: "o-solo-marca", slot: true, spec: { title: { text: "Firma solo con marca" }, topics: T(2), labels: ["X", "Y"], signoff: { tagline: "Solo la marca y una nota" }, design: { handoff: "dock" } } },
  // ---- segunda migración: acople con lista en renglón, atravesado sin velo, bucle del degradado, opciones del muro, fondo del cierre ----
  { id: "o-paso", spec: { title: { text: "Atravesamos el primer titular", highlight: "primer titular" }, topics: T(3), labels: ["Uno", "Dos", "Tres"], signoff: { text: "Fin" }, design: { handoff: "through", list: { layout: "inline", underline: "name" } } } },
  { id: "o-paso-corto", noScene: [0], spec: { title: { text: "Hola" }, topics: T(2), labels: [], signoff: { text: "Chau" }, design: { handoff: "through" } } },
  { id: "o-paso-largo", formats: ["vertical"], spec: { title: { text: "Un título muy largo para ver cómo se atraviesa el primer titular de una lista con nombres largos", highlight: "primer titular" }, topics: T(4, true), labels: ["A", "B"], signoff: { text: "Hasta la próxima", tagline: "Nota al pie" }, design: { handoff: "through" } } },
  { id: "o-bucle", formats: ["vertical", "cuadrado"], spec: { title: { text: "Degradado en bucle", highlight: "bucle" }, topics: T(3), labels: ["Alfa", "Beta"], signoff: { text: "Gracias por **mirar**" }, design: { handoff: "dock", list: "inline", headline: { size: "sm" }, gradient: { loop: 45 } } } },
  { id: "o-muro", spec: { title: { text: "Muro con opciones", highlight: "opciones" }, topics: T(3), labels: ["Alfa", "Beta", "Gamma"], signoff: { text: "Fin" }, design: { wall: { chipScale: 1.4, dolly: 500, depth: 1.6, blur: { opening: false, closing: true } }, closing: { bg: "surface" } } } },
  { id: "o-vistos", noScene: [1], spec: { title: { text: "Tema visto sin escena" }, topics: T(3).map((t, i) => (i === 1 ? { ...t, seen: true } : t)), labels: [], signoff: { text: "Fin" } } },
  // design systems con estilo propio (sin `design` en el video: lo decide el tema; ver `docs/estilo.md`)
  { id: "e-editorial", theme: "editorial", formats: ["vertical"], spec: { title: { text: "Un día en la oficina", highlight: "la oficina" }, topics: T(3), labels: ["Resumen diario", "Metas del mes", "Pedidos nuevos"], signoff: { text: "Gracias por mirar", tagline: "Datos ficticios" } } },
  { id: "e-neon", theme: "neon", formats: ["cuadrado"], spec: { title: { text: "Atravesamos y brillamos", highlight: "brillamos" }, topics: T(4, true), labels: ["Alfa", "Beta", "Gamma", "Delta"], signoff: { text: "Hasta pronto", tagline: "Nota al pie" } } },
  { id: "e-papel", theme: "papel", noScene: [0], spec: { title: { text: "Papel con marcador", highlight: "marcador" }, topics: T(3), labels: ["Uno", "Dos", "Tres"], signoff: { text: "Fin" }, design: { closing: { bar: true } } } },
  { id: "o-sin-escenas", noScene: [0, 1, 2], spec: { title: { text: "Solo apertura y cierre" }, topics: T(3), labels: [], signoff: { text: "Fin" } } },
];

const sceneSource = `
const Scene = () => {
  const f = useFrame();
  return React.createElement(React.Fragment, null,
    React.createElement(TopicHeadline, { start: 4 }),
    React.createElement("div", { style: { position: "absolute", left: 200, top: 300, width: 400 + f, height: 200, background: "transparent" } }));
};`;

export function videoFile(c: Case): string {
  const spec = { ...c.spec, signoff: { ...c.spec.signoff } };
  return `import React from "react";
import { useFrame } from ${JSON.stringify(engineDir)};
import { defineStory, TopicHeadline } from ${JSON.stringify(storiesDir)};
${sceneSource}
const spec = ${JSON.stringify(spec)};
${c.slot ? 'spec.signoff.slot = React.createElement("div", { style: { width: 220, height: 220, borderRadius: 40, background: "#3b5bdb" } });' : ""}
const none = ${JSON.stringify(c.noScene ?? [])};
const scenes = spec.topics.map((t, i) => (none.includes(i) ? null : { id: t.id, component: Scene, durationInFrames: 60 }));
export default defineStory({ id: ${JSON.stringify(c.id)}, spec, scenes, theme: ${JSON.stringify(c.theme ?? "neutral")}, ${c.formats ? `formats: ${JSON.stringify(c.formats)}, ` : ""}...${JSON.stringify(c.storyOpts ?? {})} });
`;
}

/** Escenas generadas que se verifican de cada caso: apertura, primera vuelta (si hay alguna escena de tema) y cierre. */
export function scenesToCheck(c: Case): string[] {
  const hasScenes = (c.noScene?.length ?? 0) < c.spec.topics.length;
  return ["opening", ...(hasScenes ? ["interlude-1"] : []), "closing"];
}
