import React from "react";
import { useFrame, useVideoConfig } from "../../engine";
import { ThemeProvider, dark, neutral, useTheme } from "../../themes";
import type { Theme } from "../../themes";
import {
  CloudBackground, CountUp, Cursor, DockedHeadline, DoodleArrow, DoodleCircle, DoodleUnderline, FlyingCard,
  GradientText, Stage, Vignette, Wash, World, cameraAt, hideFromScale, kf, typed, zoomThrough,
} from "../../kit";
import type { CameraKey } from "../../kit";

/** `theme`: "neutral" | "dark" (por defecto neutral); también acepta un objeto Theme (para pruebas). */
export type KitDemoProps = { theme?: "neutral" | "dark" | Theme };

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
  { f: 90, x: cardCenter(PICK).x, y: cardCenter(PICK).y, scale: 1.9 },
  { f: 135, x: cardCenter(PICK).x, y: cardCenter(PICK).y, scale: 1.9 },
  { f: 165, x: 1100, y: 520, scale: 0.8 },
  { f: 200, x: COUNTER.x, y: 480, scale: 1.6 },
  { f: 300, x: COUNTER.x, y: 480, scale: 1.6 },
];

const camera = (f: number) =>
  cameraAt(f, KEYS, { map: (fr, c) => zoomThrough(fr, T.through, c, COUNTER, 40), noBlurFrom: T.through[0] });

function Panel({ x, y, w, h, title, children }: { x: number; y: number; w: number; h: number; title: string; children?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, background: theme.color.surfaceAlt, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.lg, boxShadow: theme.shadow.lg }}>
      <div style={{ padding: "26px 40px", fontSize: theme.type.body, fontWeight: theme.font.weights.semibold, color: theme.color.text }}>{title}</div>
      {children}
    </div>
  );
}

function StatCard({ i, frame, selected }: { i: number; frame: number; selected?: boolean }) {
  const theme = useTheme();
  const s = STATS[i]!;
  const col = theme.color.chart[i % theme.color.chart.length]!;
  return (
    <div style={{ width: CARD.w, height: CARD.h, boxSizing: "border-box", padding: "22px 28px", background: theme.color.surface, borderRadius: theme.radius.panel, border: `2px solid ${selected ? theme.color.accent : theme.color.border}`, boxShadow: selected ? theme.shadow.lg : theme.shadow.sm }}>
      <div style={{ fontSize: theme.type.eyebrow, color: theme.color.textMuted, fontWeight: theme.font.weights.medium }}>{s.label}</div>
      <div style={{ fontSize: 84, lineHeight: 1.1, fontWeight: theme.font.weights.stat, color: theme.color.text }}>{s.value}</div>
      <div style={{ marginTop: 6, height: 10, borderRadius: theme.radius.pill, background: theme.color.surfaceAlt }}>
        <div style={{ width: `${kf(frame, [0, 60], [0, 40 + i * 20])}%`, height: "100%", borderRadius: theme.radius.pill, background: col }} />
      </div>
      <div style={{ marginTop: 8, fontSize: theme.type.eyebrow - 4, color: s.delta.startsWith("+") ? theme.color.success : theme.color.danger }}>{s.delta}</div>
    </div>
  );
}

function Scene({ frame }: { frame: number }) {
  const theme = useTheme();
  const { width, height } = useVideoConfig();
  const cam = camera(frame);
  const picked = frame >= 126; // after the click
  const left = frame >= T.flight[0];
  const pos = cardPos(PICK);
  const zoomIn = kf(cam.scale, [1.05, 1.45], [0, 1]) * kf(frame, [T.through[0], T.through[0] + 10], [1, 0]);
  const rowDots = [theme.color.success, theme.color.warning, theme.color.success, theme.color.danger, theme.color.success];
  const land = frame >= T.flight[1];
  return (
    <Stage clouds={false}>
      <CloudBackground frame={frame} />
      <World camera={cam} width={width} height={height}>
        <Panel {...A} title="Panel de ejemplo">
          {[0, 1, 2].map((i) => {
            const p = cardPos(i);
            const a = kf(frame, [i * 6 - 14, i * 6 + 8], [0, 1]);
            const hidden = i === PICK && left;
            return (
              <div key={i} style={{ position: "absolute", left: p.x - A.x, top: p.y - A.y + (1 - a) * 24, opacity: a }}>
                {hidden ? (
                  <div style={{ width: CARD.w, height: CARD.h, boxSizing: "border-box", borderRadius: theme.radius.panel, border: `2px dashed ${theme.color.border}` }} />
                ) : (
                  <StatCard i={i} frame={frame} selected={i === PICK && picked} />
                )}
              </div>
            );
          })}
          {ROWS.map((r, i) => {
            const a = kf(frame, [i * 5 - 10, i * 5 + 10], [0, 1]);
            return (
              <div key={r} style={{ position: "absolute", left: 40, top: 360 + i * 64, width: A.w - 80, height: 52, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 18, padding: "0 24px", background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, opacity: a, fontSize: theme.type.caption, color: theme.color.text }}>
                <span style={{ width: 16, height: 16, borderRadius: theme.radius.pill, background: rowDots[i] }} />
                {r}
                <span style={{ marginLeft: "auto", color: theme.color.textMuted, fontSize: theme.type.eyebrow }}>{(i + 1) * 7} min</span>
              </div>
            );
          })}
        </Panel>

        <Panel {...B} title="Destino">
          <div style={{ position: "absolute", left: 0, top: 110, width: B.w, textAlign: "center" }}>
            <div style={{ fontSize: theme.type.eyebrow, color: theme.color.textMuted }}>{typed("Total acumulado", frame, 8, 0.7)}</div>
            <GradientText frame={frame} pan={0.5} style={{ fontSize: theme.type.stat, fontWeight: theme.font.weights.stat, lineHeight: 1.1 }}>
              <CountUp frame={frame} from={0} to={1284} start={land ? T.flight[1] + 2 : 9999} duration={40} />
            </GradientText>
          </div>
        </Panel>

        {frame >= T.flight[0] && (
          <FlyingCard frame={frame} range={T.flight} from={cardCenter(PICK)} to={LANDING} arc={-150} width={CARD.w} height={CARD.h}>
            <StatCard i={PICK} frame={frame} selected />
          </FlyingCard>
        )}

        <DoodleCircle frame={frame} start={96} end={140} id="kd-circle" cx={pos.x + 110} cy={pos.y + 112} rx={130} ry={46} />
        <DoodleArrow frame={frame} start={152} end={196} id="kd-arrow" x1={pos.x + CARD.w - 40} y1={pos.y - 24} x2={B.x - 20} y2={LANDING.y - 70} bend={-0.3} />
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
    <ThemeProvider theme={typeof theme === "object" ? theme : theme === "dark" ? dark : neutral}>
      <Scene frame={frame} />
    </ThemeProvider>
  );
}

