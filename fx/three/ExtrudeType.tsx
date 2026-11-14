import type React from "react";
import { Easing, lerp, mix, styleKey, sub, xform } from "../core";
import { useThreeFx } from "./common";
import type { ThreeProps } from "./common";

export type ExtrudeTypeProps = ThreeProps & {
  text?: string;
  /** Tamaño de letra en px; por defecto el de héroe del tema. */
  fontSize?: number;
  /** Capas apiladas (más = más profundidad). */
  layers?: number;
  /** Separación entre capas en px. */
  step?: number;
};

/**
 * Texto con extrusión profunda: capas cuya dirección de desplazamiento barre con el tiempo. El carácter lo da `style.depth.extrude`:
 * `stack` (capas con degradé de acento, como siempre; con `line.glow` suma un halo), `long-shadow` (una sombra de un solo tono que se
 * desvanece en el fondo), `outline-stack` (copias de solo contorno que tapan a las de atrás) o `none` (texto plano).
 */
export function ExtrudeType(p: ExtrudeTypeProps) {
  const { t, width, height, theme, pal, pen, k } = useThreeFx(p, { width: 1500, height: 560, duration: 75 });
  const text = p.text ?? "Volumen";
  const fontSize = p.fontSize ?? theme.type.hero * 2.1;
  const mode = pen.extrude;
  const n = mode === "none" ? 0 : p.layers ?? 46;
  const step = p.step ?? fontSize * 0.01;
  const depth = Easing.out(sub(t, 0, 0.3));
  // La dirección barre de arriba a la izquierda hasta abajo a la derecha (grados de pantalla, y hacia abajo).
  const ang = (lerp(-150, 52, Easing.inOut(sub(t, 0.05, 1))) * Math.PI) / 180;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const shadows: string[] = [];
  if (mode === "stack" || mode === "long-shadow") {
    for (let j = 1; j <= n; j++) {
      const d = j * step * depth;
      const col =
        mode === "stack"
          ? mix(mix(pal.accent, pal.lightest, 0.25), mix(pal.accent, pal.darkest, 0.6), j / n)
          : mix(mix(pal.accent, pal.darkest, 0.45), pal.bg, (j / n) * 0.92);
      shadows.push(`${(dx * d).toFixed(2)}px ${(dy * d).toFixed(2)}px 0 ${col}`);
    }
    if (mode === "stack" && pen.glow > 0 && depth > 0) {
      // Halo de neón bajo la pila: dos desenfoques del acento suavizado hacia el fondo (el desenfoque es de CSS, estático).
      const reach = n * step * depth;
      shadows.push(`${(dx * reach).toFixed(2)}px ${(dy * reach).toFixed(2)}px ${(fontSize * 0.1 * pen.glow).toFixed(1)}px ${mix(pal.accent, pal.bg, 0.2)}`);
      shadows.push(`${(dx * reach).toFixed(2)}px ${(dy * reach).toFixed(2)}px ${(fontSize * 0.28 * pen.glow).toFixed(1)}px ${mix(pal.accent, pal.bg, 0.55)}`);
    }
  }
  // Centro óptico: las capas se corren hacia un lado; se compensa a mitad de camino.
  const reach = n * step * depth;
  const faceStyle: React.CSSProperties = {
    fontFamily: theme.font.family,
    fontWeight: theme.font.weights.stat,
    fontSize,
    lineHeight: 1,
    letterSpacing: "-0.02em",
    color: pal.ink,
    whiteSpace: "nowrap",
  };
  const textStyle: React.CSSProperties = {
    transform: xform({ x: (-dx * reach) / 2, y: (-dy * reach) / 2 }),
    ...faceStyle,
    ...(shadows.length ? { textShadow: shadows.join(", ") } : {}),
  };
  // Copias de contorno (de lejos a cerca): relleno del fondo para que cada una tape a las de atrás; aviso a `qa` de que son adorno.
  const echoes: React.ReactNode[] = [];
  if (mode === "outline-stack") {
    const m = 12;
    for (let j = m; j >= 1; j--) {
      const d = (j / m) * reach;
      const st: React.CSSProperties = {
        position: "absolute",
        left: 0,
        top: 0,
        ...faceStyle,
        color: pal.bg,
        WebkitTextStroke: `${(1.6 * k * pen.w).toFixed(2)}px ${mix(pal.accent, pal.ink, 0.15 + 0.5 * (1 - j / m))}`,
        transform: xform({ x: dx * d, y: dy * d }),
      };
      echoes.push(
        // Copia de relieve del mismo texto: queda detrás de la copia real (la última, sin marca, que sí se juzga) y la pisa a propósito.
        <div key={`${j}:${styleKey(st)}`} aria-hidden="true" data-qa-decor="" data-qa-ignore="overlap covered" style={st}>
          {text}
        </div>,
      );
    }
  }
  return (
    <div style={{ position: "relative", width, height, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", ...p.style }}>
      {echoes.length ? (
        <div key={styleKey(textStyle)} style={{ ...textStyle, position: "relative" }}>
          {echoes}
          <span style={{ position: "relative" }}>{text}</span>
        </div>
      ) : (
        <div key={styleKey(textStyle)} style={textStyle}>
          {text}
        </div>
      )}
    </div>
  );
}
