import { borderWidth, entrance, surfaceStyle, textStyle, useTheme } from "../themes";
import React from "react";
import { clamp, themeEasing, useFrameOr } from "./util";
import { kf } from "./kf";
import { Numeral } from "./Numeral";

/** Cuánto ocultar el titular según la escala de cámara: 0 en `threshold`, 1 en `threshold + range`. */
export function hideFromScale(scale: number, threshold = 1, range = 0.08): number {
  return clamp((scale - threshold) / range, 0, 1);
}

/**
 * Píldora arriba a la izquierda con el titular de la escena; se aparta (fundido) cuando `hide` va de 0 a 1.
 * `layout="stacked"` (por defecto) apila el subtítulo bajo el título; `layout="inline"` lo pone en la misma línea, en una sola píldora: "04 Nombre · línea".
 * `size`: `"md"` (por defecto) o `"sm"` (85 % de la letra, los huecos y el relleno; el subtítulo apilado queda en ~19 px a 1080p).
 * `gradientLoop`: cuadros de un vaivén del degradado del número (sin él, el de `style.decor.gradientLoop` del tema; 0 = quieto).
 *
 * El aspecto sale del design system (`theme.style`): la píldora es `surfaceStyle(theme, "headline")` (forma de las esquinas, relleno
 * sólido, vidrio, contorno o teñido, borde y sombra); el título lleva `textStyle("title")` (peso e interletrado); el subtítulo,
 * `textStyle("eyebrow")` (mayúsculas e interletrado); el número, `numeralStyle` (degradado, sólido, contorno o atenuado); y la entrada,
 * `entrance` (por defecto desliza 30 px desde la izquierda; el tema puede pedir fundido, escala, subida o cortina). La letra, los
 * huecos y el tamaño exterior de la píldora no cambian con el estilo: un borde más grueso se compensa con el relleno.
 */
export function DockedHeadline({
  index,
  title: titleText,
  subtitle,
  frame,
  start = 0,
  hide = 0,
  layout = "stacked",
  size = "md",
  gradientLoop,
}: {
  index: number;
  title: string;
  subtitle?: string;
  frame?: number;
  start?: number;
  hide?: number;
  layout?: "stacked" | "inline";
  size?: "md" | "sm";
  gradientLoop?: number;
}) {
  const theme = useTheme();
  const k = size === "sm" ? 0.85 : 1;
  const caption = theme.type.caption * k, eyebrow = theme.type.eyebrow * k;
  const f = useFrameOr(frame);
  const a = kf(f, [start, start + 18], [0, 1], themeEasing(theme.motion.easing.out)) * (1 - clamp(hide, 0, 1));
  if (a <= 0) return null;
  // En reposo (a = 1) la píldora no lleva `opacity` ni `transform`: con `opacity: 0.999` o `translateX(-0px)` Chromium la
  // compone en una capa propia y la rasteriza distinto según el historial de cuadros (con la cámara quieta en escala 1 se veía).
  const resting = a >= 0.9995;
  const surf = surfaceStyle(theme, "headline");
  // El borde engrosado (o quitado) se compensa con el relleno para que el tamaño exterior no dependa del estilo (nominal: 1 px).
  const d = borderWidth(theme, "headline") - 1;
  const style: React.CSSProperties = {
    position: "absolute",
    left: theme.safe.x / 2,
    top: theme.safe.y / 2,
    display: "flex",
    alignItems: "center",
    gap: caption * 0.5,
    padding: `${eyebrow * 0.45 - d}px ${caption * 0.9 - d}px ${eyebrow * 0.45 - d}px ${eyebrow * 0.5 - d}px`,
    ...surf,
    ...(resting ? {} : entrance(theme, a, 0, { native: "slide", distance: 30, round: false })),
    zIndex: 90,
  };
  const title = { fontSize: caption, ...textStyle(theme, "title"), color: theme.color.text, lineHeight: 1.15 };
  const sub = (size: number, lineHeight: number) => ({ fontSize: size, color: theme.color.textMuted, ...textStyle(theme, "eyebrow"), lineHeight });
  return (
    <div key={resting ? "rest" : "anim"} style={style}>
      <Numeral loop={gradientLoop} frame={f} on={typeof surf.background === "string" ? surf.background : undefined} style={{ fontSize: caption, fontWeight: theme.font.weights.stat }}>{String(index).padStart(2, "0")}</Numeral>
      {layout === "inline" ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: eyebrow * 0.4, whiteSpace: "nowrap" }}>
          <span style={title}>{titleText}</span>
          {subtitle && (
            <>
              <span style={{ fontSize: eyebrow, color: theme.color.textMuted, lineHeight: 1.15 }}>·</span>
              <span style={sub(eyebrow, 1.15)}>{subtitle}</span>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={title}>{titleText}</span>
          {subtitle && <span style={sub(eyebrow * 0.85, 1.2)}>{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
