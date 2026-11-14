import { resolveColor, useTheme, vignetteColor, vignetteStrength, withAlpha } from "../themes";

/**
 * Viñeta suave; `amount` va de 0 a 1 (por ejemplo, creciendo con el zoom).
 * Por defecto va en el color que declara el design system (`style.decor.vignetteColor`, el acento si no dice otra cosa). `color` elige otro para esa escena: un rol del tema (`"bg"`, `"text"`, `"accent2"`, `"data.estado"`)
 * o un color sacado del tema. `strength` multiplica la intensidad, y el design system la multiplica otra vez (`style.decor.vignette`: 0 la apaga; 1 = la de siempre; la opacidad del borde es `0,22 * strength * amount`, con tope 1):
 * en una interfaz oscura usá `color="bg"` o un neutro y un `strength` bajo para no teñirla.
 * Es un degradado de cuadro completo, transparente en el centro y cada vez más opaco hacia los bordes (hasta `0,22 * strength * amount`
 * de opacidad en la esquina): **sí cae sobre el texto** que esté cerca de un borde y lo oscurece o lo tiñe, y con un `amount` alto y un
 * `strength` mayor que 1 puede bajar el contraste de un rótulo en la esquina. No es un fondo opaco: lleva `data-qa-ignore="covered"` solo para
 * que `qa` no la cuente como capa que tapa; **no** deja de mirarse el texto de abajo (contraste, solapes, recortes se siguen juzgando).
 * Con el design system `editorial` (`decor.vignette: 0`) no se dibuja. Una escena no puede depender de ella para que algo "pase" el control:
 * probala también sin viñeta (`--themes all`) y mirá la línea de juzgados de `qa`.
 */
export function Vignette({ amount, color, strength = 1 }: { amount: number; color?: string; strength?: number }) {
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
        background: `radial-gradient(ellipse at center, transparent 45%, ${withAlpha(resolveColor(theme, color ?? vignetteColor(theme)), alpha)} 100%)`,
      }}
    />
  );
}
