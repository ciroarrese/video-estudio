import React, { useEffect } from "react";
import { asset, holdRender, releaseRender, useFrame, useVideoConfig } from "../engine";
import { CloudBackground, GradientText, Stage, kf } from "../kit";
import type { CloudOptions } from "../kit";
import { themeEasing } from "../kit/util";
import { contrastRatio, useTheme, withAlpha } from "../themes";
import type { Theme } from "../themes";
import { fade, styleKey, xform } from "../fx/core/math";
import type { ListLayout } from "./layout";
import { INLINE_SEP, ROW_GAP, fitText, pillFit } from "./layout";
import { parseRich } from "./types";


/**
 * `Stage` con las nubes del tamaño del cuadro: el fondo de `kit` se reparte por 1920×1080 y en vertical o cuadrado
 * quedaba como una franja arriba; acá se lo pide con el ancho y el alto reales (en horizontal es idéntico).
 */
export function StoryStage({ frame, cloud, children }: { frame?: number; /** Nubes de la historia (`spec.design.clouds`); lo que falte sale del tema. */ cloud?: CloudOptions; children?: React.ReactNode }) {
  const { width, height } = useVideoConfig();
  const cur = useFrame();
  return (
    <Stage clouds={false} frame={frame}>
      <CloudBackground {...cloud} frame={frame ?? cur} width={width} height={height} />
      {children}
    </Stage>
  );
}

/** Escala los cuadros de un bloque cuando su duración se pisa con `timing`. */
export const scaler = (dur: number, base: number) => (n: number) => (n * dur) / base;

/** Pieza del muro (~30 px de letra): encendida = borde y texto con énfasis; `pop` agranda y da brillo un instante. */
export function Chip({ text, lit, pop, faint }: { text: string; lit: number; pop: number; faint?: boolean }) {
  const theme = useTheme();
  const on = lit > 0.5;
  const t = fitText(text, 400, theme.type.caption * 0.94, { min: theme.type.caption * 0.75, avg: 0.54 });
  // en reposo (pop = 0) sin `transform`: un `scale(1)` residual compone la pieza en capa propia y se rasteriza según el historial
  const style: React.CSSProperties = {
    padding: `${t.size * 0.5}px ${t.size * 0.9}px`,
    borderRadius: theme.radius.pill,
    background: theme.color.surface,
    border: `2px solid ${on ? withAlpha(theme.color.accent, faint ? 0.3 : 0.55) : theme.color.border}`,
    boxShadow: pop > 0.01 ? `${theme.shadow.md}, 0 0 ${10 + pop * 34}px ${withAlpha(theme.color.accent, 0.45 * pop)}` : theme.shadow.md,
    fontSize: t.size,
    fontWeight: theme.font.weights.medium,
    color: on ? (faint ? theme.color.textMuted : theme.color.text) : theme.color.textMuted,
    whiteSpace: "nowrap",
    transform: pop > 0.01 ? xform({ scale: 1 + pop * 0.12 }) : undefined,
  };
  return (
    <div key={styleKey(style)} style={style}>
      {t.text}
    </div>
  );
}

/**
 * Color sólido del número de una píldora: el primer rol de acento que llega a 4,5:1 sobre la superficie del tema; si ninguno llega, el
 * texto del tema. El degradado no sirve acá: sobre la superficie de la píldora su contraste queda por debajo del mínimo en algunos temas.
 */
export function pillNumberColor(theme: Theme): string {
  const bg = theme.color.surface;
  for (const c of [theme.color.accent, theme.color.accent2]) if (contrastRatio(c, bg) >= 4.5) return c;
  return theme.color.text;
}

/** Píldora con el número y el nombre del tema (cierre, ~34 px de letra). */
export function Pill({ index, name, scale = 1, glow = 0, maxW }: { index: number; name: string; scale?: number; glow?: number; /** Ancho total máximo (px): achica la letra y corta con "…" (ver `pillFit`). */ maxW?: number }) {
  const theme = useTheme();
  const t = pillFit(theme, name, maxW);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 16,
        padding: `${t.size * 0.42}px ${t.size * 0.9}px`,
        borderRadius: theme.radius.pill,
        background: theme.color.surface,
        border: `3px solid ${withAlpha(theme.color.accent, 0.66)}`,
        boxShadow: `${theme.shadow.lg}, 0 0 ${18 + glow * 34}px ${withAlpha(theme.color.accent, 0.25 + glow * 0.4)}`,
        whiteSpace: "nowrap",
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: "50% 50%",
      }}
    >
      <span style={{ fontSize: t.numSize, fontWeight: theme.font.weights.stat, color: pillNumberColor(theme) }}>{String(index + 1).padStart(2, "0")}</span>
      <span style={{ fontSize: t.size, fontWeight: theme.font.weights.semibold, color: theme.color.text }}>{t.text}</span>
    </div>
  );
}

/** Círculo con tilde que se dibuja: p de 0 a 1 (primera mitad el círculo, segunda la tilde). */
export function CheckMark({ p, size, id }: { p: number; size: number; id: string }) {
  const theme = useTheme();
  const c = Math.min(1, p * 2);
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" style={{ overflow: "visible", display: "block" }}>
      <defs>
        <linearGradient id={`story-check-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor={theme.color.accent} />
          <stop offset="1" stopColor={theme.color.accent2} />
        </linearGradient>
      </defs>
      <circle cx={23} cy={23} r={21} fill={`url(#story-check-${id})`} opacity={c} transform={`translate(23 23) scale(${0.6 + c * 0.4}) translate(-23 -23)`} />
      <path d="M13 24l7 7 13-15" fill="none" stroke={theme.color.onAccent} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={34} strokeDashoffset={34 * (1 - Math.max(0, p * 2 - 1))} />
    </svg>
  );
}

/**
 * Fila de la lista: número (o su reemplazo), nombre, línea y subrayado de degradado.
 * Se ubica en coordenadas del mundo (esquina de la fila). Todo lo que se anima (`opacity`, `transform`, `filter`, sombra del
 * subrayado) se emite solo mientras cambia: en reposo la fila no lleva transformaciones ni opacidades residuales.
 */
export function HeadlineRow({
  i, L, number, underline = 0, underlineOpacity = 1, quiet = 1, opacity = 1, style,
}: {
  i: number;
  L: ListLayout;
  number?: React.ReactNode;
  underline?: number;
  underlineOpacity?: number;
  quiet?: number;
  opacity?: number;
  style?: React.CSSProperties;
}) {
  const theme = useTheme();
  const root: React.CSSProperties = { position: "absolute", left: L.left, top: L.top + i * L.rowH, width: L.rowW, height: L.rowH, opacity: fade(opacity), ...style };
  const bar: React.CSSProperties = {
    position: "absolute", left: L.barLeft, top: L.barTop, height: ROW_GAP.bar, borderRadius: theme.radius.pill, width: Math.round(L.barW * underline),
    background: theme.gradient.brand, boxShadow: underline > 0.02 ? `0 0 18px ${withAlpha(theme.color.accent, 0.5)}` : undefined, opacity: fade(underlineOpacity),
  };
  const num = number ?? <GradientText>{String(i + 1).padStart(2, "0")}</GradientText>;
  if (L.stacked) {
    const nameTop = L.blockTop + L.numH + L.numGap;
    const block: React.CSSProperties = { position: "absolute", left: 0, top: L.blockTop, width: L.rowW, opacity: fade(quiet) };
    return (
      <div key={styleKey(root)} style={root}>
        <div key={styleKey(block)} style={block}>
          <div style={{ height: L.numH, lineHeight: `${L.numH}px`, fontSize: L.numSize, fontWeight: theme.font.weights.stat, position: "relative", whiteSpace: "nowrap" }}>{num}</div>
          <div style={{ position: "absolute", left: 0, top: nameTop - L.blockTop, fontSize: L.nameSize, lineHeight: `${L.nameH}px`, height: L.nameH, fontWeight: theme.font.weights.semibold, color: theme.color.text, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{L.names[i]}</div>
          <div style={{ position: "absolute", left: 0, top: nameTop - L.blockTop + L.nameH + ROW_GAP.a, fontSize: L.lineSize, lineHeight: `${L.lineH}px`, color: theme.color.textMuted, whiteSpace: "nowrap" }}>
            {L.lineRows[i]!.map((r, k) => <div key={k}>{r}</div>)}
          </div>
        </div>
        <div key={styleKey(bar)} style={bar} />
      </div>
    );
  }
  const block: React.CSSProperties = { position: "absolute", left: 0, top: L.blockTop, width: L.rowW, opacity: fade(quiet) };
  return (
    <div key={styleKey(root)} style={root}>
      <div key={styleKey(block)} style={block}>
        <div style={{ display: "flex", alignItems: "baseline", height: L.nameH, whiteSpace: "nowrap" }}>
          <span style={{ width: L.numW, flexShrink: 0, fontSize: L.numSize, fontWeight: theme.font.weights.stat, position: "relative" }}>{num}</span>
          <span style={{ fontSize: L.nameSize, lineHeight: `${L.nameH}px`, fontWeight: theme.font.weights.semibold, color: theme.color.text, letterSpacing: "-0.02em" }}>{L.names[i]}</span>
          {L.inline && (
            <>
              <span style={{ fontSize: L.lineSize, lineHeight: `${L.nameH}px`, color: theme.color.textMuted, whiteSpace: "pre" }}>{` ${INLINE_SEP} `}</span>
              <span style={{ fontSize: L.lineSize, lineHeight: `${L.nameH}px`, color: theme.color.textMuted }}>{L.lines[i]}</span>
            </>
          )}
        </div>
        {!L.inline && <div style={{ marginLeft: L.numW, marginTop: ROW_GAP.a, height: L.lineH, fontSize: L.lineSize, lineHeight: `${L.lineH}px`, color: theme.color.textMuted, whiteSpace: "nowrap" }}>{L.lines[i]}</div>}
      </div>
      <div key={styleKey(bar)} style={bar} />
    </div>
  );
}

/** Texto con `**negrita**` (ver `parseRich`) para la firma: el fragmento en negrita sube un peso. */
export function RichText({ text, bold }: { text: string; bold?: number }) {
  const theme = useTheme();
  return (
    <>
      {parseRich(text).map((p, i) => (p.bold ? <strong key={i} style={{ fontWeight: bold ?? theme.font.weights.stat }}>{p.text}</strong> : <React.Fragment key={i}>{p.text}</React.Fragment>))}
    </>
  );
}

/** Texto con el fragmento `highlight` pintado con el degradado del tema. */
export function HighlightedTitle({ text, highlight }: { text: string; highlight?: string }) {
  const at = highlight ? text.indexOf(highlight) : -1;
  if (!highlight || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <GradientText>{highlight}</GradientText>
      {text.slice(at + highlight.length)}
    </>
  );
}

/** Imagen que bloquea el cuadro hasta cargar (para que el render no capture antes de tiempo). */
export function Logo({ src, style }: { src: string; style?: React.CSSProperties }) {
  const url = asset(src);
  useEffect(() => {
    const h = holdRender(`logo:${src}`);
    const img = new Image();
    const done = () => releaseRender(h);
    img.onload = done;
    img.onerror = done;
    img.src = url;
    if (img.complete) done();
    return done;
  }, [url, src]);
  return <img src={url} alt="" style={style} />;
}

export { kf };

/** Curvas del tema como funciones de easing. */
export function useEase() {
  const theme = useTheme();
  return { out: themeEasing(theme.motion.easing.out), inOut: themeEasing(theme.motion.easing.inOut) };
}
