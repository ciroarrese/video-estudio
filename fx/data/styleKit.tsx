import type React from "react";
import { surfaceParts, surfaceStyle } from "../../themes";
import type { ChartFill, SurfaceOptions, SurfaceRole, Theme } from "../../themes";

/*
 * Ayudas locales de `fx/data`, `fx/ui` y `fx/art` para leer `theme.style` desde piezas SVG o con rellenos propios.
 * Todas son puras. Las ayudas de `themes/` devuelven CSS (`surfaceStyle`), partes (`surfaceParts`) o descripciones (`chartFill`); acá se traducen
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

export interface SvgSurface {
  /** Relleno (`fill`). */
  fill: string;
  /** Grosor del borde nominal (0 = sin borde). Con el estilo por defecto es 1. */
  border: number;
  /** Color del borde. */
  edge: string;
  /** Sombra: `soft` es la del tema (los efectos SVG nunca la dibujaron: se ignora), `hard` filo desplazado, `glow` halo de acento. */
  shadow: Edge;
  /** Radio de las esquinas (px). */
  radius: number;
  /** El estilo de `surfaceStyle` tal como viene (para elementos HTML). */
  css: React.CSSProperties;
}

/**
 * Superficie de `surfaceParts(theme, role)` en la forma que usan los efectos SVG (`<rect>` con `fill`, `stroke` y `SvgShadow`). No lee CSS:
 * toma las partes que da el tema.
 */
export function svgSurface(theme: Theme, role: SurfaceRole, o: SurfaceOptions = {}): SvgSurface {
  const p = surfaceParts(theme, role, o);
  const sh = p.shadow;
  const shadow: Edge = { shadow: sh.kind, dx: sh.x, dy: sh.y, color: sh.color, blur: sh.blur };
  return { fill: p.fill, border: p.stroke?.width ?? 0, edge: p.stroke?.color ?? theme.color.border, shadow, radius: p.radius, css: surfaceStyle(theme, role, o) };
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
export function bareShadow(p: SvgSurface): string | undefined {
  return p.shadow.shadow === "hard" || p.shadow.shadow === "glow" ? String(p.css.boxShadow) : undefined;
}
