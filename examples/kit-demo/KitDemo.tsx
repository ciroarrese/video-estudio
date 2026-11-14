import React from "react";
import { useFrame, useVideoConfig } from "../../engine";
import { ThemeProvider, borderWidth, cornerRadius, dark, editorial, entrance, neon, neutral, papel, staggerFrames, surfaceStyle, textStyle, useTheme } from "../../themes";
import type { Theme } from "../../themes";
import {
  CountUp, Cursor, DockedHeadline, DoodleArrow, DoodleCircle, DoodleUnderline, Eyebrow, FlyingCard,
  GradientText, Stage, Vignette, Wash, World, flyInZ, hideFromScale, kf, textWidth, typed, useCameraAt, zoomThrough,
} from "../../kit";
import type { CameraKey } from "../../kit";

/** Temas que la demo conoce por nombre (los tres últimos son design systems de ejemplo con `theme.style`). */
const TEMAS: Record<string, Theme> = { neutral, dark, editorial, neon, papel };
export const KIT_DEMO_THEMES = Object.keys(TEMAS);

/** `theme`: "neutral" | "dark" | "editorial" | "neon" | "papel" (por defecto neutral); también acepta un objeto Theme (para pruebas). */
export type KitDemoProps = { theme?: "neutral" | "dark" | "editorial" | "neon" | "papel" | Theme };

// Invented layout (world coordinates = pixels at scale 1).
const A = { x: 120, y: 190, w: 1100, h: 740 };
const B = { x: 1300, y: 190, w: 520, h: 740 };
const CARD = { w: 320, h: 210 };
const cardPos = (i: number) => ({ x: A.x + 40 + i * 350, y: A.y + 100 });
const cardCenter = (i: number) => ({ x: cardPos(i).x + CARD.w / 2, y: cardPos(i).y + CARD.h / 2 });
const LANDING = { x: B.x + B.w / 2, y: 670 };
const COUNTER = { x: B.x + B.w / 2, y: 420 };
const PICK = 1;

const STATS = [
  { label: "Nuevos", value: "128", delta: "+12%" },
  { label: "En curso", value: "42", delta: "-3%" },
  { label: "Cerrados", value: "87", delta: "+8%" },
];
const ROWS = ["Elemento alfa", "Elemento beta", "Elemento gamma", "Elemento delta", "Elemento epsilon"];

const T = { flight: [150, 190] as [number, number], through: [240, 299] as [number, number], wash: [278, 299] as [number, number] };

const KEYS: CameraKey[] = [
  { f: 0, x: 960, y: 540, scale: 1 },
  { f: 55, x: 960, y: 540, scale: 1 },
  { f: 90, x: cardCenter(PICK).x, y: 370, scale: 1.8 },
  { f: 135, x: cardCenter(PICK).x, y: 370, scale: 1.8 },
  { f: 165, x: 1100, y: 520, scale: 0.8 },
  { f: 200, x: COUNTER.x, y: 480, scale: 1.6 },
  { f: 300, x: COUNTER.x, y: 480, scale: 1.6 },
];

const CAMERA_OPTS = { map: (fr: number, c: { x: number; y: number; scale: number }) => zoomThrough(fr, T.through, c, COUNTER, 40), noBlurFrom: T.through[0] };

/**
 * Panel con título. La superficie (relleno, borde, sombra) es una capa propia, hermana del contenido: se atenúa con `dim` sin tocar el texto
 * (un texto al 45 % de opacidad queda bajo 3:1 con casi cualquier fondo; ver docs/guia-escenas.md, "Escenas que sobreviven a otro design system").
 * `fade` apaga el contenido (título y lo de adentro): el texto se funde del todo, no queda a medias. `titleMin` es el alto mínimo de la franja del título: el contenido en flujo empieza debajo, y si el título crece (otra tipografía) lo empuja.
 */
function Panel({ x, y, w, h, title, dim = 1, fade = 1, titleMin = 0, children }: { x: number; y: number; w: number; h: number; title: string; dim?: number; fade?: number; titleMin?: number; children?: React.ReactNode }) {
  const theme = useTheme();
  // Superficie del design system (esquinas, relleno, borde, sombra). Con el relleno sólido el panel va un escalón más claro (`surfaceAlt`) que las tarjetas.
  const s = surfaceStyle(theme, "window", { level: "lg" });
  const fill = s.background === theme.color.surface ? theme.color.surfaceAlt : s.background;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h }}>
      {/* `opacity` se emite siempre, como antes, para que el aspecto por defecto sea idéntico al píxel */}
      <div key={dim === 1 ? "surf-rest" : "surf-anim"} style={{ position: "absolute", inset: 0, background: fill, border: s.border, borderRadius: s.borderRadius, boxShadow: s.boxShadow, opacity: dim }} />
      <div key={fade >= 1 ? "body-rest" : "body-anim"} style={{ position: "relative", ...(fade >= 1 ? {} : { opacity: fade }) }}>
        <div style={{ position: "relative", minHeight: titleMin, boxSizing: "border-box", padding: "26px 40px 0", fontSize: theme.type.body, lineHeight: 1.2, ...textStyle(theme, "title"), color: theme.color.text }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ i, frame, selected }: { i: number; frame: number; selected?: boolean }) {
  const theme = useTheme();
  // El alto de la tarjeta es un mínimo (210): el contenido se apoya en el relleno de abajo (13 px) y, con otra tipografía, la tarjeta crece.
  const s = STATS[i]!;
  const col = theme.color.chart[i % theme.color.chart.length]!;
  // tarjeta de ficha: borde grueso (`bold`) y las esquinas de un panel
  const surf = surfaceStyle(theme, "card", { level: selected ? "lg" : "sm", bold: true, corner: "panel" });
  const w = borderWidth(theme, "card", { bold: true });
  const border = selected && w > 0 ? `${w}px solid ${theme.color.accent}` : surf.border;
  return (
    <div style={{ width: CARD.w, minHeight: CARD.h, boxSizing: "border-box", padding: "22px 28px 13px", background: surf.background, borderRadius: surf.borderRadius, border, boxShadow: surf.boxShadow }}>
      <Eyebrow style={{ display: "block", lineHeight: 1.2 }}>{s.label}</Eyebrow>
      <div style={{ fontSize: 84, lineHeight: 1.1, fontWeight: theme.font.weights.stat, color: theme.color.text }}>{s.value}</div>
      <div style={{ marginTop: 6, height: 10, borderRadius: cornerRadius(theme, "bar"), background: theme.color.surfaceAlt }}>
        <div style={{ width: `${kf(frame, [0, 60], [0, 40 + i * 20])}%`, height: "100%", borderRadius: cornerRadius(theme, "bar"), background: col }} />
      </div>
      <div style={{ marginTop: 8, fontSize: theme.type.eyebrow - 4, lineHeight: 1.2, color: s.delta.startsWith("+") ? theme.color.success : theme.color.danger }}>{s.delta}</div>
    </div>
  );
}

function Scene({ frame }: { frame: number }) {
  const theme = useTheme();
  const { width, height } = useVideoConfig();
  // Cámara con los valores por defecto del design system (desenfoque en el recorrido, ganancia de inclinación).
  const cam = useCameraAt(frame, KEYS, CAMERA_OPTS);
  const picked = frame >= 126; // after the click
  const left = frame >= T.flight[0];
  const pos = cardPos(PICK);
  const zoomIn = kf(cam.scale, [1.05, 1.45], [0, 1]) * kf(frame, [T.through[0], T.through[0] + 10], [1, 0]);
  const rowDots = [theme.color.success, theme.color.warning, theme.color.success, theme.color.danger, theme.color.success];
  const land = frame >= T.flight[1];
  // El contador entra en el panel con aire: el tamaño del tema, salvo que el número medido (con un 30 % de margen por si la letra real es más ancha o más grande)
  // no entre en el ancho útil del panel; en ese caso baja lo justo. Un número no se parte en dos líneas: si no entra, se sale del panel.
  const counterSize = Math.min(theme.type.stat, Math.floor((B.w - 60) / (textWidth(theme, "1.284", { size: 1, weight: "stat" }) * 1.3)));
  return (
    <Stage frame={frame}>
      <World camera={cam} width={width} height={height}>
        {/* Mientras vuela la tarjeta, la superficie del panel baja a 0,45 (foco en el vuelo; el texto sigue entero: ver `Panel`). Cuando la tarjeta aterriza, el sujeto pasa a ser el contador: el contenido del panel se apaga del todo
            antes de que la cámara llegue (cuadro 200), así ninguna tarjeta queda cortada por el borde con la cámara quieta. */}
        <Panel {...A} title="Panel de ejemplo" titleMin={100} dim={kf(frame, [148, 162], [1, 0.45])} fade={kf(frame, [176, 198], [1, 0])}>
          {/* Todo el contenido va en flujo bajo la franja del título (mínimo 100 px): las tarjetas (alto mínimo 210), 50 px de aire y las filas.
              Con la tipografía de siempre cae donde estaba (tarjetas en y = 100, filas en y = 360); con otra, lo de abajo baja en vez de pisarse. */}
          <div style={{ paddingLeft: 40, width: A.w - 40, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 50 }}>
            <div style={{ display: "flex", gap: 30, alignItems: "flex-start" }}>
              {[0, 1, 2].map((i) => {
                const d = staggerFrames(theme, i, { base: 6, context: "items" });
                const a = kf(frame, [d - 14, d + 18], [0, 1]);
                const hidden = i === PICK && left;
                // Entrada en profundidad: perspective() propio de cada tarjeta, layout entero (ver docs/reglas.md).
                const z = flyInZ(a, { from: 800, x: (i - 1) * 140, y: 60 });
                const en = Object.keys(z).length > 0;
                // Sin entrada en curso no hay estilo: `key` distinto para que el marcado no dependa de si antes lo hubo (un `style=""` que queda es una diferencia para `--check`).
                return (
                  <div key={`${i}-${en ? "anim" : "rest"}`} style={en ? z : undefined}>
                    {hidden ? (
                      <div style={{ width: CARD.w, minHeight: CARD.h, boxSizing: "border-box", borderRadius: cornerRadius(theme, "panel"), border: `2px dashed ${theme.color.border}` }} />
                    ) : (
                      <StatCard i={i} frame={frame} selected={i === PICK && picked} />
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ width: A.w - 80, display: "flex", flexDirection: "column", gap: 12 }}>
            {ROWS.map((r, i) => {
              const d = staggerFrames(theme, i, { base: 5, context: "rows" });
              const a = kf(frame, [d - 10, d + 10], [0, 1]);
              const row = surfaceStyle(theme, "card", { level: "sm" });
              // El borde (más grueso o ausente) no cambia la caja: el relleno de la fila lo compensa.
              const bd = borderWidth(theme, "card") - 1;
              const ent = entrance(theme, a, i, { native: "fade" });
              // `key` según las propiedades de la entrada: si aparecen o desaparecen, React las agregaría al final y el marcado dependería del historial.
              return (
                <div key={`${r}-${Object.keys(ent).join("-")}`} style={{ minHeight: 52, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 18, padding: `0 ${24 - bd}px`, background: row.background, border: row.border, borderRadius: cornerRadius(theme, "control"), ...ent, fontSize: theme.type.caption, lineHeight: 1.2, color: theme.color.text }}>
                  <span style={{ width: 16, height: 16, borderRadius: cornerRadius(theme, "bar"), background: rowDots[i] }} />
                  {r}
                  <span style={{ marginLeft: "auto", color: theme.color.textMuted, fontSize: theme.type.ui.md }}>{(i + 1) * 7} min</span>
                </div>
              );
            })}
            </div>
          </div>
        </Panel>

        <Panel {...B} title="Destino" titleMin={110}>
          {/* En flujo bajo la franja del título (mínimo 110 px): si el título crece, empuja al contador en vez de pisarlo. */}
          <div style={{ textAlign: "center" }}>
            <Eyebrow style={{ display: "block", lineHeight: 1.2, fontWeight: theme.font.weights.regular }}>{typed("Total acumulado", frame, 8, 0.7)}</Eyebrow>
            <GradientText frame={frame} loop={120} style={{ fontSize: counterSize, fontWeight: theme.font.weights.stat, lineHeight: 1.1 }}>
              <CountUp frame={frame} from={0} to={1284} start={land ? T.flight[1] + 2 : 9999} duration={40} />
            </GradientText>
          </div>
        </Panel>

        {frame >= T.flight[0] && frame < T.through[0] + 16 && (
          <div style={{ opacity: kf(frame, [T.through[0], T.through[0] + 14], [1, 0]) }}>
          <FlyingCard frame={frame} range={T.flight} from={cardCenter(PICK)} to={LANDING} arc={110} width={CARD.w} height={CARD.h}>
            <StatCard i={PICK} frame={frame} selected />
          </FlyingCard>
          </div>
        )}

        <DoodleCircle frame={frame} start={96} end={140} id="kd-circle" cx={pos.x + 110} cy={pos.y + 112} rx={130} ry={46} />
        <DoodleArrow frame={frame} start={152} end={196} id="kd-arrow" x1={pos.x + CARD.w - 40} y1={pos.y - 24} x2={B.x - 20} y2={LANDING.y - 70} bend={0.3} />
        <DoodleUnderline frame={frame} start={200} end={250} id="kd-under" x={COUNTER.x - 150} y={COUNTER.y + 100} length={300} />
        <Cursor frame={frame} show={[74, 146]} keys={[[74, 1000, 800], [122, cardCenter(PICK).x + 40, cardCenter(PICK).y + 40], [146, cardCenter(PICK).x + 80, cardCenter(PICK).y + 90]]} clicks={[124]} />
      </World>
      <Vignette amount={zoomIn} />
      <DockedHeadline index={1} title="Panel de ejemplo" subtitle={typed("Vista general", frame, 18, 0.8) /* se escribe cuando la píldora ya terminó de entrar (18 cuadros): un texto que se escribe con su contenedor en fundido da falsos avisos de contraste */} frame={frame} start={0} hide={hideFromScale(cam.scale)} />
      <Wash frame={frame} range={T.wash} />
    </Stage>
  );
}

/** Demo genérica del kit: cámara, cursor, garabatos, vuelo, cuenta y atravesado final. */
export function KitDemo({ theme = "neutral" }: KitDemoProps) {
  const frame = useFrame();
  return (
    <ThemeProvider theme={typeof theme === "object" ? theme : TEMAS[theme] ?? neutral}>
      <Scene frame={frame} />
    </ThemeProvider>
  );
}

