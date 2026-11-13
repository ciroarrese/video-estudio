import React from "react";
import { Easing, random, useFrame, useVideoConfig } from "../engine";
import { GradientText, Highlight, kf } from "../kit";
import { accentMark, chartStyle, cornerRadius, numeralStyle, resolveColor, resolveStyle, staggerFrames, surfaceStyle, textStyle, transitionVeil, useTheme, withAlpha } from "../themes";
import type { Theme } from "../themes";
import { fade, styleKey, xform } from "../fx/core/math";
import { PILL_OFF, closingWall, fitText, panelEntryLift, panelLayout, closingCamStart, pillBudget, pillFit, rigProject, rigTransform } from "./layout";
import { Chip, Logo, Pill, RichText, StoryStage, pillNumberColor, scaler, useEase, useStorySpec } from "./shared";
import { plainRich, wallOptions } from "./types";
import type { StorySpec, TopicScene } from "./types";

import { CLOSING_FRAMES } from "./durations";
export { CLOSING_FRAMES };
export const closingFrames = (spec: StorySpec) => spec.timing?.closing ?? CLOSING_FRAMES;

const PANEL = { w: 560, h: 340 };
const WALL_P = 1600;
const CARD_P = 2200;

/** Número de 0 a 1 estable a partir de un texto (para variar la tarjeta por defecto sin azar entre cuadros). */
const seedOf = (text: string, k: number) => random(`thumb-${text}-${k}`);

/**
 * Tarjeta por defecto del cierre cuando una escena no trae `thumbnail`. Para que no parezcan todas iguales se deriva de lo que hay:
 * el rol de color (`theme.color.chart[index]`), el número del tema en grande y una composición que cambia con el índice (barras,
 * línea, anillo, filas) con datos que salen del nombre. Con una captura recreada de la escena propia (`thumbnail`) queda mucho mejor:
 * se recomienda siempre que haya tiempo.
 */
export function DefaultThumbnail({ index, name }: { index: number; name: string }) {
  const theme = useTheme();
  const t = fitText(name, PANEL.w - 150, 28, { min: 22 });
  const chart = theme.color.chart;
  const col = (k: number) => chart[(index + k) % chart.length]!;
  const variant = index % 4;
  // el número va en un color con contraste garantizado sobre la barra del título (`surfaceAlt`): el del gráfico si llega a 4,5:1, si no un acento o el texto
  const numStyle = resolveStyle(theme).type.numerals === "gradient" ? { color: pillNumberColor(theme, theme.color.surfaceAlt, [col(0)]) } : numeralStyle(theme, { on: theme.color.surfaceAlt });
  // gráficos del design system (`chartStyle`): esquinas y relleno de las barras, grosor de la línea y líneas de guía. La miniatura es chica: usa un
  // escalón menos de radio y 1 px más de línea que el gráfico grande (con el estilo por defecto: `radius.sm` y 6 px, como siempre)
  const ch = chartStyle(theme);
  const barRadius = thumbBarRadius(theme);
  const barFill = (color: string): React.CSSProperties => ch.fill === "gradient" ? { background: `linear-gradient(${color}, ${withAlpha(color, 0.55)})` } : ch.fill === "hatched" ? { background: `repeating-linear-gradient(45deg, ${color} 0 3px, ${withAlpha(color, 0.18)} 3px 9px)` } : { background: color, opacity: 0.85 };
  const guides = ch.grid === "on" && (
    <div style={{ position: "absolute", left: 28, top: 84, width: PANEL.w - 56, height: PANEL.h - 84 - 30 }}>
      {[0, 1, 2, 3].map((k) => <div key={k} style={{ position: "absolute", left: 0, right: 0, top: `${k * 33.33}%`, height: 1, background: theme.color.border }} />)}
    </div>
  );
  const pillR = cornerRadius(theme, "chip");
  const barR = cornerRadius(theme, "bar");
  const title = textStyle(theme, "title");
  const vals = [0, 1, 2, 3, 4].map((k) => 0.3 + seedOf(name, k) * 0.7);
  const area = { left: 28, top: 84, w: PANEL.w - 56, h: PANEL.h - 84 - 30 };
  let body: React.ReactNode;
  if (variant === 0) {
    body = (
      <div style={{ position: "absolute", left: area.left, top: area.top, width: area.w, height: area.h, display: "flex", alignItems: "flex-end", gap: 18 }}>
        {vals.map((v, k) => <div key={k} style={{ flex: 1, height: `${v * 100}%`, borderRadius: barRadius, ...barFill(col(k)) }} />)}
      </div>
    );
  } else if (variant === 1) {
    const pts = vals.map((v, k) => `${(k / 4) * area.w},${area.h - v * area.h}`).join(" ");
    body = (
      <svg style={{ position: "absolute", left: area.left, top: area.top }} width={area.w} height={area.h} viewBox={`0 0 ${area.w} ${area.h}`} overflow="visible">
        <polygon points={`0,${area.h} ${pts} ${area.w},${area.h}`} fill={col(0)} opacity={0.18} />
        <polyline points={pts} fill="none" stroke={col(0)} strokeWidth={ch.lineWidth + 1} strokeLinejoin="round" strokeLinecap="round" />
        {vals.map((v, k) => <circle key={k} cx={(k / 4) * area.w} cy={area.h - v * area.h} r={8} fill={theme.color.surface} stroke={col(1)} strokeWidth={4} />)}
      </svg>
    );
  } else if (variant === 2) {
    const r = 62, c = 2 * Math.PI * r;
    const parts = [vals[0]!, vals[1]!, vals[2]!];
    const sum = parts.reduce((a, b) => a + b, 0);
    let off = 0;
    body = (
      <svg style={{ position: "absolute", left: area.left, top: area.top }} width={area.w} height={area.h} viewBox={`0 0 ${area.w} ${area.h}`}>
        <g transform={`translate(${area.w * 0.28} ${area.h / 2}) rotate(-90)`}>
          {parts.map((p, k) => {
            const len = (p / sum) * c;
            const el = <circle key={k} r={r} fill="none" stroke={col(k)} strokeWidth={28} strokeDasharray={`${Math.max(0, len - 4)} ${c}`} strokeDashoffset={-off} />;
            off += len;
            return el;
          })}
        </g>
        {parts.map((p, k) => <rect key={k} x={area.w * 0.58} y={40 + k * 48} width={Math.round(60 + (p / sum) * 220)} height={16} rx={8} fill={col(k)} opacity={0.85} />)}
      </svg>
    );
  } else {
    body = (
      <div style={{ position: "absolute", left: area.left, top: area.top, width: area.w, height: area.h, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        {vals.slice(0, 4).map((v, k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 14, height: 36 }}>
            <span style={{ width: 22, height: 22, borderRadius: pillR, background: col(k), flexShrink: 0 }} />
            <span style={{ flex: 1, height: 12, borderRadius: barR, background: theme.color.border }}><span style={{ display: "block", width: `${v * 100}%`, height: "100%", borderRadius: barR, background: col(k), opacity: 0.8 }} /></span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ width: PANEL.w, height: PANEL.h, ...surfaceStyle(theme, "card", { level: "lg" }), overflow: "hidden", position: "relative" }}>
      <div style={{ height: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 24px", borderBottom: `1px solid ${theme.color.border}`, background: theme.color.surfaceAlt }}>
        <span style={{ width: 14, height: 14, borderRadius: pillR, background: col(0), flexShrink: 0 }} />
        <span style={{ fontSize: t.size, fontWeight: title.fontWeight, color: theme.color.text, whiteSpace: "nowrap" }}>{t.text}</span>
        <span style={{ marginLeft: "auto", fontSize: 26, fontWeight: theme.font.weights.stat, ...numStyle }}>{String(index + 1).padStart(2, "0")}</span>
      </div>
      {guides}
      {body}
    </div>
  );
}

/** Radio (px) de las barras de la miniatura: un escalón menos que el de `style.chart.barRadius` (por defecto `md` -> `radius.sm`, como siempre). */
function thumbBarRadius(theme: Theme): number {
  const step = resolveStyle(theme).chart.barRadius;
  const r = theme.radius;
  return step === "none" ? 0 : step === "pill" ? r.pill : step === "lg" ? r.md : step === "md" ? r.sm : Math.round(r.sm / 2);
}

const WALL_PILL = 1.5;
/** Ancho total máximo (px, sin escalar) de la píldora del muro: ya agrandada por `WALL_PILL` ocupa como mucho el 80 % del cuadro (en vertical un nombre largo se salía). */
const wallPillMaxW = (theme: Theme, name: string, width: number): number | undefined => {
  const cap = Math.floor((width * 0.8) / WALL_PILL);
  return pillFit(theme, name).w <= cap ? undefined : cap; // si ya entra, queda como siempre (horizontal no cambia)
};

/** Valor que sigue entre dos puntos. */
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** Texto con `**negrita**` ajustado a un ancho: si entra tal cual conserva las marcas; si hay que cortarlo con "…" queda en texto plano. */
function fitRich(text: string, maxWidth: number, size: number, o: Parameters<typeof fitText>[3]): { text: string; size: number } {
  const plain = plainRich(text);
  const t = fitText(plain, maxWidth, size, o);
  return t.text === plain ? { text, size: t.size } : t;
}

/** Estilo de un elemento que entra con fundido: sin `opacity` en reposo y `visibility: hidden` (no se pinta ni lo mira `qa`) mientras vale 0. */
const fadeIn = (o: number): React.CSSProperties => ({ opacity: fade(o), visibility: o <= 0 ? "hidden" : undefined });

/**
 * Cierre: paneles flotantes (grandes, con inclinación, sombra y profundidad) con el título de cada tema sobre su
 * borde; detrás, el muro de etiquetas desenfocado. Los paneles se pliegan, los títulos viajan en profundidad (cambian
 * de escala) hasta sus lugares reservados en el centro del muro, que entra en foco, se enciende y se aleja hasta
 * mostrar todo; después, fundido a la firma.
 *
 * Se usa suelta (`<Closing spec />` dentro de un `Sequence` de `closingFrames(spec)` cuadros): `scenes` es opcional y, parejo a los temas,
 * admite `null` (o faltar) para un tema sin escena; el panel de ese tema usa `spec.topics[i].thumbnail` o la tarjeta por defecto.
 */
export function Closing({ spec: specIn, scenes = [] }: { spec: StorySpec; scenes?: (TopicScene | null)[] }) {
  const theme = useTheme();
  const spec = useStorySpec(specIn); // el diseño del video sobre el del design system
  const ease = useEase();
  const f = useFrame();
  const { width, height } = useVideoConfig();
  const dur = closingFrames(spec);
  const u = scaler(dur, CLOSING_FRAMES);
  const n = spec.topics.length;
  const cx = width / 2, cy = height / 2;
  const { inner, outer, slots } = closingWall(spec, width, height);
  const panels = panelLayout(n, width, height);
  const stagger = Math.min(6, 30 / n);
  // cuánto se acerca cada panel a la cámara al entrar (menos en los formatos donde los paneles llenan el cuadro)
  const camStart = closingCamStart(panels, theme, spec.topics.map((t) => t.name), width, height);
  const lifts = panels.map((c, i) => panelEntryLift(c, theme, spec.topics[i]!.name, pillBudget(panels, i, width), width, height, camStart));
  const T = { wall: u(130), fold: [u(170), u(200)] as [number, number], fly: [u(200), u(254)] as [number, number], light: u(262), pull: u(372), wash: [u(368), u(398)] as [number, number], logo: u(394), sign: u(418) };

  const cam = {
    s: kf(f, [0, u(150), u(260)], [camStart, Math.min(camStart, 0.99), Math.min(camStart, 0.95)], Easing.inOut),
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
  const flyStart = (i: number) => T.fly[0] + u(staggerFrames(theme, i, { base: stagger }));
  const flyOf = (i: number) => kf(f, [flyStart(i), flyStart(i) + u(40)], [0, 1], Easing.inOut);
  const bobOf = (i: number) => Math.sin(f / 28 + i * 1.7) * 10;
  const blur = !wallOptions(spec.design).blurClosing ? 0 : Math.round((1 - focus) * 90) / 10;

  // el panel flota: con sombra, la larga de siempre; con otra elevación (plana, filo duro, halo) la del design system (`surfaceStyle`)
  const panelSurf = surfaceStyle(theme, "panel");
  const panelSurface: React.CSSProperties = resolveStyle(theme).surface.elevation === "shadow"
    ? { borderRadius: panelSurf.borderRadius, boxShadow: `0 44px 80px -28px ${withAlpha(theme.color.text, 0.42)}` }
    : { borderRadius: panelSurf.borderRadius, boxShadow: panelSurf.boxShadow };
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
  const signW = Math.min(1560, width - 2 * theme.safe.x);
  const hasMark = !!(signLines.logo || signLines.slot);
  // sin marca propia la despedida es lo más grande del cierre (h1); con marca baja a h2 para que la marca mande
  const sf = signLines.text ? fitRich(signLines.text, signW, hasMark ? theme.type.h2 : theme.type.h1, { min: theme.type.body, lines: 2, avg: 0.55 }) : null;
  const tagline = signLines.tagline ? fitRich(signLines.tagline, Math.min(1500, signW), theme.type.body, { min: theme.type.caption, avg: 0.5, lines: 2 }) : null;
  // sin texto de despedida la marca entra sola y la barra y la nota la siguen
  const textIn = hasMark ? sign : logo;
  const titleStyle = textStyle(theme, "title");
  // marca de acento bajo la firma (`decor.accent`: barra, filete o punto; `design.closing.bar: false` la quita)
  const signMark = spec.design?.closing?.bar === false ? null : accentMark(theme, { length: Math.min(signW, 420), thickness: 8, progress: sign });
  // la despedida sin marca es el titular del cierre: resaltada como el resto de la historia (`type.highlight`: degradado, acento, filete o marcador)
  const signText = (node: React.ReactNode) => resolveStyle(theme).type.highlight === "gradient"
    ? <GradientText loop={spec.design?.gradient?.loop}>{node}</GradientText>
    : <Highlight loop={spec.design?.gradient?.loop} progress={textIn}>{node}</Highlight>;

  // el telón de la firma sigue a `motion.transition` (fundido, cortina o corte); sin velo (`through`) igual hace falta: tapa el muro para que la firma se lea
  const coverBg = spec.design?.closing?.bg ? resolveColor(theme, spec.design.closing.bg) : theme.color.bg;
  const cover = transitionVeil(theme, wash, coverBg) ?? (wash > 0 && resolveStyle(theme).motion.transition === "through" ? { kind: "wash" as const, style: wash >= 0.9995 ? { background: coverBg } : { background: coverBg, opacity: +wash.toFixed(4) } } : null);

  return (
    <StoryStage frame={f} cloud={spec.design?.clouds}>
      {/* muro: desenfocado hasta que llegan las píldoras; con el lavado de la firma ya opaco se desmonta en vez de quedar debajo */}
      {wash < 1 && (
        <div key={styleKey({ o: fade(wallIn * (0.55 + focus * 0.45)), b: blur > 0 })} style={{ position: "absolute", inset: 0, zIndex: 0, opacity: fade(wallIn * (0.55 + focus * 0.45)), filter: blur > 0 ? `blur(${blur}px)` : undefined }}>
          {inner.map((c, i) => chipFor(c, i, false))}
          {outer.map((c, i) => chipFor(c, i, true))}
          {slots.map((s, i) => {
            if (flyOf(i) < 1) return null;
            const g = kf(f, [flyStart(i) + u(40), flyStart(i) + u(48), flyStart(i) + u(90)], [0, 1, 0.3]);
            return (
              <div key={`p${i}`} style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: rigTransform(s.x, s.y, 0, wallCam, WALL_P, cx, cy, ` scale(${WALL_PILL}) translate(-50%, -50%)`), zIndex: 10 }}>
                <Pill index={i} name={spec.topics[i]!.name} glow={g} maxW={wallPillMaxW(theme, spec.topics[i]!.name, width)} />
              </div>
            );
          })}
        </div>
      )}

      {/* paneles flotantes con su título: cada uno lleva su propia perspectiva y se ordena por profundidad */}
      {fold < 1 &&
        panels.map((c, i) => {
          const st = staggerFrames(theme, i, { base: 8 }); // el paso entre paneles lo escala el tema
          const a = kf(f, [u(st), u(st + 24)], [0, 1], ease.out);
          if (a <= 0) return null;
          const W = Math.round(PANEL.w * c.k);
          const H = Math.round(PANEL.h * c.k);
          const z = c.z + (1 - a) * lifts[i]!;
          const Thumb = scenes[i]?.thumbnail ?? spec.topics[i]!.thumbnail;
          const titleGone = f >= flyStart(i);
          const card: React.CSSProperties = {
            position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0",
            transform: rigTransform((c.x - cx) * cam.s, (c.y - cy + bobOf(i)) * cam.s, z * cam.s, { dz: 0, rx: cam.rx, ry: cam.ry }, CARD_P, cx, cy, ` scale(${cam.s.toFixed(4)}) translate(${-W / 2}px, ${-H / 2}px)`),
            zIndex: 100 + Math.round(c.z), opacity: fade(a * (1 - fold)),
          };
          return (
            <div key={`${i}-${styleKey(card)}`} style={card}>
              <div style={{ width: PANEL.w, height: PANEL.h, transform: xform({ scaleX: c.k, scaleY: Math.max(0.001, c.k * (1 - fold)) }), transformOrigin: "0 0" }}>
                <div data-qa-ignore="min-size" style={{ width: PANEL.w, height: PANEL.h, ...panelSurface }}>
                  {Thumb ? <Thumb /> : <DefaultThumbnail index={i} name={spec.topics[i]!.name} />}
                </div>
              </div>
              {!titleGone && (
                <div style={{ position: "absolute", left: Math.round(W / 2), top: PILL_OFF, transform: "translate(-50%, -50%)" }}>
                  <Pill index={i} name={spec.topics[i]!.name} maxW={pillBudget(panels, i, width)} />
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
        // la píldora en vuelo es la del muro (tamaño completo); arranca achicada al ancho de la del panel para que no haya salto
        const name = spec.topics[i]!.name;
        const pp = pillFit(theme, name, pillBudget(panels, i, width)), pw = pillFit(theme, name, wallPillMaxW(theme, name, width));
        // por ancho (sin salto de tamaño) pero nunca con letra menor a la del panel: con nombres largos el texto del muro es más largo y la letra salía de ~14 px
        const ratio = Math.max(pp.w / pw.w, pp.size / pw.size);
        const from = { x: cx + pc.x, y: cy + pc.y, s: pc.s * cam.s * ratio, rx: cam.rx, ry: cam.ry };
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
              transform: `translate(${Math.round(x)}px, ${Math.round(y)}px) perspective(2000px) rotateX(${mix(from.rx, to.rx, p).toFixed(3)}deg) rotateY(${mix(from.ry, to.ry, p).toFixed(3)}deg) scale(${sc.toFixed(4)}) translate(-50%, -50%)`,
            }}
          >
            <Pill index={i} name={spec.topics[i]!.name} glow={arc} maxW={wallPillMaxW(theme, spec.topics[i]!.name, width)} />
          </div>
        );
      })}

      {/* firma: cada pieza se pinta recién cuando empieza a entrar (en reposo sin `opacity` ni `transform`) y, mientras vale 0, queda
          con `visibility: hidden`: ocupa su lugar (la columna no se corre al entrar la siguiente) pero no tapa ni cuenta como texto */}
      {wash > 0 && cover && <div key={`${cover.kind}-${wash >= 1 ? "full" : "part"}`} style={{ position: "absolute", inset: 0, ...cover.style, zIndex: 500 }} />}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40, zIndex: 600 }}>
        {signLines.slot && <div key={`slot-${styleKey({ ...fadeIn(logo), t: xform({ scale: 0.92 + logo * 0.08 }) })}`} style={{ ...fadeIn(logo), transform: xform({ scale: 0.92 + logo * 0.08 }), maxWidth: signW, display: "flex", justifyContent: "center" }}>{signLines.slot}</div>}
        {!signLines.slot && signLines.logo && (
          <div key={`logo-${styleKey({ ...fadeIn(logo), t: xform({ scale: 0.92 + logo * 0.08 }) })}`} style={{ ...fadeIn(logo), transform: xform({ scale: 0.92 + logo * 0.08 }), display: "flex" }}>
            <Logo src={signLines.logo} style={{ maxWidth: Math.min(1000, width - 2 * theme.safe.x), maxHeight: 360, objectFit: "contain" }} />
          </div>
        )}
        {sf && (
          <div
            key={`text-${styleKey({ ...fadeIn(textIn), t: xform({ y: Math.round((1 - textIn) * 16) }) })}`}
            style={{ maxWidth: signW, textAlign: "center", fontSize: sf.size, lineHeight: 1.12, fontWeight: titleStyle.fontWeight, color: theme.color.text, letterSpacing: titleStyle.letterSpacing, ...fadeIn(textIn), transform: xform({ y: Math.round((1 - textIn) * 16) }) }}
          >
            {hasMark ? <RichText text={sf.text} /> : signText(<RichText text={sf.text} />)}
          </div>
        )}
        {signMark && <div style={{ ...signMark.style, visibility: sign <= 0 ? "hidden" : undefined, opacity: fade(sign) }} />}
        {tagline && (
          <div
            key={`tagline-${styleKey({ ...fadeIn(sign), t: xform({ y: Math.round((1 - sign) * 16) }) })}`}
            style={{ maxWidth: Math.min(1500, signW), textAlign: "center", fontSize: tagline.size, fontWeight: theme.font.weights.medium, color: theme.color.textMuted, ...fadeIn(sign), transform: xform({ y: Math.round((1 - sign) * 16) }) }}
          >
            <RichText text={tagline.text} />
          </div>
        )}
      </div>
    </StoryStage>
  );
}
