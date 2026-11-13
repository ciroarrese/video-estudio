import { Easing, random, useFrame, useVideoConfig } from "../engine";
import { GradientText, Stage, kf } from "../kit";
import { useTheme, withAlpha } from "../themes";
import { closingWall, fitText, panelLayout, rigProject, rigTransform } from "./layout";
import { Chip, Logo, Pill, scaler, useEase } from "./shared";
import type { StorySpec, TopicScene } from "./types";

export const CLOSING_FRAMES = 480;
export const closingFrames = (spec: StorySpec) => spec.timing?.closing ?? CLOSING_FRAMES;

const PANEL = { w: 560, h: 340 };
const WALL_P = 1600;
const CARD_P = 2200;

/** Tarjeta por defecto del cierre cuando una escena no trae `thumbnail`: nombre del tema y barras de ejemplo. */
export function DefaultThumbnail({ index, name }: { index: number; name: string }) {
  const theme = useTheme();
  const t = fitText(name, PANEL.w - 80, 28, { min: 22 });
  return (
    <div style={{ width: PANEL.w, height: PANEL.h, borderRadius: theme.radius.lg, background: theme.color.surface, border: `1px solid ${theme.color.border}`, boxShadow: theme.shadow.lg, overflow: "hidden", position: "relative" }}>
      <div style={{ height: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 24px", borderBottom: `1px solid ${theme.color.border}`, background: theme.color.surfaceAlt }}>
        <span style={{ width: 14, height: 14, borderRadius: theme.radius.pill, background: theme.color.accent }} />
        <span style={{ fontSize: t.size, fontWeight: theme.font.weights.semibold, color: theme.color.text, whiteSpace: "nowrap" }}>{t.text}</span>
      </div>
      <div style={{ position: "absolute", left: 28, right: 28, bottom: 30, top: 84, display: "flex", alignItems: "flex-end", gap: 18 }}>
        {[0, 1, 2, 3, 4].map((k) => (
          <div key={k} style={{ flex: 1, height: `${30 + random(`thumb-${index}-${k}`) * 70}%`, borderRadius: theme.radius.sm, background: theme.color.chart[(index + k) % theme.color.chart.length]!, opacity: 0.85 }} />
        ))}
      </div>
    </div>
  );
}

const WALL_PILL = 1.5;
const PILL_OFF = -50; // la píldora de cada panel va sobre su borde superior (centro, en px del panel)

/** Valor que sigue entre dos puntos. */
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/**
 * Cierre: paneles flotantes (grandes, con inclinación, sombra y profundidad) con el título de cada tema sobre su
 * borde; detrás, el muro de etiquetas desenfocado. Los paneles se pliegan, los títulos viajan en profundidad (cambian
 * de escala) hasta sus lugares reservados en el centro del muro, que entra en foco, se enciende y se aleja hasta
 * mostrar todo; después, fundido a la firma.
 */
export function Closing({ spec, scenes }: { spec: StorySpec; scenes: TopicScene[] }) {
  const theme = useTheme();
  const ease = useEase();
  const f = useFrame();
  const { width, height } = useVideoConfig();
  const dur = closingFrames(spec);
  const u = scaler(dur, CLOSING_FRAMES);
  const n = spec.topics.length;
  const cx = width / 2, cy = height / 2;
  const { inner, outer, slots } = closingWall(spec);
  const panels = panelLayout(n);
  const stagger = Math.min(6, 30 / n);
  const T = { wall: u(130), fold: [u(170), u(200)] as [number, number], fly: [u(200), u(254)] as [number, number], light: u(262), pull: u(372), wash: [u(368), u(398)] as [number, number], logo: u(394), sign: u(418) };

  const cam = {
    s: kf(f, [0, u(150), u(260)], [1.1, 0.99, 0.95], Easing.inOut),
    ry: kf(f, [0, u(260)], [-12, 7]),
    rx: kf(f, [0, u(260)], [8, 2]),
  };
  const wallCam = {
    dz: kf(f, [0, T.fly[0], T.fly[1] + u(30), T.pull], [-440, -440, -480, -960], Easing.inOut),
    rx: 0,
    ry: kf(f, [0, T.pull], [-6, 3]),
  };
  const wallIn = kf(f, [T.wall - u(20), T.wall + u(10)], [0, 1], ease.out);
  const focus = kf(f, [T.fly[0], T.fly[1] + u(40)], [0, 1]);
  const fold = kf(f, T.fold, [0, 1], Easing.inOut);
  const wash = kf(f, T.wash, [0, 1], Easing.linear);
  const logo = kf(f, [T.logo, T.logo + u(26)], [0, 1], ease.out);
  const sign = kf(f, [T.sign, T.sign + u(22)], [0, 1], ease.out);
  const flyStart = (i: number) => T.fly[0] + u(i * stagger);
  const flyOf = (i: number) => kf(f, [flyStart(i), flyStart(i) + u(40)], [0, 1], Easing.inOut);
  const bobOf = (i: number) => Math.sin(f / 28 + i * 1.7) * 10;
  const blur = Math.round((1 - focus) * 90) / 10;

  const ignore = "min-size contrast overlap covered offscreen safe-area";
  const chipFor = (c: { x: number; y: number; text: string }, i: number, faint: boolean) => {
    const on = faint ? T.light + u(10) + random(`o${i}`) * u(50) : Math.min(T.wall + random(`con${i}`) * u(70), T.light + random(`l2${i}`) * u(30));
    const lit = f >= on ? 1 : 0;
    const pop = faint ? 0 : kf(f, [on, on + u(5), on + u(20)], [0, 1, 0]);
    return (
      <div
        key={`${faint ? "o" : "i"}${i}`}
        data-qa-ignore={ignore}
        style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: rigTransform(c.x, c.y, 0, wallCam, WALL_P, cx, cy, " scale(1.1) translate(-50%, -50%)"), opacity: faint ? 0.6 : 1 }}
      >
        <Chip text={c.text} lit={lit} pop={pop} faint={faint} />
      </div>
    );
  };

  const signLines = spec.signoff;
  const sf = fitText(signLines.text, 1560, theme.type.h2, { min: theme.type.body, lines: 2, avg: 0.55 });
  const tagline = signLines.tagline ? fitText(signLines.tagline, 1500, theme.type.body, { min: theme.type.caption, avg: 0.5, lines: 2 }) : null;

  return (
    <Stage frame={f}>
      {/* muro: desenfocado hasta que llegan las píldoras */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: wallIn * (0.55 + focus * 0.45), filter: blur > 0 ? `blur(${blur}px)` : undefined }}>
        {inner.map((c, i) => chipFor(c, i, false))}
        {outer.map((c, i) => chipFor(c, i, true))}
        {slots.map((s, i) => {
          if (flyOf(i) < 1) return null;
          const g = kf(f, [flyStart(i) + u(40), flyStart(i) + u(48), flyStart(i) + u(90)], [0, 1, 0.3]);
          return (
            <div key={`p${i}`} style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: rigTransform(s.x, s.y, 0, wallCam, WALL_P, cx, cy, ` scale(${WALL_PILL}) translate(-50%, -50%)`), zIndex: 10 }}>
              <Pill index={i} name={spec.topics[i]!.name} glow={g} />
            </div>
          );
        })}
      </div>

      {/* paneles flotantes con su título: cada uno lleva su propia perspectiva y se ordena por profundidad */}
      {fold < 1 &&
        panels.map((c, i) => {
          const a = kf(f, [u(i * 8), u(i * 8 + 24)], [0, 1], ease.out);
          if (a <= 0) return null;
          const W = Math.round(PANEL.w * c.k);
          const H = Math.round(PANEL.h * c.k);
          const z = c.z + (1 - a) * 260;
          const Thumb = scenes[i]?.thumbnail;
          const titleGone = f >= flyStart(i);
          return (
            <div
              key={i}
              style={{
                position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0",
                transform: rigTransform((c.x - cx) * cam.s, (c.y - cy + bobOf(i)) * cam.s, z * cam.s, { dz: 0, rx: cam.rx, ry: cam.ry }, CARD_P, cx, cy, ` scale(${cam.s.toFixed(4)}) translate(${-W / 2}px, ${-H / 2}px)`),
                zIndex: 100 + Math.round(c.z), opacity: a * (1 - fold),
              }}
            >
              <div style={{ width: PANEL.w, height: PANEL.h, transform: `scale(${c.k}, ${Math.max(0.001, c.k * (1 - fold)).toFixed(4)})`, transformOrigin: "0 0" }}>
                <div style={{ width: PANEL.w, height: PANEL.h, borderRadius: theme.radius.lg, boxShadow: `0 44px 80px -28px ${withAlpha(theme.color.text, 0.42)}` }}>
                  {Thumb ? <Thumb /> : <DefaultThumbnail index={i} name={spec.topics[i]!.name} />}
                </div>
              </div>
              {!titleGone && (
                <div style={{ position: "absolute", left: Math.round(W / 2), top: PILL_OFF, transform: "translate(-50%, -50%)" }}>
                  <Pill index={i} name={spec.topics[i]!.name} />
                </div>
              )}
            </div>
          );
        })}

      {/* píldoras en vuelo: viajan en profundidad (cambian de escala) de su panel a su lugar en el muro */}
      {panels.map((c, i) => {
        const p = flyOf(i);
        if (p <= 0 || p >= 1) return null;
        const H = PANEL.h * c.k;
        const pc = rigProject((c.x - cx) * cam.s, (c.y - cy + bobOf(i) - H / 2 + PILL_OFF) * cam.s, c.z * cam.s, { dz: 0, rx: cam.rx, ry: cam.ry }, CARD_P)!;
        const from = { x: cx + pc.x, y: cy + pc.y, s: pc.s * cam.s, rx: cam.rx, ry: cam.ry };
        const w = rigProject(slots[i]!.x, slots[i]!.y, 0, wallCam, WALL_P)!;
        const to = { x: cx + w.x, y: cy + w.y, s: w.s * WALL_PILL, rx: 0, ry: wallCam.ry };
        const arc = Math.sin(p * Math.PI);
        const x = mix(from.x, to.x, p);
        const y = mix(from.y, to.y, p) - arc * 90;
        const sc = mix(from.s, to.s, p) + arc * 0.3;
        return (
          <div
            key={`f${i}`}
            style={{
              position: "absolute", left: 0, top: 0, transformOrigin: "0 0", zIndex: 300,
              transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) perspective(2000px) rotateX(${mix(from.rx, to.rx, p).toFixed(3)}deg) rotateY(${mix(from.ry, to.ry, p).toFixed(3)}deg) scale(${sc.toFixed(4)}) translate(-50%, -50%)`,
            }}
          >
            <Pill index={i} name={spec.topics[i]!.name} glow={arc} />
          </div>
        );
      })}

      {/* firma */}
      <div style={{ position: "absolute", inset: 0, background: theme.color.bg, opacity: wash, zIndex: 500 }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40, zIndex: 600 }}>
        {signLines.logo && <Logo src={signLines.logo} style={{ maxWidth: 1000, maxHeight: 360, objectFit: "contain", opacity: logo, transform: `scale(${0.92 + logo * 0.08})` }} />}
        <div style={{ maxWidth: 1600, textAlign: "center", fontSize: sf.size, lineHeight: 1.12, fontWeight: theme.font.weights.semibold, color: theme.color.text, opacity: signLines.logo ? sign : logo, transform: `translateY(${Math.round((1 - (signLines.logo ? sign : logo)) * 16)}px)` }}>
          {signLines.logo ? sf.text : <GradientText>{sf.text}</GradientText>}
        </div>
        {tagline && (
          <div style={{ maxWidth: 1500, textAlign: "center", fontSize: tagline.size, color: theme.color.textMuted, opacity: sign, transform: `translateY(${Math.round((1 - sign) * 16)}px)` }}>
            {tagline.text}
          </div>
        )}
      </div>
    </Stage>
  );
}
