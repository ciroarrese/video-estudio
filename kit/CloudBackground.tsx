import { random, useVideoConfig } from "../engine";
import { backgroundLayer, resolveColor, resolveStyle, useTheme } from "../themes";
import type { CloudBlob } from "../themes";
import { useFrameOr } from "./util";

/** Lo que una escena puede elegir del fondo de nubes; lo que falte sale de `theme.cloud`. */
export type CloudOptions = {
  /** Colores de las manchas: roles del tema (`accent`, `data.estado`, `chart[2]`) o colores sacados del tema. */
  colors?: string[];
  opacity?: number;
  /** Cantidad del reparto sembrado (se ignora si hay `blobs`). */
  count?: number;
  seed?: string;
  /** Manchas explícitas (`x`, `y` en fracciones del cuadro, `size` en px): reemplazan al reparto sembrado. */
  blobs?: CloudBlob[];
  /** Desenfoque en px (por defecto el de `theme.cloud.blur`, y si el tema no lo declara, 110). */
  blur?: number;
  /**
   * Deriva: multiplicador de la velocidad del vaivén de las manchas (y de su amplitud, hasta el doble), de 0 (quietas) a 4. Por defecto `theme.style.background.drift` (1 = el movimiento de
   * siempre, que en un video corto casi no se nota; con 2 a 3 las nubes se ven moverse sin distraer).
   */
  drift?: number;
};

/**
 * Manchas difuminadas a la deriva con los colores de `theme.cloud`; posición y deriva salen de `random(seed)` y del cuadro.
 * Cada propiedad (`colors`, `count`, `seed`, `blobs`, `opacity`, `blur`) pisa a la de `theme.cloud`; sin ninguna, el resultado es el de siempre.
 * Con `blobs` el reparto es explícito y la deriva sigue saliendo de la semilla y el cuadro. Es determinista en todos los casos.
 * `drift` (por defecto `style.background.drift`, 1) escala la velocidad (y la amplitud, hasta el doble) del vaivén; con 1 el resultado es idéntico al de antes.
 * La opacidad por defecto es `theme.cloud.opacity` por `style.background.intensity` (`backgroundLayer(theme).cloudOpacity`).
 * `width`/`height` (el área donde se reparten las manchas) son por defecto el tamaño del cuadro del video (`useVideoConfig()`):
 * en vertical o cuadrado las nubes se acomodan al cuadro en vez de quedar recortadas como si fuera 1920 x 1080.
 */
export function CloudBackground({
  frame,
  opacity,
  count,
  seed,
  colors: colorsProp,
  blobs: blobsProp,
  blur: blurProp,
  drift: driftProp,
  width,
  height,
}: CloudOptions & {
  frame?: number;
  width?: number;
  height?: number;
}) {
  const theme = useTheme();
  const cfg = useVideoConfig();
  const W = width ?? cfg.width, H = height ?? cfg.height;
  const f = useFrameOr(frame);
  const drift = Math.min(4, Math.max(0, driftProp ?? resolveStyle(theme).background.drift));
  const fd = f * drift; // con drift 1 es el mismo cuadro: mismo valor, mismos píxeles que antes
  const blur = blurProp ?? theme.cloud.blur ?? 110;
  const colors = (colorsProp ?? theme.cloud.colors).map((c) => resolveColor(theme, c));
  const sd = seed ?? theme.cloud.seed ?? "clouds";
  const blobs = blobsProp ?? theme.cloud.blobs;
  const n = blobs?.length ? blobs.length : count ?? theme.cloud.count ?? 6;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", opacity: opacity ?? backgroundLayer(theme).cloudOpacity }}>
      {Array.from({ length: n }, (_, i) => {
        const r = (k: string) => random(`${sd}-${i}-${k}`);
        const b = blobs?.[i];
        const size = b ? b.size ?? 700 : 500 + r("s") * 500;
        const bx = b ? b.x * W : r("x") * W;
        const by = b ? b.y * H : r("y") * H;
        const x = bx + Math.sin(fd / (90 + r("px") * 80) + r("ph") * 6.28) * (120 * Math.min(2, Math.max(1, drift)));
        const y = by + Math.cos(fd / (110 + r("py") * 80) + r("pv") * 6.28) * (90 * Math.min(2, Math.max(1, drift)));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: theme.radius.pill,
              background: b?.color ? resolveColor(theme, b.color) : colors[i % colors.length],
              filter: `blur(${blur}px)`,
            }}
          />
        );
      })}
    </div>
  );
}
