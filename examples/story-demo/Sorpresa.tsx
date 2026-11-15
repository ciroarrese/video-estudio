import { defineStory, storyCues } from "../../stories";
import type { StorySpec, TopicScene } from "../../stories";
import { DUR, DemoScene, demoScenes, spec as baseSpec } from "./StoryDemo";

// Variante de la demo con un último tema sorpresa (contenido inventado). La apertura anuncia tres temas; después de la escena del tercero, la
// escena sorpresa sigue directo (continúa el movimiento de la cámara, sin vuelta al listado); recién entonces la lista vuelve con los tres temas
// tildados y una cuarta fila que nunca estuvo se suma y se tilda. El cierre muestra los cuatro.
//
// Es un video aparte (`story-demo-sorpresa`) y no una prop de `story-demo`: la duración del video se fija al registrarlo y no puede depender de las props.
export const specSorpresa: StorySpec = {
  ...baseSpec,
  topics: [
    ...baseSpec.topics,
    { id: "sorpresa", name: "Un dato extra", line: "algo que no estaba en la lista", reveal: "late" },
  ],
};

// La tercera escena se corta antes de su salida (la historia le da 100 cuadros aunque la escena dibuja 150): la que sigue arranca donde la cámara quedó.
const CUT = 100;
export const scenesSorpresa: TopicScene[] = [
  demoScenes[0]!,
  demoScenes[1]!,
  { ...demoScenes[2]!, durationInFrames: CUT },
  { id: "sorpresa", component: () => <DemoScene variant={3} />, durationInFrames: DUR },
];

export const storyDemoSorpresa = defineStory({ id: "story-demo-sorpresa", spec: specSorpresa, scenes: scenesSorpresa, formats: ["vertical", "cuadrado"] });
/** Los cuadros notables (para generar la lista de sonidos): ver `storyCues`. */
export const cuesSorpresa = () => storyCues(specSorpresa, scenesSorpresa);
