import React from "react";
import { borderWidth, cornerRadius, lineLook, readableOn, resolveColor, surfaceStyle, textStyle, useTheme } from "../themes";
import { mix } from "../fx/core/math";

/*
 * Piezas básicas de interfaz para recrear una herramienta (formularios, listas, avisos): chip, botón, avatar, tilde, fila de lista e íconos.
 * Todo sale del tema: colores por rol, esquinas y bordes por `cornerRadius`/`borderWidth`/`surfaceStyle`, letra por `textStyle`, trazos por
 * `style.line`. Son puras: el estado (apretado, tildado, dibujado) se pasa como un número 0 a 1 que calcula la escena con el cuadro.
 * No dibujan posiciones de escena: se ubican con el contenedor que las rodea.
 */

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";
const STATUS: Record<Exclude<Tone, "neutral" | "accent">, "success" | "warning" | "danger"> = { success: "success", warning: "warning", danger: "danger" };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// ---------- Chip ----------

export type ChipProps = {
  children?: React.ReactNode;
  /**
   * `neutral` (superficie `chip` del design system), `accent` (relleno de acento) o un estado (`success`, `warning`, `danger`: la superficie
   * `chip` con un punto del color del estado antes del texto; así el contraste del texto no depende del color del estado).
   */
  tone?: Tone;
  /** Chip encendido: borde de acento (lo que `surfaceStyle` llama `on`). Solo con `tone="neutral"`. */
  on?: boolean;
  /** Tamaño de letra en px (por defecto `theme.type.caption`). Los espacios son proporcionales. */
  size?: number;
  style?: React.CSSProperties;
};

/** Píldora o etiqueta: un estado, una categoría, un filtro. La forma (píldora, redondeada, recta), el borde y la sombra los decide el tema. */
export function Chip({ children, tone = "neutral", on, size, style }: ChipProps) {
  const theme = useTheme();
  const fs = size ?? theme.type.caption;
  const base: React.CSSProperties =
    tone === "accent"
      ? { borderRadius: cornerRadius(theme, "chip"), background: theme.color.accent, color: theme.color.onAccent }
      : { ...surfaceStyle(theme, "chip", { on: !!on }), color: theme.color.text };
  const dot = tone !== "neutral" && tone !== "accent" ? theme.color[STATUS[tone]] : null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3em",
        boxSizing: "border-box",
        padding: "0.25em 0.8em",
        fontSize: fs,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        ...textStyle(theme, "label"),
        ...base,
        ...style,
      }}
    >
      {dot && <span style={{ width: "0.5em", height: "0.5em", borderRadius: theme.radius.pill, background: dot, flexShrink: 0 }} />}
      {children}
    </span>
  );
}

// ---------- Button ----------

export type ButtonProps = {
  children?: React.ReactNode;
  /** `primary` (relleno de acento) o `secondary` (superficie del tema). */
  variant?: "primary" | "secondary";
  /** 0 a 1: cuánto está apretado (el relleno pasa del acento a `accent2`; con `secondary`, a `surfaceAlt`). La escena lo calcula con el cuadro (`kf`). */
  pressed?: number;
  /** Tamaño de letra en px (por defecto `theme.type.caption`). */
  size?: number;
  /** Un ícono antes del texto (`<Icon name="calendar" />`). */
  icon?: React.ReactNode;
  style?: React.CSSProperties;
};

/** Botón de acción. Esquinas: rol `control` del design system; el apretado cambia el color, no el tamaño (nada de `scale` sobre texto). */
export function Button({ children, variant = "primary", pressed = 0, size, icon, style }: ButtonProps) {
  const theme = useTheme();
  const fs = size ?? theme.type.caption;
  const p = clamp01(pressed);
  const radius = cornerRadius(theme, "control");
  const primary = variant === "primary";
  const bw = borderWidth(theme, "chip");
  const fill = primary ? (p > 0 ? mix(theme.color.accent, theme.color.accent2, p) : theme.color.accent) : p > 0 ? mix(theme.color.surface, theme.color.surfaceAlt, p) : theme.color.surface;
  const ink = primary ? readableOn(theme, fill, { candidates: [theme.color.onAccent, theme.color.text, theme.color.bg] }) : theme.color.text;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.45em",
        boxSizing: "border-box",
        padding: "0.55em 1.3em",
        fontSize: fs,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        borderRadius: radius,
        background: fill,
        color: ink,
        ...(bw > 0 ? { border: `${bw}px solid ${primary ? fill : theme.color.border}` } : {}),
        ...textStyle(theme, "label", { strong: true }),
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  );
}

// ---------- Avatar ----------

export type AvatarProps = {
  /** Nombre de la persona (ficticia): se dibuja su inicial. */
  name: string;
  /** Posición en la serie de colores del tema (`color.chart`); por defecto 0. */
  index?: number;
  /** Diámetro en px (por defecto 56). */
  size?: number;
  /** Anillo del color de la superficie (para apilar avatares que se pisan). */
  ring?: boolean;
  style?: React.CSSProperties;
};

/** Círculo con la inicial; el color sale de `color.chart` y la letra, del color más legible sobre él. */
export function Avatar({ name, index = 0, size = 56, ring, style }: AvatarProps) {
  const theme = useTheme();
  const series = theme.color.chart;
  const fill = series[((index % series.length) + series.length) % series.length] ?? theme.color.accent;
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "";
  const bw = borderWidth(theme, "chip") + 2;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxSizing: "border-box",
        width: size,
        height: size,
        borderRadius: theme.radius.pill,
        background: fill,
        color: readableOn(theme, fill),
        fontSize: Math.round(size * 0.46),
        lineHeight: 1,
        ...textStyle(theme, "label", { strong: true }),
        ...(ring ? { border: `${bw}px solid ${theme.color.surface}` } : {}),
        ...style,
      }}
    >
      {initial}
    </span>
  );
}

// ---------- Icon ----------

/** Nombres de los íconos propios. */
export const ICON_NAMES = ["calendar", "bell", "clock", "user", "check", "home", "search", "heart", "document", "message"] as const;
export type IconName = (typeof ICON_NAMES)[number];

type Shape = { t: "path"; d: string } | { t: "circle"; cx: number; cy: number; r: number } | { t: "rect"; x: number; y: number; w: number; h: number; rx: number };

/** Trazos de cada ícono en una caja de 24 x 24 (dibujados para este repo: formas geométricas simples). */
const GLYPHS: Record<IconName, Shape[]> = {
  calendar: [
    { t: "rect", x: 3.5, y: 5, w: 17, h: 15.5, rx: 2.5 },
    { t: "path", d: "M3.5 10.2h17" },
    { t: "path", d: "M8 3v4M16 3v4" },
  ],
  bell: [{ t: "path", d: "M5 17.5h14l-1.6-2.2V11a5.4 5.4 0 0 0-10.8 0v4.3z" }, { t: "path", d: "M10 20.3a2 2 0 0 0 4 0" }],
  clock: [{ t: "circle", cx: 12, cy: 12, r: 8.5 }, { t: "path", d: "M12 7v5l3.3 2" }],
  user: [{ t: "circle", cx: 12, cy: 8.5, r: 3.8 }, { t: "path", d: "M4.5 20c.6-4 3.7-6 7.5-6s6.9 2 7.5 6" }],
  check: [{ t: "path", d: "M5 12.5l4.5 4.5L19 7.5" }],
  home: [{ t: "path", d: "M4 11L12 4l8 7v9H4z" }, { t: "path", d: "M10 20v-6h4v6" }],
  search: [{ t: "circle", cx: 10.5, cy: 10.5, r: 6 }, { t: "path", d: "M15 15l5 5" }],
  heart: [{ t: "path", d: "M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10C19.5 15.4 12 20 12 20z" }],
  document: [{ t: "path", d: "M6.5 3.5H14l4.5 4.5v12.5h-12z" }, { t: "path", d: "M14 3.5V8h4.5" }, { t: "path", d: "M9.5 13h5M9.5 16.5h5" }],
  message: [{ t: "path", d: "M4.5 5h15a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H11l-4.5 3.5v-3.5h-2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" }],
};

export type IconProps = {
  name: IconName;
  /** Lado en px (por defecto 40). */
  size?: number;
  /** Color: un rol del tema (`text`, `accent`, `textMuted`...), `data.<nombre>` o un color sacado del tema. Por defecto `text`. */
  color?: string;
  /** 0 a 1: cuánto del trazo está dibujado (para que el ícono se dibuje solo con el cuadro). Por defecto 1: entero y sin propiedades de animación. */
  progress?: number;
  style?: React.CSSProperties;
};

/**
 * Ícono de trazo propio. Hereda del tema el color y el grosor: `style.line.weight` (fino, común, grueso) escala el trazo y `style.line.cap`
 * (`round` o `square`) decide las puntas y las uniones. No es una fuente de íconos: es un conjunto chico para recrear interfaces.
 */
export function Icon({ name, size = 40, color = "text", progress = 1, style }: IconProps) {
  const theme = useTheme();
  const look = lineLook(theme);
  const stroke = resolveColor(theme, color);
  const sw = +(1.75 * look.widthK).toFixed(3);
  const p = clamp01(progress);
  const draw = p < 1 ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: +(1 - p).toFixed(4) } : {};
  const common = { fill: "none", stroke, strokeWidth: sw, strokeLinecap: look.square ? ("square" as const) : ("round" as const), strokeLinejoin: look.square ? ("miter" as const) : ("round" as const), ...draw };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" data-ve-icon={name} style={{ display: "block", flexShrink: 0, ...style }}>
      {p > 0 &&
        GLYPHS[name].map((s, i) =>
          s.t === "path" ? <path key={i} d={s.d} {...common} /> : s.t === "circle" ? <circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} /> : <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...common} />,
        )}
    </svg>
  );
}

// ---------- Check ----------

export type CheckProps = {
  /** 0 a 1: cuánto del tilde está dibujado (por defecto 1). El círculo está siempre; el tilde se dibuja con el progreso. */
  progress?: number;
  /** Diámetro en px (por defecto 48). */
  size?: number;
  /** Rol del relleno (por defecto `accent`; `success` para un "listo"). */
  tone?: "accent" | "success";
  /** `false`: solo el contorno (casilla sin tildar), sin relleno. */
  filled?: boolean;
  style?: React.CSSProperties;
};

/** Tilde dentro de un círculo que se dibuja con el cuadro; las puntas del trazo siguen `style.line.cap`. */
export function Check({ progress = 1, size = 48, tone = "accent", filled = true, style }: CheckProps) {
  const theme = useTheme();
  const look = lineLook(theme);
  const fill = theme.color[tone];
  const ink = readableOn(theme, fill, { candidates: [theme.color.onAccent, theme.color.text, theme.color.bg] });
  const p = clamp01(progress);
  const sw = +(2.1 * look.widthK).toFixed(3);
  const draw = p < 1 ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: +(1 - p).toFixed(4) } : {};
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" data-ve-icon="check" style={{ display: "block", flexShrink: 0, ...style }}>
      {filled ? <circle cx={12} cy={12} r={11} fill={fill} /> : <circle cx={12} cy={12} r={10.2} fill="none" stroke={theme.color.border} strokeWidth={sw} />}
      {p > 0 && <path d="M6.8 12.6l3.7 3.7 6.9-7.6" fill="none" stroke={filled ? ink : fill} strokeWidth={sw} strokeLinecap={look.square ? "square" : "round"} strokeLinejoin={look.square ? "miter" : "round"} {...draw} />}
    </svg>
  );
}

// ---------- ListRow ----------

export type ListRowProps = {
  /** Texto principal. */
  title: React.ReactNode;
  /** Texto de apoyo debajo, atenuado. */
  detail?: React.ReactNode;
  /** Antes del texto: un `Avatar`, un `Icon`. */
  leading?: React.ReactNode;
  /** Al final de la fila: un `Chip`, un `Check`, una hora. */
  trailing?: React.ReactNode;
  /** Fila resaltada (la que se señala): fondo `surfaceAlt` con las esquinas de un control. */
  on?: boolean;
  /** Raya fina debajo (separador entre filas). */
  divider?: boolean;
  /** Tamaño del título en px (por defecto `theme.type.caption`); el detalle va a 0,8. */
  size?: number;
  style?: React.CSSProperties;
};

/**
 * Fila de lista: pieza a la izquierda, texto en el medio (con `minWidth: 0`, para que un nombre largo no empuje a la derecha),
 * pieza a la derecha. Ocupa el ancho del contenedor; el alto lo da el contenido (`style.height` lo fija si hace falta).
 */
export function ListRow({ title, detail, leading, trailing, on, divider, size, style }: ListRowProps) {
  const theme = useTheme();
  const fs = size ?? theme.type.caption;
  const line = Math.max(1, borderWidth(theme, "card"));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6em",
        boxSizing: "border-box",
        width: "100%",
        padding: "0.45em 0.7em",
        fontSize: fs,
        color: theme.color.text,
        ...(on ? { background: theme.color.surfaceAlt, borderRadius: cornerRadius(theme, "control") } : {}),
        ...(divider ? { borderBottom: `${line}px solid ${theme.color.border}` } : {}),
        ...style,
      }}
    >
      {leading}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.1em" }}>
        <span style={{ lineHeight: 1.2, ...textStyle(theme, "label", { strong: true }) }}>{title}</span>
        {detail !== undefined && detail !== null && <span style={{ fontSize: "0.8em", lineHeight: 1.2, color: theme.color.textMuted }}>{detail}</span>}
      </div>
      {trailing}
    </div>
  );
}
