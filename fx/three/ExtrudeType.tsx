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

/** Texto con extrusión profunda: capas apiladas cuya dirección de desplazamiento barre con el tiempo. */
export function ExtrudeType(p: ExtrudeTypeProps) {
  const { t, width, height, theme, pal } = useThreeFx(p, { width: 1500, height: 560, duration: 75 });
  const text = p.text ?? "Volumen";
  const fontSize = p.fontSize ?? theme.type.hero * 2.1;
  const n = p.layers ?? 46;
  const step = p.step ?? fontSize * 0.01;
  const depth = Easing.out(sub(t, 0, 0.3));
  // La dirección barre de arriba a la izquierda hasta abajo a la derecha (grados de pantalla, y hacia abajo).
  const ang = (lerp(-150, 52, Easing.inOut(sub(t, 0.05, 1))) * Math.PI) / 180;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const shadows: string[] = [];
  for (let j = 1; j <= n; j++) {
    const d = j * step * depth;
    const col = mix(mix(pal.accent, pal.lightest, 0.25), mix(pal.accent, pal.darkest, 0.6), j / n);
    shadows.push(`${(dx * d).toFixed(2)}px ${(dy * d).toFixed(2)}px 0 ${col}`);
  }
  // Centro óptico: las capas se corren hacia un lado; se compensa a mitad de camino.
  const reach = n * step * depth;
  const textStyle: React.CSSProperties = {
    transform: xform({ x: (-dx * reach) / 2, y: (-dy * reach) / 2 }),
    fontFamily: theme.font.family,
    fontWeight: theme.font.weights.stat,
    fontSize,
    lineHeight: 1,
    letterSpacing: "-0.02em",
    color: pal.ink,
    whiteSpace: "nowrap",
    textShadow: shadows.join(", "),
  };
  return (
    <div style={{ position: "relative", width, height, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", ...p.style }}>
      <div key={styleKey(textStyle)} style={textStyle}>
        {text}
      </div>
    </div>
  );
}
