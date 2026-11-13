import { defineStory } from "../../stories";
import { demoScenes, spec } from "../story-demo/StoryDemo";
const names = ["Armar el itinerario entre todos ahora", "Votar los planes con todo el grupo ya", "Repartir los gastos de forma pareja ok"];
const sp = { ...spec, topics: spec.topics.map((t, i) => ({ ...t, name: names[i]! })), timing: { opening: 120, interlude: 60, closing: 150 } };
export default defineStory({ id: "tmp-long", spec: sp, scenes: demoScenes, formats: ["vertical", "cuadrado"] });
