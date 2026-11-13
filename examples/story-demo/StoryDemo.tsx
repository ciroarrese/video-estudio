import { useFrame } from "../../engine";
import { CountUp, Cursor, GradientText, Wash, World, cameraAt, hideFromScale, kf, zoomThrough } from "../../kit";
import type { CameraKey } from "../../kit";
import { useTheme } from "../../themes";
import { TopicHeadline, defineStory } from "../../stories";
import type { StorySpec, TopicScene } from "../../stories";

// Invented content: generic topics, no real systems or figures.
export const spec: StorySpec = {
  title: { text: "Un día en la oficina", highlight: "la oficina" },
  topics: [
    { id: "ventas", name: "Panel de ventas", line: "los números del día en una sola vista" },
    { id: "inventario", name: "Inventario", line: "qué hay, qué falta y qué se mueve" },
    { id: "atencion", name: "Atención", line: "cada consulta, con su respuesta a tiempo" },
  ],
  labels: [
    "Resumen diario", "Metas del mes", "Pedidos nuevos", "Stock mínimo", "Alta de producto", "Consultas abiertas",
    "Tiempo de respuesta", "Clientes activos", "Reporte semanal", "Alertas", "Etiquetas", "Búsqueda rápida",
    "Historial", "Exportar", "Filtros guardados", "Tablero compartido",
  ],
  signoff: { text: "Gracias por mirar", tagline: "Video de ejemplo con datos ficticios" },
};

type Variant = { stats: [string, number][]; rows: string[]; pick: number };

const VARIANTS: Variant[] = [
  { stats: [["Pedidos", 128], ["Visitas", 342], ["Cierres", 87]], rows: ["Elemento alfa", "Elemento beta", "Elemento gamma", "Elemento delta"], pick: 1 },
  { stats: [["Artículos", 540], ["Faltantes", 23], ["Entradas", 61]], rows: ["Depósito norte", "Depósito sur", "Mostrador", "Reserva"], pick: 0 },
  { stats: [["Abiertas", 42], ["En curso", 17], ["Resueltas", 96]], rows: ["Consulta uno", "Consulta dos", "Consulta tres", "Consulta cuatro"], pick: 2 },
];

const P = { x: 260, y: 230, w: 1400, h: 700 };
const CARD = { w: 400, h: 200 };
const cardPos = (i: number) => ({ x: P.x + 50 + i * 450, y: P.y + 90 });
const center = (i: number) => ({ x: cardPos(i).x + CARD.w / 2, y: cardPos(i).y + CARD.h / 2 });
const DUR = 150;
const THROUGH: [number, number] = [112, 149];

function DemoScene({ variant }: { variant: number }) {
  const theme = useTheme();
  const f = useFrame();
  const v = VARIANTS[variant]!;
  const target = center(v.pick);
  const keys: CameraKey[] = [
    { f: 0, x: 960, y: 540, scale: 1 },
    { f: 30, x: 960, y: 540, scale: 1 },
    { f: 62, x: target.x, y: target.y, scale: 1.7 },
    { f: 100, x: target.x, y: target.y, scale: 1.7 },
    { f: 112, x: 960, y: 540, scale: 1 },
    { f: 149, x: 960, y: 540, scale: 1 },
  ];
  const cam = cameraAt(f, keys, { map: (fr, c) => zoomThrough(fr, THROUGH, c, { x: P.x + P.w - 120, y: P.y + 520 }, 40), noBlurFrom: THROUGH[0] });
  const appear = kf(f, [0, 20], [0, 1]);
  return (
    <>
      <World camera={cam} width={1920} height={1080}>
        <div style={{ position: "absolute", left: P.x, top: P.y, width: P.w, height: P.h, background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.lg, boxShadow: theme.shadow.lg, opacity: appear }}>
          <div style={{ padding: "26px 50px", fontSize: theme.type.body, fontWeight: theme.font.weights.semibold, color: theme.color.text }}>
            <GradientText>Resumen</GradientText>
          </div>
        </div>
        {v.stats.map(([label, value], i) => {
          const a = kf(f, [8 + i * 6, 26 + i * 6], [0, 1]);
          const selected = i === v.pick;
          return (
            <div
              key={label}
              style={{
                position: "absolute", left: cardPos(i).x, top: cardPos(i).y + (1 - a) * 30, width: CARD.w, height: CARD.h, opacity: a,
                background: theme.color.surfaceAlt, borderRadius: theme.radius.panel, padding: 30, boxSizing: "border-box",
                border: `2px solid ${selected && f > 55 ? theme.color.accent : theme.color.border}`,
              }}
            >
              <div style={{ fontSize: theme.type.eyebrow, color: theme.color.textMuted }}>{label}</div>
              <div style={{ fontSize: theme.type.stat * 0.6, fontWeight: theme.font.weights.stat, color: [theme.color.accent, theme.color.accent2, theme.color.success][(i + variant) % 3] }}>
                <CountUp from={0} to={value} start={12 + i * 6} duration={40} />
              </div>
            </div>
          );
        })}
        {v.rows.map((r, i) => {
          const a = kf(f, [30 + i * 5, 48 + i * 5], [0, 1]);
          return (
            <div key={r} style={{ position: "absolute", left: P.x + 50, top: P.y + 340 + i * 74, width: P.w - 100, height: 56, opacity: a, display: "flex", alignItems: "center", padding: "0 24px", boxSizing: "border-box", borderRadius: theme.radius.md, background: theme.color.bg, border: `1px solid ${theme.color.border}`, fontSize: theme.type.eyebrow, color: theme.color.text }}>
              {r}
              <span style={{ marginLeft: "auto", width: 80 + ((i * 53 + variant * 31) % 120), height: 14, borderRadius: theme.radius.pill, background: theme.color.chart[(i + variant) % theme.color.chart.length] }} />
            </div>
          );
        })}
        <Cursor keys={[[0, 1500, 900], [30, 1500, 900], [58, target.x + 90, target.y + 60]]} clicks={[60]} show={[26, 100]} />
      </World>
      <TopicHeadline start={4} hide={hideFromScale(cam.scale)} />
      <Wash range={[133, 149]} />
    </>
  );
}

const scene = (id: string, variant: number): TopicScene => ({ id, component: () => <DemoScene variant={variant} />, durationInFrames: DUR });

const scenes: TopicScene[] = [scene("ventas", 0), scene("inventario", 1), scene("atencion", 2)];
// la segunda escena trae su propio panel para el cierre; las otras usan la tarjeta por defecto
scenes[1] = {
  ...scenes[1]!,
  thumbnail: () => {
    const theme = useTheme();
    return (
      <div style={{ width: 560, height: 340, borderRadius: theme.radius.lg, background: theme.color.surface, border: `1px solid ${theme.color.border}`, boxShadow: theme.shadow.lg, padding: 34, boxSizing: "border-box" }}>
        {[0.9, 0.7, 0.5, 0.8].map((w, i) => (
          <div key={i} style={{ height: 36, width: `${w * 100}%`, marginBottom: 22, borderRadius: theme.radius.pill, background: theme.color.chart[i % theme.color.chart.length], opacity: 0.85 }} />
        ))}
      </div>
    );
  },
};

export const storyDemo = defineStory({ id: "story-demo", spec, scenes });
export { scenes as demoScenes };
