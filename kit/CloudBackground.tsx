import { random } from "../engine";
import { useTheme } from "../themes";
import { useFrameOr } from "./util";

/** Manchas difuminadas a la deriva con los colores de `theme.cloud`; posición y deriva salen de `random(seed)` y del cuadro. */
export function CloudBackground({
  frame,
  opacity,
  count = 6,
  seed = "clouds",
  width = 1920,
  height = 1080,
}: {
  frame?: number;
  opacity?: number;
  count?: number;
  seed?: string;
  width?: number;
  height?: number;
}) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const colors = theme.cloud.colors;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", opacity: opacity ?? theme.cloud.opacity }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const size = 500 + r("s") * 500;
        const x = r("x") * width + Math.sin(f / (90 + r("px") * 80) + r("ph") * 6.28) * 120;
        const y = r("y") * height + Math.cos(f / (110 + r("py") * 80) + r("pv") * 6.28) * 90;
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
              background: colors[i % colors.length],
              filter: "blur(110px)",
            }}
          />
        );
      })}
    </div>
  );
}
