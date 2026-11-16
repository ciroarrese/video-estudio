import { useFormat, useFrame } from "../../engine";
import { Wash, kf, subtitulosDeGuion } from "../../kit";
import { entrance, staggerFrames, surfaceStyle, textStyle, useTheme } from "../../themes";
import { TopicHeadline, defineStory, useSubtitleBand } from "../../stories";
import type { StorySpec, TopicScene } from "../../stories";

// Historia con subtítulos (`defineStory({ subtitles })`): la apertura, las vueltas, el cierre y las escenas de tema dejan libre la franja de los subtítulos en los tres formatos.
// Contenido inventado. Los nombres y las bajadas son a propósito de los que más cuestan en vertical ("Recordatorio", una bajada de 40 caracteres): el estrés de tipografía
// (`--font-fallback wide --font-scale 1.25`) tiene que dar 0 errores en horizontal, vertical y cuadrado.
export const spec: StorySpec = {
  title: { text: "Turnos para la veterinaria", highlight: "turnos" },
  topics: [
    { id: "pedir", name: "Pedir turno", line: "Elegí día y hora en dos toques, sin llamar" },
    { id: "recordatorio", name: "Recordatorio", line: "Un aviso antes del turno, sin que lo pidas" },
    { id: "historial", name: "Historial", line: "Todo lo que pasó con cada mascota, a mano" },
  ],
  labels: ["Pedir turno", "Aviso", "Historial", "Vacunas", "Peso", "Controles", "Recetas", "Estudios"],
  signoff: { text: "Gracias por mirar", tagline: "Video de ejemplo con datos ficticios" },
};

const ROWS: string[][] = [
  ["Lunes 10:30", "Martes 16:00", "Jueves 09:15"],
  ["Mañana, 10:30", "En dos días", "El viernes"],
  ["Vacuna anual", "Control de peso", "Desparasitación"],
];

export const DUR = 150;

/**
 * Escena de tema: una tarjeta con tres filas en la zona libre (el cuadro dentro del área segura, debajo de la píldora del tema y por encima de los subtítulos).
 * Todo en proporciones del espacio libre, así vale en los tres formatos.
 */
function Escena({ i }: { i: number }) {
  const theme = useTheme();
  const f = useFrame();
  const { width, height } = useFormat();
  const banda = useSubtitleBand();
  const top = theme.safe.y + 150; // debajo de la píldora del tema
  const bottom = (banda ? banda.y : height - theme.safe.y) - 32;
  const x = theme.safe.x;
  const w = width - 2 * x;
  const h = Math.max(240, Math.min(bottom - top, 620));
  const y = Math.round(top + (bottom - top - h) / 2);
  const t = spec.topics[i]!;
  return (
    <>
      <div style={{ position: "absolute", left: x, top: y, width: w, height: h, boxSizing: "border-box", padding: "28px 36px", display: "flex", flexDirection: "column", gap: 16, ...surfaceStyle(theme, "window"), ...entrance(theme, kf(f, [4, 24], [0, 1]), 0) }}>
        <div style={{ fontSize: theme.type.body, color: theme.color.text, ...textStyle(theme, "title") }}>{t.name}</div>
        {ROWS[i]!.map((r, k) => (
          <div key={r} style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 24px", fontSize: theme.type.caption, color: theme.color.text, ...surfaceStyle(theme, "chip"), ...entrance(theme, kf(f, [14 + staggerFrames(theme, k), 34 + staggerFrames(theme, k)], [0, 1]), k + 1) }}>{r}</div>
        ))}
      </div>
      <TopicHeadline start={4} />
      <Wash range={[133, 149]} />
    </>
  );
}

const scenes: TopicScene[] = spec.topics.map((t, i) => ({ id: t.id, component: () => <Escena i={i} />, durationInFrames: DUR }));

// Duraciones de cada bloque (cuadros a 30 fps): apertura 300, cada tema 150 y su vuelta 120, cierre 480 (`npm run qa -- story-demo-subtitulos --list-scenes`).
const guion = subtitulosDeGuion(
  [
    { texto: "Una veterinaria que quiere dar turnos sin vueltas. Tres cosas hace la herramienta.", frames: 300 },
    { texto: "Se pide el turno en dos toques.", frames: 150 },
    { texto: "Vuelve la lista.", frames: 120 },
    { texto: "Un aviso llega antes del turno.", frames: 150 },
    { texto: "Vuelve la lista.", frames: 120 },
    { texto: "Cada mascota tiene su historial a mano.", frames: 150 },
    { texto: "Vuelve la lista.", frames: 120 },
    { texto: "Eso es todo. Gracias por mirar.", frames: 480 },
  ],
  { fps: 30, entradaSec: 0.4, salidaSec: 0.4 },
);

export const storyDemoSubtitulos = defineStory({ id: "story-demo-subtitulos", spec, scenes, formats: ["vertical", "cuadrado"], subtitles: { cues: guion } });
