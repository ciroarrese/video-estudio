import React from "react";
import { useFrame, useVideoConfig } from "../../engine";
import { ThemeProvider, borderWidth, cornerRadius, dark, editorial, entrance, neon, neutral, papel, staggerFrames, surfaceStyle, textStyle, useTheme } from "../../themes";
import type { Theme } from "../../themes";
import {
  CountUp, Cursor, DockedHeadline, DoodleArrow, DoodleCircle, DoodleUnderline, Eyebrow, FlyingCard,
  GradientText, Stage, Vignette, Wash, World, flyInZ, hideFromScale, kf, typed, useCameraAt, zoomThrough,
} from "../../kit";
import type { CameraKey } from "../../kit";

/** Temas que la demo conoce por nombre (los tres últimos son design systems de ejemplo con `theme.style`). */
const TEMAS: Record<string, Theme> = { neutral, dark, editorial, neon, papel };
export const KIT_DEMO_THEMES = Object.keys(TEMAS);

/** `theme`: "neutral" | "dark" | "editorial" | "neon" | "papel" (por defecto neutral); también acepta un objeto Theme (para pruebas). */
export type KitDemoProps = { theme?: "neutral" | "dark" | "editorial" | "neon" | "papel" | Theme };

/** Engrosa o quita el borde de una superficie (`"1px solid c"`) sumando `extra` px: las tarjetas de la demo llevan 1 px más que el borde base. */
const thicken = (border: unknown, extra: number): string | undefined => {
  if (typeof border !== "string") return undefined;
  const m = /^([\d.]+)px (.*)$/.exec(border);
  return m ? `${+(+m[1]! + extra).toFixed(2)}px ${m[2]}` : border;
};

// Invented layout (world coordinates = pixels at scale 1).
const A = { x: 120, y: 190, w: 1100, h: 740 };
const B = { x: 1300, y: 190, w: 520, h: 740 };
const CARD = { w: 320, h: 210 };
const cardPos = (i: number) => ({ x: A.x + 40 + i * 350, y: A.y + 100 });
const cardCenter = (i: number) => ({ x: cardPos(i).x + CARD.w / 2, y: cardPos(i).y + CARD.h / 2 });
const LANDING = { x: B.x + B.w / 2, y: 690 };
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

function Panel({ x, y, w, h, title, opacity = 1, children }: { x: number; y: number; w: number; h: number; title: string; opacity?: number; children?: React.ReactNode }) {
  const theme = useTheme();
  // Superficie del design system (esquinas, relleno, borde, sombra). Con el relleno sólido el panel va un escalón más claro (`surfaceAlt`) que las tarjetas.
  const s = surfaceStyle(theme, "panel", { level: "lg" });
  const fill = s.background === theme.color.surface ? theme.color.surfaceAlt : s.background;
  return (
    <div key={opacity === 1 ? "rest" : "anim"} data-qa-ignore={opacity === 1 ? undefined : "contrast"} /* el panel se atenúa a propósito mientras vuela la tarjeta: es un foco, no texto para leer */ style={{ position: "absolute", left: x, top: y, width: w, height: h, background: fill, border: s.border, borderRadius: s.borderRadius, boxShadow: s.boxShadow, opacity: opacity === 1 ? undefined : opacity }}>
      <div style={{ padding: "26px 40px", fontSize: theme.type.body, ...textStyle(theme, "title"), color: theme.color.text }}>{title}</div>
      {children}
    </div>
  );
}

function StatCard({ i, frame, selected }: { i: number; frame: number; selected?: boolean }) {
  const theme = useTheme();
  const s = STATS[i]!;
  const col = theme.color.chart[i % theme.color.chart.length]!;
  const surf = surfaceStyle(theme, "card", { level: selected ? "lg" : "sm" });
  const w = borderWidth(theme, "card");
  const border = selected && w > 0 ? `${w + 1}px solid ${theme.color.accent}` : thicken(surf.border, 1);
  return (
    <div style={{ width: CARD.w, height: CARD.h, boxSizing: "border-box", padding: "22px 28px", background: surf.background, borderRadius: Math.min(theme.radius.panel, cornerRadius(theme, "card")), border, boxShadow: surf.boxShadow }}>
      <Eyebrow style={{ display: "block" }}>{s.label}</Eyebrow>
      <div style={{ fontSize: 84, lineHeight: 1.1, fontWeight: theme.font.weights.stat, color: theme.color.text }}>{s.value}</div>
      <div style={{ marginTop: 6, height: 10, borderRadius: cornerRadius(theme, "bar"), background: theme.color.surfaceAlt }}>
        <div style={{ width: `${kf(frame, [0, 60], [0, 40 + i * 20])}%`, height: "100%", borderRadius: cornerRadius(theme, "bar"), background: col }} />
      </div>
      <div style={{ marginTop: 8, fontSize: theme.type.eyebrow - 4, color: s.delta.startsWith("+") ? theme.color.success : theme.color.danger }}>{s.delta}</div>
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
  return (
    <Stage frame={frame}>
      <World camera={cam} width={width} height={height}>
        {/* El panel vuelve a opacidad plena antes de que la cámara termine de acercarse al contador: así sus textos (ya fuera de cuadro) no entran en fundido recortados con la cámara quieta. */}
        <Panel {...A} title="Panel de ejemplo" opacity={kf(frame, [148, 162, 180, 194], [1, 0.45, 0.45, 1])}>
          {[0, 1, 2].map((i) => {
            const p = cardPos(i);
            const d = staggerFrames(theme, i, { base: 6 });
            const a = kf(frame, [d - 14, d + 18], [0, 1]);
            const hidden = i === PICK && left;
            // Entrada en profundidad: perspective() propio de cada tarjeta, layout entero (ver docs/reglas.md).
            return (
              <div key={i} style={{ position: "absolute", left: p.x - A.x, top: p.y - A.y, ...flyInZ(a, { from: 800, x: (i - 1) * 140, y: 60 }) }}>
                {hidden ? (
                  <div style={{ width: CARD.w, height: CARD.h, boxSizing: "border-box", borderRadius: theme.radius.panel, border: `2px dashed ${theme.color.border}` }} />
                ) : (
                  <StatCard i={i} frame={frame} selected={i === PICK && picked} />
                )}
              </div>
            );
          })}
          {ROWS.map((r, i) => {
            const d = staggerFrames(theme, i, { base: 5 });
            const a = kf(frame, [d - 10, d + 10], [0, 1]);
            const row = surfaceStyle(theme, "card", { level: "sm" });
            // El borde (más grueso o ausente) no cambia la caja: el relleno de la fila lo compensa.
            const bd = borderWidth(theme, "card") - 1;
            const ent = entrance(theme, a, i, { native: "fade" });
            // `key` según las propiedades de la entrada: si aparecen o desaparecen, React las agregaría al final y el marcado dependería del historial.
            return (
              <div key={`${r}-${Object.keys(ent).join("-")}`} style={{ position: "absolute", left: 40, top: 360 + i * 64, width: A.w - 80, height: 52, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 18, padding: `0 ${24 - bd}px`, background: row.background, border: row.border, borderRadius: cornerRadius(theme, "control"), ...ent, fontSize: theme.type.caption, color: theme.color.text }}>
                <span style={{ width: 16, height: 16, borderRadius: cornerRadius(theme, "bar"), background: rowDots[i] }} />
                {r}
                <span style={{ marginLeft: "auto", color: theme.color.textMuted, fontSize: theme.type.ui.md }}>{(i + 1) * 7} min</span>
              </div>
            );
          })}
        </Panel>

        <Panel {...B} title="Destino">
          <div style={{ position: "absolute", left: 0, top: 110, width: B.w, textAlign: "center" }}>
            <Eyebrow style={{ display: "block", fontWeight: theme.font.weights.regular }}>{typed("Total acumulado", frame, 8, 0.7)}</Eyebrow>
            <GradientText frame={frame} loop={120} style={{ fontSize: theme.type.stat, fontWeight: theme.font.weights.stat, lineHeight: 1.1 }}>
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
      <DockedHeadline index={1} title="Panel de ejemplo" subtitle={typed("Vista general", frame, 6, 0.8)} frame={frame} start={0} hide={hideFromScale(cam.scale)} />
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

