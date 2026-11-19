import { random, useFrame, useVideoConfig } from "../../engine";
import { Wash, kf } from "../../kit";
import { entrance, surfaceStyle, textStyle, withAlpha, useTheme } from "../../themes";
import { TopicHeadline, defineStory } from "../../stories";
import type { StorySpec, TopicScene } from "../../stories";

// Historia con una capa de fondo global (`spec.backdrop`): unos puntos que derivan despacio detrás de TODO el video (apertura, escenas, vueltas al
// listado y cierre), sobre el fondo del tema y bajo el contenido. Dentro de la capa `useFrame()` es el cuadro ABSOLUTO del video: cada punto está en
// el mismo lugar antes y después de un corte, y los velos (`Wash`) la llevan encima de su color, así que no se corta ni parpadea. Contenido inventado.
const PUNTOS = 46;

/** Puntos que derivan: posición y velocidad de cada uno salen de su índice (pseudoazar determinista), el movimiento es función del cuadro absoluto. */
function Puntos() {
  const theme = useTheme();
  const f = useFrame(); // en la ranura, el cuadro absoluto
  const { width, height } = useVideoConfig();
  const colores = [theme.color.accent, theme.color.accent2];
  return (
    <>
      {Array.from({ length: PUNTOS }, (_, i) => {
        const x0 = random(`px${i}`) * width;
        const y0 = random(`py${i}`) * height;
        const vx = (random(`vx${i}`) - 0.3) * 0.9; // px por cuadro: casi todos van hacia la derecha
        const vy = (random(`vy${i}`) - 0.5) * 0.5;
        const r = 3 + random(`r${i}`) * 7;
        const x = (((x0 + vx * f) % width) + width) % width;
        const y = (((y0 + vy * f + Math.sin((f + i * 17) / 55) * 14) % height) + height) % height;
        return <div key={i} style={{ position: "absolute", left: Math.round(x - r), top: Math.round(y - r), width: r * 2, height: r * 2, borderRadius: "50%", background: withAlpha(colores[i % 2]!, 0.35) }} />;
      })}
    </>
  );
}

export const spec: StorySpec = {
  title: { text: "Una semana en la huerta", highlight: "huerta" },
  topics: [
    { id: "siembra", name: "Siembra", line: "Qué entra en la tierra este mes" },
    { id: "riego", name: "Riego", line: "Cuánta agua, y cuándo" },
    { id: "cosecha", name: "Cosecha", line: "Lo que ya está listo" },
  ],
  labels: ["Siembra", "Riego", "Cosecha", "Compost", "Podas", "Semillas", "Plagas", "Clima"],
  signoff: { text: "Gracias por mirar", tagline: "Video de ejemplo con datos ficticios" },
  backdrop: Puntos,
};

const FILAS: string[][] = [
  ["Lechuga", "Zanahoria", "Albahaca"],
  ["Lunes y jueves", "Mañana temprano", "Sin mojar las hojas"],
  ["Tomates", "Calabacines", "Rúcula"],
];

export const DUR = 150;

/** Escena de tema: una tarjeta con tres filas y un `Wash` al final; los puntos pasan por detrás de la tarjeta y del velo no desaparecen. */
function Escena({ i }: { i: number }) {
  const theme = useTheme();
  const f = useFrame();
  const t = spec.topics[i]!;
  return (
    <>
      <div style={{ position: "absolute", left: theme.safe.x, top: 300, width: 900, boxSizing: "border-box", padding: "28px 36px", display: "flex", flexDirection: "column", gap: 16, ...surfaceStyle(theme, "window"), ...entrance(theme, kf(f, [4, 24], [0, 1]), 0) }}>
        <div style={{ fontSize: theme.type.body, color: theme.color.text, ...textStyle(theme, "title") }}>{t.name}</div>
        {FILAS[i]!.map((r, k) => (
          <div key={r} style={{ padding: "18px 24px", fontSize: theme.type.caption, color: theme.color.text, ...surfaceStyle(theme, "chip"), ...entrance(theme, kf(f, [14 + k * 6, 34 + k * 6], [0, 1]), k + 1) }}>{r}</div>
        ))}
      </div>
      <TopicHeadline start={4} />
      <Wash range={[133, 149]} />
    </>
  );
}

const scenes: TopicScene[] = spec.topics.map((t, i) => ({ id: t.id, component: () => <Escena i={i} />, durationInFrames: DUR }));

export const storyDemoFondo = defineStory({ id: "story-demo-fondo", spec, scenes });
