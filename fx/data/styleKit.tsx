import type React from "react";
import { entrance, settle, surfaceStyle, resolveStyle } from "../../themes";
import type { ChartFill, EntranceOptions, SurfaceOptions, SurfaceRole, Theme } from "../../themes";
import { xform } from "../core";

/*
 * Ayudas locales de `fx/data`, `fx/ui` y `fx/art` para leer `theme.style` desde piezas SVG o con rellenos propios.
 * Todas son puras. Las ayudas de `themes/` devuelven CSS (`surfaceStyle`) o descripciones (`chartFill`); acá se traducen
 * a lo que un SVG necesita. Con el estilo por defecto cada traducción da lo que dibujaba la pieza antes.
 */

/** Definición SVG de un relleno de gráfico (`<defs>`): degradado vertical o rayado a 45 grados. `solid` no lleva definición (null). */
export function FillDef({ fill }: { fill: ChartFill }): React.ReactElement | null {
  if (fill.kind === "gradient") {
    return (
      <linearGradient id={fill.id} x1="0" y1="0" x2="0" y2="1">
        {fill.stops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />)}
      </linearGradient>
    );
  }
  if (fill.kind === "hatched") {
    return (
      <pattern id={fill.id} patternUnits="userSpaceOnUse" width={fill.spacing} height={fill.spacing} patternTransform={`rotate(${fill.angle})`}>
        <rect width={fill.spacing} height={fill.spacing} fill={fill.base} />
        <line x1={0} y1={0} x2={0} y2={fill.spacing} stroke={fill.line} strokeWidth={fill.width} />
      </pattern>
    );
  }
  return null;
}

/** Contorno extra de una forma rellena según el relleno: el rayado lleva un filo del color de la serie para que la barra no se disuelva. */
export const fillEdge = (fill: ChartFill, color: string, width = 2.5): { stroke?: string; strokeWidth?: number } =>
  fill.kind === "hatched" ? { stroke: color, strokeWidth: width } : {};

export type Edge = { shadow: "none" | "soft" | "hard" | "glow"; dx: number; dy: number; color: string; blur: number };

export interface ParsedSurface {
  /** Relleno (`fill`). */
  fill: string;
  /** Grosor del borde nominal (0 = sin borde). Con el estilo por defecto es 1. */
  border: number;
  /** Color del borde. */
  edge: string;
  /** Sombra: `soft` es la del tema (los efectos SVG nunca la dibujaron: se ignora), `hard` filo desplazado, `glow` halo de acento. */
  shadow: Edge;
  /** El borde de `surfaceStyle` tal como viene (para elementos HTML). */
  css: React.CSSProperties;
}

/**
 * Traduce `surfaceStyle(theme, role)` a las partes que usa un SVG. Compara contra los valores del propio tema (la sombra suave
 * `theme.shadow.*`), nunca contra cadenas del estilo.
 */
export function parseSurface(theme: Theme, role: SurfaceRole, o: SurfaceOptions = {}): ParsedSurface {
  const css = surfaceStyle(theme, role, o);
  const m = /^([\d.]+)px solid (.+)$/.exec(String(css.border ?? ""));
  const bs = css.boxShadow ? String(css.boxShadow) : "";
  let shadow: Edge = { shadow: "none", dx: 0, dy: 0, color: theme.color.text, blur: 0 };
  if (bs) {
    const hard = /^(\d+)px (\d+)px 0 0 (.+)$/.exec(bs);
    const glow = /^0 0 (\d+)px (rgba?\([^)]*\)|#[0-9a-fA-F]+)/.exec(bs);
    if (hard) shadow = { shadow: "hard", dx: +hard[1]!, dy: +hard[2]!, color: hard[3]!, blur: 0 };
    else if (glow) shadow = { shadow: "glow", dx: 0, dy: 0, color: glow[2]!, blur: +glow[1]! };
    else shadow = { ...shadow, shadow: "soft" };
  }
  return { fill: String(css.background), border: m ? parseFloat(m[1]!) : 0, edge: m ? m[2]! : theme.color.border, shadow, css };
}

/** Sombra de una tarjeta SVG (se dibuja antes que ella): filo duro desplazado o halo de acento en capas. `soft` y `none` no dibujan nada. */
export function SvgShadow(p: { shadow: Edge; x: number; y: number; width: number; height: number; rx: number }): React.ReactElement | null {
  const s = p.shadow;
  if (s.shadow === "hard") return <rect x={p.x + s.dx} y={p.y + s.dy} width={p.width} height={p.height} rx={p.rx} fill={s.color} />;
  if (s.shadow === "glow") {
    const k = Math.max(8, s.blur / 2);
    return (
      <g fill="none" stroke={s.color}>
        {[3, 2, 1].map((j) => <rect key={j} x={p.x - k * j * 0.5} y={p.y - k * j * 0.5} width={p.width + k * j} height={p.height + k * j} rx={p.rx + k * j * 0.5} strokeWidth={k * 0.5} opacity={0.22 / j} />)}
      </g>
    );
  }
  return null;
}

/**
 * Sombra de un elemento HTML que hoy no lleva ninguna (burbujas, filas): se conserva solo la que el estilo cambia (filo duro o halo)
 * y se descarta la suave del tema, así el estilo por defecto no agrega nada.
 */
export function bareShadow(p: ParsedSurface): string | undefined {
  return p.shadow.shadow === "hard" || p.shadow.shadow === "glow" ? String(p.css.boxShadow) : undefined;
}

/**
 * Entrada del tema (`motion.entrance`, con `native` de la pieza como valor de `auto`) combinada con un traslado propio `offY` (px) de la
 * pieza, en un solo `transform`. Si la entrada es vertical (la de siempre) las dos distancias se suman SIN redondear por separado, así con
 * el estilo por defecto el marcado es el de antes. Devuelve solo `transform` y `clipPath`: la opacidad la sigue decidiendo la pieza.
 */
export function entranceWithOffset(theme: Theme, p: number, index: number, o: EntranceOptions & { curve?: (p: number) => number }, offY = 0): React.CSSProperties {
  const st = resolveStyle(theme).motion;
  const clamped = Math.min(1, Math.max(0, p));
  const e = entrance(theme, clamped, index, { ...o, round: false });
  const vertical = e.transform === undefined || /^translateY\(/.test(String(e.transform));
  const out: React.CSSProperties = {};
  if (vertical) {
    // Con la entrada propia (`auto`) rige la curva de la pieza (`curve`, que puede pasarse de 1); con otra, el asentado con rebote del diseño.
    const q = st.entrance === "auto" && o.curve ? o.curve(p) : settle(clamped, st.overshoot);
    const dy = e.transform === undefined ? 0 : (1 - q) * (o.distance ?? 24);
    const t = xform({ y: offY + dy });
    if (t) out.transform = t;
  } else {
    const t = [xform({ y: offY }), e.transform].filter(Boolean).join(" ");
    if (t) out.transform = t;
  }
  if (e.clipPath) out.clipPath = e.clipPath;
  return out;
}
