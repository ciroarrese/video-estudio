import { Easing, random, useFrame, useVideoConfig } from "../engine";
import { GradientText, Stage, kf } from "../kit";
import { useTheme } from "../themes";
import { closingWall, fitText, panelLayout, rigProject } from "./layout";
import { Chip, Logo, Pill, scaler, useEase } from "./shared";
import type { StorySpec, TopicScene } from "./types";

export const CLOSING_FRAMES = 480;
export const closingFrames = (spec: StorySpec) => spec.timing?.closing ?? CLOSING_FRAMES;

const PANEL = { w: 560, h: 340 };
const WALL_P = 1600;
const CARD_P = 2200;
const TITLE_GAP = 84;

/** Tarjeta por defecto del cierre cuando una escena no trae `thumbnail`: nombre del tema y barras de ejemplo. */
export function DefaultThumbnail({ index, name }: { index: number; name: string }) {
  const theme = useTheme();
  const t = fitText(name, PANEL.w - 80, 26, { min: 18 });
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

// -- proyección de un punto del plano del muro / de la capa de paneles a la pantalla (para el vuelo de las píldoras)
type WallCam = { z: number; ry: number };
const wallProject = (cam: WallCam, x: number, y: number) => rigProject(x, y, 0, { dz: cam.z, rx: 0, ry: cam.ry }, WALL_P)!;
/** Capa de paneles: `rotateX rotateY scale(s)` alrededor del centro del cuadro, con perspectiva. */
const cardProject = (x: number, y: number, z: number, cam: { s: number; rx: number; ry: number }) => {
  const p = rigProject((x - 960) * cam.s, (y - 540) * cam.s, z * cam.s, { dz: 0, rx: cam.rx, ry: cam.ry }, CARD_P)!;
  return { ...p, s: p.s * cam.s };
};
const WALL_PILL = 1.15;

/**
 * Cierre: paneles flotantes con el título de cada tema; se pliegan y los títulos viajan en profundidad
 * hasta sus lugares reservados en el centro del muro, que se enfoca, se enciende y se aleja mostrando un anillo
 * exterior; después, fundido a la firma.
 */
export function Closing({ spec, scenes }: { spec: StorySpec; scenes: TopicScene[] }) {
  const theme = useTheme();
  const ease = useEase();
  const f = useFrame();
  const { width, height } = useVideoConfig();
  const dur = closingFrames(spec);
  const u = scaler(dur, CLOSING_FRAMES);
  const n = spec.topics.length;
  const { inner, outer, slots } = closingWall(spec);
  const panels = panelLayout(n);
  const stagger = Math.min(6, 30 / n);
  const T = { wall: u(140), fold: [u(186), u(216)] as [number, number], fly: [u(216), u(270)] as [number, number], light: u(276), wash: [u(388), u(418)] as [number, number], logo: u(414), sign: u(438) };

  const cam = {
    s: kf(f, [0, u(150), u(270)], [1.12, 0.98, 0.94], Easing.inOut),
    ry: kf(f, [0, u(270)], [-12, 8]),
    rx: kf(f, [0, u(270)], [8, 2]),
  };
  const wallCam: WallCam = {
    z: kf(f, [0, T.fly[0], T.fly[1] + u(30), u(350)], [-460, -460, -500, -680]),
    ry: kf(f, [0, u(380)], [-6, 2]),
  };
  const wallIn = kf(f, [T.wall - u(20), T.wall + u(10)], [0, 1], ease.out);
  const focus = kf(f, [T.fly[0], T.fly[1] + u(40)], [0, 1]);
  const fold = kf(f, T.fold, [0, 1], Easing.inOut);
  const wash = kf(f, T.wash, [0, 1], Easing.linear);
  const logo = kf(f, [T.logo, T.logo + u(26)], [0, 1], ease.out);
  const sign = kf(f, [T.sign, T.sign + u(22)], [0, 1], ease.out);
  const flyStart = (i: number) => T.fly[0] + u(i * stagger);
  const flyOf = (i: number) => kf(f, [flyStart(i), flyStart(i) + u(40)], [0, 1], Easing.inOut);

  const chipFor = (c: { x: number; y: number; text: string }, i: number, faint: boolean) => {
    const on = faint ? T.light + u(10) + random(`o${i}`) * u(50) : Math.min(T.wall + random(`con${i}`) * u(70), T.light + random(`l2${i}`) * u(30));
    const lit = f >= on ? 1 : 0;
    const pop = faint ? 0 : kf(f, [on, on + u(5), on + u(20)], [0, 1, 0]);
    return (
      <div key={`${faint ? "o" : "i"}${i}`} data-qa-ignore="min-size contrast" style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${c.x}px, ${c.y}px)`, opacity: faint ? 0.6 : 1 }}>
        <div style={{ transform: `scale(${1.1 + pop * 0.12})` }}>
          <Chip text={c.text} lit={lit} pop={0} faint={faint} />
        </div>
      </div>
    );
  };

  const signLines = spec.signoff;
  const sf = fitText(signLines.text, 1500, theme.type.h2, { min: theme.type.body, lines: 2, avg: 0.55 });

  return (
    <Stage frame={f}>
      {/* muro: desenfocado hasta que llegan las píldoras */}
      <div style={{ position: "absolute", inset: 0, perspective: WALL_P, opacity: wallIn * (0.6 + focus * 0.4), filter: focus < 1 ? `blur(${((1 - focus) * 5).toFixed(2)}px)` : undefined }}>
        <div style={{ position: "absolute", left: 960, top: 540, transformStyle: "preserve-3d", transform: `translateZ(${wallCam.z}px) rotateY(${wallCam.ry}deg)` }}>
          {inner.map((c, i) => chipFor(c, i, false))}
          {outer.map((c, i) => chipFor(c, i, true))}
          {slots.map((s, i) => {
            if (flyOf(i) < 1) return null;
            const g = kf(f, [flyStart(i) + u(40), flyStart(i) + u(48), flyStart(i) + u(90)], [0, 1, 0.3]);
            return (
              <div key={`p${i}`} style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${s.x}px, ${s.y}px)` }}>
                <Pill index={i} name={spec.topics[i]!.name} scale={WALL_PILL} glow={g} />
              </div>
            );
          })}
        </div>
      </div>

      {/* paneles flotantes con su título */}
      <div style={{ position: "absolute", inset: 0, perspective: CARD_P }}>
        <div style={{ position: "absolute", left: 0, top: 0, width, height, transformOrigin: "960px 540px", transformStyle: "preserve-3d", transform: `rotateX(${cam.rx}deg) rotateY(${cam.ry}deg) scale(${cam.s})` }}>
          {panels.map((c, i) => {
            const a = kf(f, [u(i * 8), u(i * 8 + 24)], [0, 1], ease.out);
            if (a <= 0) return null;
            const bob = Math.sin(f / 28 + i * 1.7) * 10;
            const W = PANEL.w * c.k;
            const H = PANEL.h * c.k;
            const Thumb = scenes[i]?.thumbnail;
            const titleGone = f >= flyStart(i);
            return (
              <div key={i} style={{ position: "absolute", left: c.x - W / 2, top: c.y - H / 2 + bob, width: W, height: H, transform: `translateZ(${c.z + (1 - a) * 300}px)`, opacity: a }}>
                {!titleGone && (
                  <div style={{ position: "absolute", left: 0, top: -TITLE_GAP, width: W, display: "flex", justifyContent: "center" }}>
                    <Pill index={i} name={spec.topics[i]!.name} />
                  </div>
                )}
                <div style={{ width: PANEL.w, height: PANEL.h, transform: `scale(${c.k}, ${Math.max(0.001, c.k * (1 - fold))})`, transformOrigin: "0 0", opacity: 1 - fold * 0.8 }}>
                  {Thumb ? <Thumb /> : <DefaultThumbnail index={i} name={spec.topics[i]!.name} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* píldoras en vuelo: viajan en profundidad (cambian de escala) de su panel a su lugar en el muro */}
      {panels.map((c, i) => {
        const p = flyOf(i);
        if (p <= 0 || p >= 1) return null;
        const bob = Math.sin(f / 28 + i * 1.7) * 10;
        const pc = cardProject(c.x, c.y + bob, c.z, cam);
        const from = { x: 960 + pc.x, y: 540 + pc.y - pc.s * ((PANEL.h * c.k) / 2 + TITLE_GAP - 32), s: pc.s };
        const w = wallProject(wallCam, slots[i]!.x, slots[i]!.y);
        const to = { x: 960 + w.x, y: 540 + w.y, s: w.s * WALL_PILL };
        const x = from.x + (to.x - from.x) * p;
        const y = from.y + (to.y - from.y) * p - Math.sin(p * Math.PI) * 70;
        const sc = from.s + (to.s - from.s) * p + Math.sin(p * Math.PI) * 0.25;
        return (
          <div key={`f${i}`} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", zIndex: 30 }}>
            <Pill index={i} name={spec.topics[i]!.name} scale={sc} glow={Math.sin(p * Math.PI)} />
          </div>
        );
      })}

      {/* firma */}
      <div style={{ position: "absolute", inset: 0, background: theme.color.bg, opacity: wash, zIndex: 50 }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 34, zIndex: 60 }}>
        {signLines.logo && <Logo src={signLines.logo} style={{ maxWidth: 820, maxHeight: 300, objectFit: "contain", opacity: logo, transform: `scale(${0.92 + logo * 0.08})` }} />}
        <div style={{ maxWidth: 1500, textAlign: "center", fontSize: sf.size, lineHeight: 1.12, fontWeight: theme.font.weights.semibold, color: theme.color.text, opacity: signLines.logo ? sign : logo, transform: `translateY(${(1 - (signLines.logo ? sign : logo)) * 16}px)` }}>
          {signLines.logo ? sf.text : <GradientText>{sf.text}</GradientText>}
        </div>
        {signLines.tagline && (
          <div style={{ maxWidth: 1400, textAlign: "center", fontSize: theme.type.body * 0.9, color: theme.color.textMuted, opacity: sign, transform: `translateY(${(1 - sign) * 16}px)` }}>
            {fitText(signLines.tagline, 1500, theme.type.body * 0.9, { min: 26, avg: 0.5, lines: 2 }).text}
          </div>
        )}
      </div>
    </Stage>
  );
}
