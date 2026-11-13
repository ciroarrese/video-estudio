// Historia inicial: apertura + (escena -> vuelta al listado) x n + cierre.
// Se copia con: bash templates/nuevo.sh historia <slug> <escena> (corrige imports e id).
// Después reemplazá `escena1`/`escena2` por las escenas reales (una carpeta por escena en videos/<slug>/)
// (no hace falta registrarla: el runtime descubre toda carpeta videos/<slug>/**/index.ts).
import React from "react";
import { defineStory } from "../../stories";
import type { TopicScene } from "../../stories";
import { theme } from "../theme";
import { DURACION, SceneBody } from "../scene/Scene";
import { spec } from "./spec";

// La historia ya envuelve cada escena en un `Stage`, por eso se usa `SceneBody` y no `Scene`.
// El titular puede venir de la ficha del tema (`spec.topics[i].name`) o escribirse a mano.
const escena1: React.FC = () => React.createElement(SceneBody, { title: spec.topics[0]!.name, subtitle: "Vista general" });
const escena2: React.FC = () => React.createElement(SceneBody, { title: spec.topics[1]!.name, subtitle: "Vista general" });

// Una escena por tema, en el mismo orden que `spec.topics`.
const scenes: TopicScene[] = [
  { id: "tema-uno", component: escena1, durationInFrames: DURACION },
  { id: "tema-dos", component: escena2, durationInFrames: DURACION },
];

export default defineStory({
  id: "plantilla-historia",
  spec,
  scenes,
  theme, // el tema del video (videos/<slug>/theme.ts)
  // audio: { src: "music/pista.m4a", startFrom: 0, volume: 0.8 }, // pista que cubre todo el video (archivo en public/ o --assets)
});
