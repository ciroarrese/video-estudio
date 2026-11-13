import type React from "react";
import type { Theme } from "./types";
import { mixColors, withAlpha } from "./color";
import { resolveStyle } from "./style";
import type { BackgroundKind } from "./styleTypes";

/** Lado (px) de la grilla y de la trama de puntos. */
export const GRID_SIZE = 64;
export const DOTS_SIZE = 48;
/** Opacidad máxima de las líneas de la grilla y de los puntos (con `intensity` 1). */
export const GRID_ALPHA = 0.55;
export const DOTS_ALPHA = 0.9;
/** Opacidad de las motas del ruido (con `intensity` 1). */
export const NOISE_ALPHA = 0.07;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export interface BackgroundLayer {
  kind: BackgroundKind;
  /** `true` solo con `kind: "clouds"`: hay que dibujar `CloudBackground`. */
  clouds: boolean;
  /** Opacidad de las nubes: `theme.cloud.opacity * intensity` (igual a `theme.cloud.opacity` con la intensidad por defecto). */
  cloudOpacity: number;
  /** Estilo de una capa a cuadro completo (`position: absolute; inset: 0` lo pone quien la usa); `undefined` si no hay patrón. */
  style?: React.CSSProperties;
}

const noiseCache = new Map<string, string>();

/** Mosaico de 160 px con motas en posiciones de un generador congruencial fijo: mismo texto siempre, sin azar ni animación. */
function noiseTile(color: string, alpha: number): string {
  const key = `${color}|${alpha}`;
  const hit = noiseCache.get(key);
  if (hit) return hit;
  let s = 2463534242;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  let dots = "";
  for (let i = 0; i < 150; i++) {
    const x = (next() * 160).toFixed(1), y = (next() * 160).toFixed(1), r = (0.6 + next() * 1.1).toFixed(2), o = (0.35 + next() * 0.65).toFixed(2);
    dots += `<circle cx="${x}" cy="${y}" r="${r}" fill-opacity="${o}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><g fill="${color}" opacity="${alpha}">${dots}</g></svg>`;
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  noiseCache.set(key, url);
  return url;
}

/** Capa de fondo según `style.background`: nubes, nada, grilla, puntos, degradado o ruido fijo. Determinista y sin animación. */
export function backgroundLayer(theme: Theme): BackgroundLayer {
  const st = resolveStyle(theme).background;
  const c = theme.color;
  const i = clamp01(st.intensity);
  const base = { kind: st.kind, clouds: st.kind === "clouds", cloudOpacity: +(theme.cloud.opacity * i).toFixed(4) };
  switch (st.kind) {
    case "grid": {
      const l = withAlpha(c.border, GRID_ALPHA * i);
      return { ...base, style: { backgroundImage: `linear-gradient(to right, ${l} 1px, transparent 1px), linear-gradient(to bottom, ${l} 1px, transparent 1px)`, backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px` } };
    }
    case "dots": {
      const d = withAlpha(c.border, DOTS_ALPHA * i);
      return { ...base, style: { backgroundImage: `radial-gradient(circle, ${d} 2.5px, transparent 3px)`, backgroundSize: `${DOTS_SIZE}px ${DOTS_SIZE}px` } };
    }
    case "gradient":
      return { ...base, style: { backgroundImage: `linear-gradient(160deg, ${c.bg} 0%, ${mixColors(c.bg, c.accent, 0.14 * i)} 55%, ${mixColors(c.bg, c.accent2, 0.2 * i)} 100%)` } };
    case "noise":
      return { ...base, style: { backgroundImage: noiseTile(c.text, +(NOISE_ALPHA * i).toFixed(4)), backgroundSize: "160px 160px" } };
    default:
      return base;
  }
}

/**
 * Colores del peor fondo que puede quedar detrás de una superficie translúcida (para `checkTheme`): el del tema, las nubes más
 * densas a su opacidad efectiva, los extremos del degradado o la línea más densa de la grilla.
 */
export function backgroundSamples(theme: Theme): string[] {
  const st = resolveStyle(theme).background;
  const c = theme.color;
  const i = clamp01(st.intensity);
  const out = [c.bg];
  if (st.kind === "clouds") for (const col of theme.cloud.colors) out.push(mixColors(c.bg, col, theme.cloud.opacity * i));
  else if (st.kind === "grid") out.push(mixColors(c.bg, c.border, GRID_ALPHA * i));
  else if (st.kind === "dots") out.push(mixColors(c.bg, c.border, DOTS_ALPHA * i));
  else if (st.kind === "gradient") out.push(mixColors(c.bg, c.accent, 0.14 * i), mixColors(c.bg, c.accent2, 0.2 * i));
  else if (st.kind === "noise") out.push(mixColors(c.bg, c.text, NOISE_ALPHA * i));
  return out;
}
