# themes/

Capa que permite renderizar el mismo kit con cualquier design system. Solo depende de React; no importa nada de `engine/`.

- `neutral`: tema por defecto (claro, sistema de fuentes, azul/violeta).
- `dark`: variante oscura.
- `themeFromTokens(input, base = neutral)`: crea un `Theme` desde tokens.
- `themeFromTokensWithReport(input, base)`: igual, y devuelve `{ theme, report }` con `mapped` (roles tomados de los tokens), `fallback` (roles que quedaron con el valor del tema base), `derived` (calculados, p. ej. `onAccent`) y `warnings` (colores inválidos ignorados y fallas de contraste).
- `ThemeProvider`, `useTheme()` (devuelve `neutral` sin proveedor) y `withAlpha(color, alpha)`.
- `checkTheme(theme)`: avisos WCAG (texto/fondo, texto atenuado/fondo, `onAccent`/`accent`, acentos y estados, serie `chart` y colores de `theme.data`). Cada aviso trae `usedBy` y `suggestion` (ver "Informe de contraste").
- `resolveColor(theme, ref)`: resuelve un rol (`"accent"`), `"chart[2]"`, `"data.estado"` o un color válido; si no es ninguno, lanza un error que lista los roles.

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

## Colores de datos: `theme.data`

Una interfaz recreada necesita colores que no tienen rol en `theme.color` (estados, severidades, fondos de ficha) y las escenas no pueden llevar `#hex`. Se declaran en el tema y se leen con `useTheme().data.<nombre>`:

```tsx
const { theme, report } = themeFromTokensWithReport(CSS, base, {
  data: {
    estadoOk: "data-estado-ok",                    // nombre de un token (o un color, si no hay token con ese nombre)
    estadoBajo: { token: "severity-1", on: ["bg", "surface"], min: 4.5 }, // texto: 4.5 sobre bg y surface
    ficha: { color: "#22252b", on: ["surface"], min: 1.1 },               // valor propio
  },
  acknowledge: ["accent/bg"],
});
useTheme().data.estadoOk; // "#1b7a47"
useTheme().data.otro;     // Error: no hay un color de datos "otro". Declarados: estadoOk, estadoBajo, ficha.
```

- Los nombres son identificadores simples (letras y números, empezando con letra); uno que no existe lanza un error que lista los declarados, en lugar de dar `undefined` y un color en blanco.
- `on` son las superficies (`bg`, `surface`, `surfaceAlt`) sobre las que se dibuja (por defecto `surface`) y `min` el contraste que se le pide (3 por defecto, para rellenos y gráficos; 4.5 para texto). `checkTheme` revisa cada par como `data.<nombre>/<superficie>`.
- `report.data` lista cada color declarado (valor, token de origen y superficies); `report.mapped["data.<nombre>"]` dice de qué token salió. Un token que falta o un color inválido no declaran el nombre y quedan en `report.warnings`.
- Funciona dentro de `ThemeScope`: cada ámbito lee el `data` de su tema. Un tema armado a mano (`{ ...base, data: {...} }`) también sirve; `ThemeProvider` lo completa. `resolveTheme(theme)` hace eso mismo y devuelve la copia con `data` estricto y `type.ui` presente.
- Para un tema derivado, `themeFromTokens` hereda el `data` de la base.

## Escalones `type.display`

Entre `body` (44) y `h2` (72) había un hueco para textos grandes que no son titulares (cifras de una ficha, rótulos de pantalla completa). `theme.type.display` lo cubre: `sm` 48, `md` 56 y `lg` 64 px; un tema sin `display` recibe esos valores al usarse; con tokens: `--type-display-sm`, `--type-display-md`, `--type-display-lg`. Para un tamaño que no está en la escala, se deriva de un escalón con un factor (`type.stat * 0.8`, `type.body * 0.9`): eso es válido; un número suelto (`fontSize: 58`) no.

## Subescala `type.ui`

`theme.type.ui` (`xs` 15, `sm` 20, `md` 24 px) es para texto de **interfaces recreadas** (tablas, fichas, menús) que se lee con la cámara acercada, donde los escalones de la escala principal (el menor es `eyebrow`, 26) son demasiado grandes para lo que la interfaz real muestra. No es para texto que se lee en pantalla completa: ahí van `caption`, `body`, etc. Un tema sin `ui` recibe estos valores al usarse; con tokens: `--type-ui-xs`, `--type-ui-sm`, `--type-ui-md`. El control de calidad trata el texto chico que solo se lee con zoom como un asunto aparte del texto chico en pantalla completa; igual conviene que cada escena con `ui` tenga un acercamiento de cámara donde ese texto se lea.

## Nubes

`theme.cloud` trae `colors` (lista), `opacity` y, opcionales, `count` (reparto sembrado, 6 por defecto), `seed` y `blobs` (manchas explícitas `{ x, y, size?, color? }`, con `x`/`y` como fracción del cuadro: se acomodan solas a cada formato). Tokens: `--cloud-color-1..12` o `--cloud-colors: a, b, c`, `--cloud-count`, `--cloud-opacity` (`0.22` o `22%`), `--cloud-seed`, `--cloud-blob-1..24: x y [tamaño]` (entre comillas o sin ellas: `0.1 0.2 800` y `"0.1 0.2 800"` valen igual). Sin tokens de color, las nubes se derivan del acento (y de `accent2` si lo hay). `Stage` y `CloudBackground` permiten elegirlas por escena (ver `kit/README.md`).

## Texto legible sobre un relleno cualquiera: `readableOn`

`readableOn(theme, bg, { candidates? })` devuelve, entre los candidatos, el color con más contraste sobre `bg` (por defecto `text`, `onAccent` y `surface` del tema). Sirve para celdas de color (amarillo, naranja, verde) donde ni `text` ni `onAccent` son seguros: `color: readableOn(theme, fill)`. No reemplaza a `qa`, que sigue juzgando el texto real.

## Informe de contraste accionable y `acknowledge`

Una paleta de marca aprobada puede incumplir 4.5:1 en algún par. `checkTheme` lo sigue informando, pero cada aviso dice:

- `usedBy`: dónde usan las piezas de `kit/`, `fx/` y `stories/` ese color, separando texto (exige 4.5) de gráfico (pide 3): por ejemplo, `accent/bg` como texto en `GradientText` y el número de `DockedHeadline`; la tabla es `ROLE_USAGE` en `themes/contrast.ts`.
- `suggestion`: el tono más cercano del mismo matiz que sí llega al mínimo (`suggestShade(fg, bg, mínimo)`), para usarlo como texto sin tocar la marca en el resto.

Un par aprobado por la marca se reconoce en el tema con `acknowledge: ["accent/bg", "data.estado/surface"]` (o `{ acknowledge }` en `themeFromTokens`): `checkTheme` lo informa con severidad `note` en lugar de aviso o error, `report.notes` lo lista aparte y no entra en `report.warnings`. Un nombre en `acknowledge` que no corresponde a ningún par revisado también sale como `note`, para detectar errores de tipeo. El reconocimiento queda atado a los colores con que se aprobó (`theme.acknowledgePins`, que `themeFromTokens` completa solo, también para lo que hereda de `base`): un sub-tema, por ejemplo oscuro, donde `accent/bg` es otro par de colores no hereda el "aprobado"; el par sale como aviso y el mensaje dice que el reconocimiento ya no corresponde (y si el par hoy pasa, sale un aviso aparte para que lo quites). Un tema armado a mano con `{ ...tema, color }` y `acknowledge` sin pins vale por nombre: para derivar temas usá `themeFromTokens`. Reconocer un par no cambia lo que mide `qa`: el control de calidad juzga el texto real que se ve en pantalla.

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
