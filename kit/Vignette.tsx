import { resolveColor, useTheme, vignetteStrength, withAlpha } from "../themes";

/**
 * Viñeta suave; `amount` va de 0 a 1 (por ejemplo, creciendo con el zoom).
 * Por defecto va en el color de acento del tema. `color` elige otro: un rol del tema (`"bg"`, `"text"`, `"accent2"`, `"data.estado"`)
 * o un color sacado del tema. `strength` multiplica la intensidad, y el design system la multiplica otra vez (`style.decor.vignette`: 0 la apaga; 1 = la de siempre; la opacidad del borde es `0,22 * strength * amount`, con tope 1):
 * en una interfaz oscura usá `color="bg"` o un neutro y un `strength` bajo para no teñirla.
 * Es un degradado transparente en el centro: nunca tapa texto, así que se la excluye de la regla `covered` de `qa`
 * (que trata todo fondo con degradado como opaco).
 */
export function Vignette({ amount, color = "accent", strength = 1 }: { amount: number; color?: string; strength?: number }) {
  const theme = useTheme();
  const k = strength * vignetteStrength(theme);
  if (amount <= 0 || k <= 0) return null;
  const alpha = Math.min(1, 0.22 * k * amount);
  return (
    <div
      data-qa-ignore="covered"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: `radial-gradient(ellipse at center, transparent 45%, ${withAlpha(resolveColor(theme, color), alpha)} 100%)`,
      }}
    />
  );
}
