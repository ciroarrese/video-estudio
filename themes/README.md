# themes/

Capa que permite renderizar el mismo kit con cualquier design system. Solo depende de React; no importa nada de `engine/`.

- `neutral`: tema por defecto (claro, sistema de fuentes, azul/violeta).
- `dark`: variante oscura.
- `themeFromTokens(input, base = neutral)`: crea un `Theme` desde tokens.
- `themeFromTokensWithReport(input, base)`: igual, y devuelve `{ theme, report }` con `mapped` (roles tomados de los tokens), `fallback` (roles que quedaron con el valor del tema base), `derived` (calculados, p. ej. `onAccent`) y `warnings` (colores inválidos ignorados y fallas de contraste).
- `ThemeProvider`, `useTheme()` (devuelve `neutral` sin proveedor) y `withAlpha(color, alpha)`.
- `checkTheme(theme)`: avisos WCAG (texto/fondo, texto atenuado/fondo, `onAccent`/`accent`, mínimo 4.5).

## Crear un tema desde los tokens de un design system

Acepta JSON (estilo W3C con `$value`, o plano) o CSS con variables. Alias reconocidos: `primary`/`brand` → `accent`, `background` → `bg`, `foreground` → `text`, `error` → `danger`, `font-family`, `radius-*`, `shadow-*`, `chart-1..n`. Los colores válidos son hex, `rgb()`/`rgba()` y `hsl()`/`hsla()`; lo demás se ignora con un aviso.

```tsx
import { themeFromTokensWithReport, checkTheme, ThemeProvider } from "./themes";

const { theme, report } = themeFromTokensWithReport(`
  :root {
    --color-primary: #e11d48;
    --color-background: #ffffff;
    --color-foreground: #111111;
    --font-family: "Inter", sans-serif;
    --radius-lg: 24px;
  }
`);

console.log(report.fallback); // qué roles faltaron
console.log(checkTheme(theme)); // [] si el contraste es suficiente

<ThemeProvider theme={theme}>{/* escenas */}</ThemeProvider>;
```

Los tokens en JSON se pasan igual: `themeFromTokens({ color: { accent: { $value: "#e11d48" } } })`.

Las fuentes locales se declaran en `font.files` (`{ weight, src }`). No se incluyen fuentes ni valores de marca en este repo.

## Un tema distinto para una escena o un subárbol

`ThemeProvider` se puede anidar: el más cercano gana, y `useTheme()` devuelve el tema del ámbito donde se la llama. Las piezas de `kit/`, los efectos de `fx/` (incluidos los de canvas, que leen el tema al dibujar) y la medición de texto lo respetan. Para el cambio de tema por escena, `kit/` ofrece `ThemeScope`, que es el mismo proveedor más lo que hace falta con otro tema:

```tsx
import { ThemeScope } from "./kit";
import { dark } from "./themes";

<ThemeScope theme={dark} paint style={{ width: 860, height: 660 }}>{/* herramienta oscura */}</ThemeScope>
```

- `paint` pinta una superficie con fondo, texto y tipografía del tema (sin `paint` solo cambia el tema).
- Si el tema declara `font.files`, declara su `@font-face` y frena la captura (`holdRender`) hasta que carguen; esto vale también para `Stage`.
- `checkTheme` se corre por tema: cada ámbito tiene su propio informe.
- `themes/` no importa nada de `engine/`, por eso `ThemeScope` vive en `kit/`.

Ejemplo: `examples/theme-scope`.
