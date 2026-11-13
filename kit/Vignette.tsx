import { useTheme, withAlpha } from "../themes";

/** Viñeta suave en el color de acento del tema; `amount` va de 0 a 1. */
export function Vignette({ amount }: { amount: number }) {
  const theme = useTheme();
  if (amount <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: `radial-gradient(ellipse at center, transparent 45%, ${withAlpha(theme.color.accent, 0.22 * amount)} 100%)`,
      }}
    />
  );
}
