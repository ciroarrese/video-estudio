import { Easing, useFrame, useVideoConfig } from "../engine";
import { Stage, Wash, World, cameraAt, kf, zoomThrough } from "../kit";
import { useTheme, withAlpha } from "../themes";
import { fitText, listLayout, openingWall, rigTransform } from "./layout";
import { Chip, HeadlineRow, HighlightedTitle, scaler, useEase } from "./shared";
import type { StorySpec } from "./types";

export const OPENING_FRAMES = 300;
export const openingFrames = (spec: StorySpec) => spec.timing?.opening ?? OPENING_FRAMES;

const WALL_P = 1400;

/**
 * Apertura: el título se lee desde el primer cuadro sobre un muro de etiquetas en profundidad (cada pieza con su
 * perspectiva, inclinación y desenfoque por distancia, con un avance lento de cámara); el muro se enciende de a una.
 * A los ~2.5 s el título se va, entra la lista numerada (lo más grande de la pantalla) y se atraviesa el primer titular.
 */
export function Opening({ spec }: { spec: StorySpec }) {
  const theme = useTheme();
  const ease = useEase();
  const f = useFrame();
  const { width, height } = useVideoConfig();
  const dur = openingFrames(spec);
  const u = scaler(dur, OPENING_FRAMES);
  const n = spec.topics.length;
  const L = listLayout(spec, theme, width, height);
  const wall = openingWall(spec);
  const cx = width / 2, cy = height / 2;

  const gap = Math.min(16, 64 / n) * (dur / OPENING_FRAMES);
  const T = { titleOut: [u(78), u(100)] as [number, number], wallOff: [u(94), u(126)] as [number, number], heads: u(104), fly: [u(236), u(282)] as [number, number] };
  const underStart = T.heads + (n - 1) * gap + u(20);

  // muro: avance lento de cámara con inclinación; al irse la lista se aleja
  const dolly = kf(f, [0, u(130)], [0, 240], Easing.linear);
  const ry = kf(f, [0, u(130)], [-11, 6], Easing.linear);
  const rx = kf(f, [0, u(130)], [7, -3], Easing.linear);
  const wallFade = kf(f, T.wallOff, [1, 0.05]);
  const wallBack = kf(f, [T.wallOff[0], T.wallOff[1] + u(20)], [0, -900]);
  const rig = { dz: dolly + wallBack, rx, ry };

  // título: legible desde el cuadro 0 (solo se asienta con una escala corta)
  const titleIn = kf(f, [0, u(16)], [0, 1], ease.out);
  const titleOut = kf(f, T.titleOut, [0, 1]);
  const tf = fitText(spec.title.text, 1560, theme.type.hero, { min: theme.type.hero * 0.5, lines: 2, avg: 0.55 });

  // atravesado del primer titular
  const cam = cameraAt(f, [{ f: 0, x: cx, y: cy, scale: 1 }], {
    map: (fr, c) => zoomThrough(fr, T.fly, c, L.target(0), 60),
    noBlurFrom: T.fly[0],
  });
  const othersOut = kf(f, [T.fly[0] - u(6), T.fly[0] + u(14)], [1, 0]);

  return (
    <Stage frame={f}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: wallFade }}>
        {wall.map((c, i) => {
          const lit = kf(f, [u(c.on), u(c.on) + 3], [0, 1], Easing.linear);
          const pop = kf(f, [u(c.on), u(c.on) + 5, u(c.on) + 22], [0, 1, 0]);
          const appear = kf(f, [u(i * 0.5), u(10 + i * 0.5)], [0.5, 1], ease.out);
          const blur = Math.round(Math.min(2.5, Math.max(0, (60 - (c.z + rig.dz)) / 160)) * 10) / 10;
          return (
            <div
              key={i}
              data-qa-ignore="min-size contrast overlap covered offscreen safe-area"
              style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: rigTransform(c.x, c.y, c.z, rig, WALL_P, cx, cy, " translate(-50%, -50%)"), zIndex: 1000 + c.z, opacity: appear, filter: blur > 0 ? `blur(${blur}px)` : undefined }}
            >
              <Chip text={c.text} lit={lit} pop={pop} />
            </div>
          );
        })}
      </div>

      {titleOut < 1 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 3 }}>
          <div
            style={{
              maxWidth: 1700,
              padding: `${Math.round(tf.size * 0.3)}px ${Math.round(tf.size * 0.55)}px`,
              borderRadius: theme.radius.lg * 2,
              background: theme.color.surface,
              boxShadow: `0 40px 90px -30px ${withAlpha(theme.color.text, 0.35)}, ${theme.shadow.lg}`,
              opacity: 1 - titleOut,
              transform: `translateY(${Math.round(-titleOut * 120)}px) scale(${(0.95 + titleIn * 0.05 - titleOut * 0.1).toFixed(4)})`,
              textAlign: "center",
              fontSize: tf.size,
              fontWeight: theme.font.weights.semibold,
              color: theme.color.text,
              letterSpacing: "-0.03em",
              lineHeight: 1.08,
            }}
          >
            <HighlightedTitle text={tf.text} highlight={spec.title.highlight} />
          </div>
        </div>
      )}

      <World camera={cam} width={width} height={height}>
        {spec.topics.map((_, i) => {
          const s = T.heads + i * gap;
          const a = kf(f, [s, s + u(24)], [1e-6, 1], ease.out);
          const first = i === 0;
          const opacity = first ? kf(f, [T.fly[1] - u(6), T.fly[1]], [1, 0]) : othersOut;
          if (f < s) return null;
          return (
            <HeadlineRow
              key={i}
              i={i}
              L={L}
              opacity={a * opacity}
              underline={first ? kf(f, [underStart, underStart + u(28)], [0, 1], ease.out) : 0}
              style={{ transform: `translateX(${Math.round((1 - a) * 80)}px)`, filter: a < 0.98 ? `blur(${((1 - a) * 8).toFixed(1)}px)` : undefined }}
            />
          );
        })}
      </World>

      <Wash range={[T.fly[1] - u(16), T.fly[1] - u(2)]} />
    </Stage>
  );
}
