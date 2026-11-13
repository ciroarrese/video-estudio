// Plantilla del tema de un video. En la etapa 2 del skill se reemplaza por el tema armado
// desde los tokens de la persona (ver videos/<slug>/theme.ts y themes/README.md).
//
//   import { themeFromTokensWithReport, checkTheme } from "../../themes";
//   const { theme: t, report } = themeFromTokensWithReport(tokens);
//
// Mientras tanto se usa el tema neutro, que ya cumple contraste.
import { neutral } from "../themes";
import type { Theme } from "../themes";

export const theme: Theme = neutral;
