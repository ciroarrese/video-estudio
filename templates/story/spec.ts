// Configuración de la historia: de ella salen la apertura, las vueltas al listado y el cierre.
// Todo el contenido es ficticio; reemplazalo con lo aprobado en las fichas y el guion.
import type { StorySpec } from "../../stories";

export const spec: StorySpec = {
  title: { text: "Un día en la oficina", highlight: "la oficina" }, // `highlight` va con el degradado del tema
  topics: [
    { id: "tema-uno", name: "Primer tema", line: "lo que permite hacer, en una línea" },
    { id: "tema-dos", name: "Segundo tema", line: "lo que cambia para quien lo usa" },
  ], // de 2 a 6 temas, mismo orden que las escenas
  labels: ["Resumen", "Metas", "Pedidos", "Alertas", "Historial", "Exportar"], // palabras del muro de la apertura
  signoff: { text: "Gracias por mirar", tagline: "Video de ejemplo con datos ficticios" }, // marca propia: `slot` con un nodo propio (o `logo`)
  // Presupuesto: total = apertura + suma de escenas + (vueltas al listado = nº de temas) x interlude + cierre.
  // Con `interludes: "compact"` en defineStory cada vuelta dura `interludeCompact` (40 por defecto, mínimo 24) en vez de `interlude`.
  // Por defecto (300 / 120 / 480) ya son 780 + 120 por tema antes de sumar las escenas: un video corto exige bajarlos.
  // Acá: 120 + 2 x (150 + 60) + 120 = 660 cuadros (22 s). Mínimo 60 cada uno; la apertura, al menos ~120 para que el título se lea.
  timing: { opening: 120, interlude: 60, closing: 120 },
};
