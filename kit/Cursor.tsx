import { Easing } from "../engine";
import { useTheme } from "../themes";
import { kf, track } from "./kf";
import { themeEasing, useFrameOr } from "./util";

/** Cursor (una sola clave = fijo; `show` más corto de 20 cuadros acorta el fundido) que recorre `keys` ([cuadro, x, y]) con una onda de clic en el acento del tema en cada cuadro de `clicks`. */
export function Cursor({
  frame,
  keys,
  clicks = [],
  show,
}: {
  frame?: number;
  keys: [number, number, number][];
  clicks?: number[];
  show: [number, number];
}) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  // Posición en píxeles enteros: con un `scale()` en un ancestro, Chromium rasteriza la flecha SVG de forma distinta
  // según el historial de cuadros si el `left`/`top` es fraccionario (falla `--check`); ver docs/reglas.md.
  const { x, y } = track(f, keys);
  const out = themeEasing(theme.motion.easing.out);
  const len = show[1] - show[0];
  const visible =
    len <= 0
      ? f === show[0] ? 1 : 0
      : len < 20
        ? kf(f, [show[0], show[0] + len / 2, show[1]], [0, 1, 0], Easing.linear)
        : kf(f, [show[0], show[0] + 10, show[1] - 10, show[1]], [0, 1, 1, 0], Easing.linear);
  if (visible <= 0) return null;
  const press = clicks.reduce((a, c) => a + kf(f, [c - 3, c, c + 6], [0, 0.15, 0]), 0);
  // Opacidad y escala solo mientras la flecha entra, sale o se presiona (en reposo no queda `opacity: 1` ni `scale(1)`).
  const op = visible >= 0.9995 ? undefined : +visible.toFixed(4);
  const sc = +(1 - press).toFixed(4);
  const arrowStyle: React.CSSProperties = { position: "absolute", left: -4, top: -3, transform: sc === 1 ? undefined : `scale(${sc})`, transformOrigin: sc === 1 ? undefined : "4px 3px" };
  return (
    <div key={op === undefined ? "full" : "part"} style={{ position: "absolute", left: Math.round(x), top: Math.round(y), opacity: op, zIndex: 50, pointerEvents: "none" }}>
      {clicks.map((c) => {
        const p = kf(f, [c, c + 18], [0, 1], out);
        return (
          <div
            key={c}
            style={{
              position: "absolute",
              left: -30,
              top: -30,
              width: 60,
              height: 60,
              borderRadius: theme.radius.pill,
              border: `3px solid ${theme.color.accent}`,
              transform: `scale(${0.3 + p * 1.2})`,
              opacity: p > 0 && p < 1 ? 1 - p : 0,
            }}
          />
        );
      })}
      <svg
        width={34}
        height={40}
        viewBox="0 0 24 28"
        key={sc === 1 ? "rest" : "press"}
        style={arrowStyle}
      >
        <path d="M2 2l18 11-8 2-4 8z" fill={theme.color.text} stroke={theme.color.bg} strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </div>
  );
}
