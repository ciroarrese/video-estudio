import React, { useEffect } from "react";
import { asset, holdRender, releaseRender } from "../engine";
import { GradientText, kf } from "../kit";
import { themeEasing } from "../kit/util";
import { useTheme, withAlpha } from "../themes";
import type { ListLayout } from "./layout";
import { fitText } from "./layout";


/** Escala los cuadros de un bloque cuando su duración se pisa con `timing`. */
export const scaler = (dur: number, base: number) => (n: number) => (n * dur) / base;

/** Pieza del muro: encendida = borde y texto con énfasis; `pop` agranda y da brillo un instante. */
export function Chip({ text, lit, pop, faint }: { text: string; lit: number; pop: number; faint?: boolean }) {
  const theme = useTheme();
  const on = lit > 0.5;
  const t = fitText(text, 340, theme.type.caption * 0.95, { min: theme.type.caption * 0.75, avg: 0.54 });
  return (
    <div
      style={{
        padding: `${t.size * 0.5}px ${t.size * 0.9}px`,
        borderRadius: theme.radius.pill,
        background: theme.color.surface,
        border: `2px solid ${on ? withAlpha(theme.color.accent, faint ? 0.3 : 0.5) : theme.color.border}`,
        boxShadow: pop > 0.01 ? `${theme.shadow.md}, 0 0 ${10 + pop * 30}px ${withAlpha(theme.color.accent, 0.4 * pop)}` : theme.shadow.md,
        fontSize: t.size,
        fontWeight: theme.font.weights.medium,
        color: on ? (faint ? theme.color.textMuted : theme.color.text) : theme.color.textMuted,
        whiteSpace: "nowrap",
        transform: `scale(${1 + pop * 0.12})`,
      }}
    >
      {t.text}
    </div>
  );
}

/** Píldora con el número y el nombre del tema (cierre). */
export function Pill({ index, name, scale = 1, glow = 0 }: { index: number; name: string; scale?: number; glow?: number }) {
  const theme = useTheme();
  const t = fitText(name, 440, theme.type.caption * 1.05, { min: theme.type.caption * 0.78 });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 14,
        padding: `${t.size * 0.4}px ${t.size * 0.8}px`,
        borderRadius: theme.radius.pill,
        background: theme.color.surface,
        border: `2.5px solid ${withAlpha(theme.color.accent, 0.66)}`,
        boxShadow: `${theme.shadow.lg}, 0 0 ${18 + glow * 30}px ${withAlpha(theme.color.accent, 0.25 + glow * 0.4)}`,
        whiteSpace: "nowrap",
        transform: `scale(${scale})`,
        transformOrigin: "50% 50%",
      }}
    >
      <GradientText style={{ fontSize: Math.max(24, t.size * 0.72), fontWeight: theme.font.weights.stat }}>{String(index + 1).padStart(2, "0")}</GradientText>
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
 * Se ubica en coordenadas del mundo (esquina de la fila).
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
  return (
    <div style={{ position: "absolute", left: L.left, top: L.top + i * L.rowH, width: L.rowW, height: L.rowH, opacity, ...style }}>
      <div style={{ position: "absolute", left: 0, top: L.blockTop, width: L.rowW, opacity: quiet }}>
        <div style={{ display: "flex", alignItems: "baseline", height: L.nameH, whiteSpace: "nowrap" }}>
          <span style={{ width: L.numW, flexShrink: 0, fontSize: L.numSize, fontWeight: theme.font.weights.stat, position: "relative" }}>
            {number ?? <GradientText>{String(i + 1).padStart(2, "0")}</GradientText>}
          </span>
          <span style={{ fontSize: L.nameSize, lineHeight: `${L.nameH}px`, fontWeight: theme.font.weights.semibold, color: theme.color.text, letterSpacing: "-0.02em" }}>{L.names[i]}</span>
        </div>
        <div style={{ marginLeft: L.numW, marginTop: 4, height: L.lineH, fontSize: L.lineSize, lineHeight: `${L.lineH}px`, color: theme.color.textMuted, whiteSpace: "nowrap" }}>{L.lines[i]}</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: L.numW,
          top: L.blockTop + L.nameH + 4 + L.lineH + 10,
          height: 6,
          borderRadius: theme.radius.pill,
          width: L.barW * underline,
          background: theme.gradient.brand,
          opacity: underlineOpacity,
        }}
      />
    </div>
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
