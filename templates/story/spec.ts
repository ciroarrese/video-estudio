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
  signoff: { text: "Gracias por mirar", tagline: "Video de ejemplo con datos ficticios" },
  // timing: { opening: 300, interlude: 120, closing: 450 }, // opcional, en cuadros (mínimo 60)
};
