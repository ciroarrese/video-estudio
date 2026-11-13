import { Easing, useFrame, useVideoConfig } from "../engine";
import { Stage, Wash, World, cameraAt, kf, zoomThrough } from "../kit";
import { useTheme, withAlpha } from "../themes";
import { fitText, listLayout, openingWall } from "./layout";
import { Chip, HeadlineRow, HighlightedTitle, scaler, useEase } from "./shared";
import type { StorySpec } from "./types";

export const OPENING_FRAMES = 300;
export const openingFrames = (spec: StorySpec) => spec.timing?.opening ?? OPENING_FRAMES;

/**
 * Apertura: muro de etiquetas en profundidad que se enciende de a una, el título,
 * la lista numerada de temas con subrayado de marca y el atravesado del primer titular.
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

  const T = { title: 0, wallOff: [u(104), u(132)] as [number, number], heads: u(112), gap: Math.min(20, 96 / n) * (dur / OPENING_FRAMES), fly: [u(238), u(284)] as [number, number] };

  // muro: avance lento de cámara con inclinación
  const dolly = kf(f, [0, u(130)], [0, 260], Easing.linear);
  const ry = kf(f, [0, u(130)], [-10, 6], Easing.linear);
  const rx = kf(f, [0, u(130)], [6, -3], Easing.linear);
  const wallFade = kf(f, [T.wallOff[0], T.wallOff[1]], [1, 0.05]);
  const wallBack = kf(f, [T.wallOff[0], T.wallOff[1] + u(20)], [0, -900]);

  // título
  // el título se lee desde el primer cuadro y se queda ~3.5 s sobre el muro antes de dar paso a la lista
  const titleIn = kf(f, [T.title, T.title + u(18)], [0, 1], ease.out);
  const titleOut = kf(f, [u(100), u(124)], [0, 1]);
  const tf = fitText(spec.title.text, 1500, theme.type.hero, { min: theme.type.hero * 0.5, lines: 2, avg: 0.55 });

  // atravesado del primer titular
  const cam = cameraAt(f, [{ f: 0, x: width / 2, y: height / 2, scale: 1 }], {
    map: (fr, c) => zoomThrough(fr, T.fly, c, L.target(0), 60),
    noBlurFrom: T.fly[0],
  });
  const othersOut = kf(f, [T.fly[0] - u(6), T.fly[0] + u(14)], [1, 0]);

  return (
    <Stage frame={f}>
      <div style={{ position: "absolute", inset: 0, perspective: 1400, opacity: wallFade }}>
        <div style={{ position: "absolute", left: width / 2, top: height / 2, transformStyle: "preserve-3d", transform: `translateZ(${dolly + wallBack}px) rotateX(${rx}deg) rotateY(${ry}deg)` }}>
          {wall.map((c, i) => {
            const lit = kf(f, [u(c.on), u(c.on) + 3], [0, 1], Easing.linear);
            const pop = kf(f, [u(c.on), u(c.on) + 5, u(c.on) + 22], [0, 1, 0]);
            const appear = kf(f, [u(i * 0.5), u(10 + i * 0.5)], [0.45, 1], ease.out);
            return (
              <div key={i} data-qa-ignore="min-size contrast" style={{ position: "absolute", left: 0, top: 0, transform: `translate(-50%, -50%) translate3d(${c.x}px, ${c.y}px, ${c.z}px)`, opacity: appear }}>
                <Chip text={c.text} lit={lit} pop={pop} />
              </div>
            );
          })}
        </div>
      </div>

      {titleOut < 1 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div
            style={{
              maxWidth: 1560,
              padding: `${tf.size * 0.28}px ${tf.size * 0.5}px`,
              borderRadius: theme.radius.lg * 2,
              background: withAlpha(theme.color.bg, 0.9),
              boxShadow: `0 30px 80px -30px ${withAlpha(theme.color.text, 0.3)}, ${theme.shadow.lg}`,
              opacity: (0.8 + 0.2 * titleIn) * (1 - titleOut),
              transform: `translateY(${(1 - titleIn) * 24 - titleOut * 120}px) scale(${0.96 + titleIn * 0.04 - titleOut * 0.1})`,
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
          const s = T.heads + i * T.gap;
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
              underline={kf(f, [s + u(10), s + u(40)], [0, 1], ease.out)}
              style={{ transform: `translateX(${(1 - a) * 80}px)`, filter: a < 1 ? `blur(${(1 - a) * 8}px)` : undefined }}
            />
          );
        })}
      </World>

      <Wash range={[T.fly[1] - u(16), T.fly[1] - u(2)]} />
    </Stage>
  );
}
