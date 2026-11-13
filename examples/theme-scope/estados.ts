import { dark, editorial, neon, neutral, papel, themeFromTokens } from "../../themes";
import type { ResolvedTheme, Theme } from "../../themes";

// Colores de datos de la herramienta recreada: estados que no tienen rol en `theme.color`.
// Se declaran como tokens y se nombran en `data`; las escenas los leen con `useTheme().data.<nombre>`, sin `#hex`.
const CLARO = `:root {
  --name: neutral;
  --data-estado-ok: #1b7a47;
  --data-estado-alerta: #a35f00;
  --data-estado-fallo: #c92a2a;
  --data-ficha-fondo: #e3f4ea;
}`;
const OSCURO = `:root {
  --name: dark;
  --data-estado-ok: #4cd08a;
  --data-estado-alerta: #f2b84b;
  --data-estado-fallo: #ff7b7b;
  --data-ficha-fondo: #17301f;
}`;

/** El mismo tema con los colores de estado de la herramienta (según sea claro u oscuro). */
export function conEstados(base: Theme): ResolvedTheme {
  return themeFromTokens(base === dark || base === neon || base.name === "dark" || base.name === "neon" ? OSCURO : CLARO, base, {
    data: {
      estadoOk: { on: ["surface", "bg"], min: 4.5 },
      estadoAlerta: { on: ["surface", "bg"], min: 4.5 },
      estadoFallo: { on: ["surface", "bg"], min: 4.5 },
      fichaFondo: { on: ["surface"], min: 1.05 },
    },
  });
}

/** Los temas con `theme.style` (editorial, neón, papel) también se pueden usar como ámbito: la herramienta toma su forma y su superficie. */
export const ESTADOS = { neutral: conEstados(neutral), dark: conEstados(dark), editorial: conEstados(editorial), neon: conEstados(neon), papel: conEstados(papel) };
