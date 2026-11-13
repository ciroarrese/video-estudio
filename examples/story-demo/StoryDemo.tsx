import { useFormat, useFrame } from "../../engine";
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

// Diseño por formato (`useFormat().pick`): en horizontal las tarjetas van en fila; en vertical, apiladas;
// en cuadrado, en fila pero más angostas. Todo en coordenadas del mundo (el centro es width/2 x height/2).
type Layout = {
  P: { x: number; y: number; w: number; h: number };
  CARD: { w: number; h: number };
  cardPos: (i: number) => { x: number; y: number };
  rowsTop: number;
  cursorHome: { x: number; y: number };
  /** Punto del panel que se atraviesa al final. */
  through: { x: number; y: number };
  /** Cuadros que se adelanta la entrada del panel (en formatos angostos el panel se ve completo enseguida). */
  lead: number;
};
// En vertical y cuadrado el panel está centrado en el cuadro, se ajusta a su contenido y se atraviesa por el medio (no por el borde).
const LAYOUTS: Record<"horizontal" | "vertical" | "cuadrado", Layout> = {
  horizontal: { P: { x: 260, y: 230, w: 1400, h: 700 }, CARD: { w: 400, h: 200 }, cardPos: (i) => ({ x: 310 + i * 450, y: 320 }), rowsTop: 340, cursorHome: { x: 1500, y: 900 }, through: { x: 260 + 1400 - 120, y: 230 + 340 + 180 }, lead: 0 },
  vertical: { P: { x: 60, y: 400, w: 960, h: 1120 }, CARD: { w: 860, h: 190 }, cardPos: (i) => ({ x: 110, y: 500 + i * 220 }), rowsTop: 780, cursorHome: { x: 900, y: 1440 }, through: { x: 540, y: 400 + 780 + 112 }, lead: 6 },
  cuadrado: { P: { x: 60, y: 200, w: 960, h: 680 }, CARD: { w: 270, h: 200 }, cardPos: (i) => ({ x: 110 + i * 300, y: 300 }), rowsTop: 330, cursorHome: { x: 900, y: 820 }, through: { x: 540, y: 200 + 330 + 112 }, lead: 6 },
};
const DUR = 150;
const THROUGH: [number, number] = [112, 149];

function DemoScene({ variant }: { variant: number }) {
  const theme = useTheme();
  const f = useFrame();
  const { format, width, height } = useFormat();
  const { P, CARD, cardPos, rowsTop, cursorHome, through, lead } = LAYOUTS[format];
  const cx = width / 2, cy = height / 2;
  const v = VARIANTS[variant]!;
  const target = { x: cardPos(v.pick).x + CARD.w / 2, y: cardPos(v.pick).y + CARD.h / 2 };
  const zoom = format === "horizontal" ? 1.7 : format === "vertical" ? 1.08 : 1.1; // en vertical la tarjeta ya ocupa casi todo el ancho
  const keys: CameraKey[] = [
    { f: 0, x: cx, y: cy, scale: 1 },
    { f: 30, x: cx, y: cy, scale: 1 },
    { f: 62, x: target.x, y: target.y, scale: zoom },
    { f: 100, x: target.x, y: target.y, scale: zoom },
    { f: 112, x: cx, y: cy, scale: 1 },
    { f: 149, x: cx, y: cy, scale: 1 },
  ];
  const cam = cameraAt(f, keys, { map: (fr, c) => zoomThrough(fr, THROUGH, c, through, 40), noBlurFrom: THROUGH[0] });
  const appear = kf(f, [0, 20 - lead], [0, 1]);
  return (
    <>
      <World camera={cam} width={width} height={height}>
        <div style={{ position: "absolute", left: P.x, top: P.y, width: P.w, height: P.h, background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.lg, boxShadow: theme.shadow.lg, opacity: appear }}>
          <div style={{ padding: "26px 50px", fontSize: theme.type.body, fontWeight: theme.font.weights.semibold, color: theme.color.text }}>
            <GradientText>Resumen</GradientText>
          </div>
        </div>
        {v.stats.map(([label, value], i) => {
          const a = kf(f, [8 - lead + i * 6, 26 - lead + i * 6], [0, 1]);
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
          const a = kf(f, [30 - lead * 2 + i * 5, 48 - lead * 2 + i * 5], [0, 1]);
          return (
            <div key={r} style={{ position: "absolute", left: P.x + 50, top: P.y + rowsTop + i * 74, width: P.w - 100, height: 56, opacity: a, display: "flex", alignItems: "center", padding: "0 24px", boxSizing: "border-box", borderRadius: theme.radius.md, background: theme.color.bg, border: `1px solid ${theme.color.border}`, fontSize: theme.type.eyebrow, color: theme.color.text }}>
              {r}
              <span style={{ marginLeft: "auto", width: 80 + ((i * 53 + variant * 31) % 120), height: 14, borderRadius: theme.radius.pill, background: theme.color.chart[(i + variant) % theme.color.chart.length] }} />
            </div>
          );
        })}
        <Cursor keys={[[0, cursorHome.x, cursorHome.y], [30, cursorHome.x, cursorHome.y], [58, target.x + 90, target.y + 60]]} clicks={[60]} show={[26, 100]} />
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

export const storyDemo = defineStory({ id: "story-demo", spec, scenes, formats: ["vertical", "cuadrado"] });
export { scenes as demoScenes };
