import { useTheme, withAlpha } from "../themes";

/**
 * Viñeta suave en el color de acento del tema; `amount` va de 0 a 1.
 * Es un degradado transparente en el centro: nunca tapa texto, así que se la excluye de la regla `covered` de `qa`
 * (que trata todo fondo con degradado como opaco).
 */
export function Vignette({ amount }: { amount: number }) {
  const theme = useTheme();
  if (amount <= 0) return null;
  return (
    <div
      data-qa-ignore="covered"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: `radial-gradient(ellipse at center, transparent 45%, ${withAlpha(theme.color.accent, 0.22 * amount)} 100%)`,
      }}
    />
  );
}
