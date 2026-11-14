# themes/

Capa que permite renderizar el mismo kit con cualquier design system. Solo depende de React; no importa nada de `engine/`.

- `neutral`: tema por defecto (claro, sistema de fuentes, azul/violeta).
- `dark`: variante oscura.
- `editorial`, `neon`, `papel`: tres design systems de ejemplo, inventados y genéricos, cada uno con estética propia (no solo otra paleta). Ver "Estilo".
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
    // `on` también acepta otro color de datos o un color (las superficies propias de una interfaz recreada) y `scope` anota dónde aparece:
    // estadoOk: { token: "ok", on: ["data.ficha"], min: 4.5, scope: "dentro de la ficha oscura" },
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

Más tokens de movimiento: `--ease-standard|out|in-out` (`cubic-bezier(...)` o cuatro números) y `--duration-fast|base|slow` (cuadros, o `ms` / `s` a 30 fps); ver `docs/estilo.md`.

`theme.cloud` trae `colors` (lista), `opacity` y, opcionales, `count` (reparto sembrado, 6 por defecto), `seed` y `blobs` (manchas explícitas `{ x, y, size?, color? }`, con `x`/`y` como fracción del cuadro: se acomodan solas a cada formato). Tokens: `--cloud-color-1..12` o `--cloud-colors: a, b, c`, `--cloud-count`, `--cloud-opacity` (`0.22` o `22%`), `--cloud-seed`, `--cloud-blur` (desenfoque en px, 110 por defecto), `--cloud-blob-1..24: x y [tamaño]` (entre comillas o sin ellas: `0.1 0.2 800` y `"0.1 0.2 800"` valen igual). Sin tokens de color, las nubes se derivan del acento (y de `accent2` si lo hay). `Stage` y `CloudBackground` permiten elegirlas por escena (ver `kit/README.md`).

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

## Estilo: `theme.style`

Un design system no es solo una paleta: cambia la forma de las esquinas, el tipo de superficie, el tratamiento de los números y de la palabra resaltada, el fondo, el movimiento y la decoración. Todo eso vive en `theme.style`: opcional y parcial en el tema, **completo** en `useTheme().style` (los valores por defecto reproducen el aspecto de siempre, así que un tema sin `style` no cambia). Un valor inválido lanza un error que lista lo que se acepta (`checkTheme` lo informa como error sin lanzar). El contrato para las piezas (qué pieza cumple qué campo y cómo) está en `docs/estilo.md`.

| Grupo | Campos (valores; el primero es el por defecto salvo que se indique) |
|---|---|
| `shape` | `corners` `pill`/`rounded`/`sharp`; `border` 0 a 6 px (1); `outlined` `true`/`false`; `heroScale` 0,5 a 4 o vacío (radio del cartel, múltiplo de `radius.lg`) |
| `surface` | `kind` `solid`/`glass`/`outline`/`tinted`; `elevation` `shadow`/`flat`/`border`/`glow`; `opacity` 0,3 a 1 (0,74, del vidrio) |
| `type` | `titleWeight` y `labelWeight` `regular`/`medium`/`semibold`/`stat` (`semibold` y `medium`); `titleTracking` -0,1 a 0,2 em (0); `eyebrowCase` `as-is`/`upper`; `eyebrowTracking` 0 a 0,4 em (0); `captionCase` `eyebrow`/`as-is`/`upper`/`lower` (`eyebrow` = sigue al eyebrow), `captionTracking` 0 a 0,4 em o vacío, `captionWeight` `auto`/`regular`/`medium`/`semibold`/`stat` (subtítulos y líneas de apoyo); `numerals` `gradient`/`solid`/`outline`/`muted`; `highlight` `gradient`/`underline`/`marker`/`accent` |
| `background` | `kind` `clouds`/`plain`/`grid`/`dots`/`gradient`/`noise`; `intensity` 0 a 1 (1) |
| `motion` | `entrance` `auto`/`rise`/`fade`/`scale`/`slide`/`wipe`/`depth`; `overshoot` 0 a 0,3 (0); `stagger` 0 a 12 cuadros (4); `staggerList`, `staggerRows`, `staggerItems` 0 a 60 o vacío y `staggerChips` 0 a 10 o vacío (pasos por contexto); `cameraBlur` `true`/`false`; `cameraTilt` 0 a 3 (1); `transition` `wash`/`through`/`cut`/`wipe` |
| `decor` | `doodles` `true`/`false`; `doodleStroke` `hand`/`geometric`; `vignette` 0 a 2 (1); `vignetteColor` rol de color (`accent`); `accent` `bar`/`underline`/`dot`/`none`; `accentThickness` 0,25 a 4 (1); `gradientLoop` 0 o entero >= 2 (0 = quieto) |
| `story` | `titleCard` `solid`/`glass`; `listLayout` `stacked`/`inline`; `listUnderline` `row`/`name`; `handoff` `wash`/`dock`/`through`; `headlineSize` `md`/`sm`; `closingBg` rol de color (`bg`); `signoffBar` `true`/`false`; `wallColumns` y `wallRows` 2 a 12 o vacío (según el formato); `wallChipScale` 0,5 a 3 (1); `wallDolly` -240 a 2000 (0); `wallDepth` 0 a 3 (1); `wallGapX` y `wallGapY` 0,4 a 3 (1); `wallBrick` 0 a 3 (1); `wallJitter` 0 a 4 (1); `wallBlurOpening` y `wallBlurClosing` `true`/`false` |
| `chart` | `barRadius` `none`/`sm`/`md`/`lg`/`pill` (`md`); `lineWidth` 1 a 12 px (5); `grid` `auto`/`on`/`off`; `fill` `solid`/`gradient`/`hatched` |

| `line` | `weight` `regular`/`hairline`/`bold` (x1, x0,5, x1,8 sobre los trazos); `dash` `solid`/`dashed`/`dotted` (solo las líneas guía); `cap` `round`/`square`; `glow` 0 a 1 (0); `dotShape` `round`/`square`/`cross`; `accentUse` `balanced`/`sparse`/`rich`; `sketch` 0 a 1 (0, temblor de mano fijo por posición) |
| `solid` | `fill` `shaded`/`flat`/`outline`/`translucent`; `contrast` 0,2 a 1,6 (1); `edge` `gap`/`ink`/`accent`/`none` (`gap` = la arista de siempre de cada pieza) |
| `depth` | `extrude` `stack`/`long-shadow`/`outline-stack`/`none`; `fog` `true`/`false` |
| `text` | `arrival` `rise`/`fade`/`slide`/`scale`; `caret` `bar`/`block`/`underscore`; `tile` `card`/`flat`/`outline`; `charset` `caps`/`hex`/`binary`/`symbols`; `decoration` `none`/`underline`/`marker`/`box` |

`STYLE_FIELDS` lista todos los campos con su valor por defecto y su descripción; `DEFAULT_STYLE` es el estilo por defecto.

### Tokens

Cada campo se puede declarar como token `--style-<grupo>-<campo>` en kebab (`--style-shape-corners`, `--style-surface-kind`, `--style-type-title-weight`, `--style-type-eyebrow-case`, `--style-motion-camera-blur`, `--style-decor-gradient-loop`, `--style-story-wall-chip-scale`, `--style-chart-bar-radius`...), en CSS o en JSON (`{ style: { shape: { corners: "sharp" } } }` o plano `style-shape-corners`). Los booleanos aceptan `true`/`false`/`on`/`off`/`sí`/`no`; los números, `0.8`, `80%` (donde el máximo es 1) o `2px`; `auto` o vacío en `wallColumns`/`wallRows`. Forma compacta, que pisa a los tokens:

```ts
const { theme, report } = themeFromTokensWithReport(tokens, neutral, {
  style: { shape: { corners: "sharp" }, surface: { kind: "outline", elevation: "flat" } },
});
report.style.mapped;   // { "shape.corners": "options.style", "type.eyebrowCase": "style-type-eyebrow-case", ... } campo -> token de origen
report.style.fallback; // campos que quedaron con el valor de la base
report.style.invalid;  // [{ path, source, value, accepted }]: ignorados, con los valores que acepta el campo
```

Un valor inválido (o un `--style-...` que no existe) no lanza: se ignora, queda en `report.style.invalid` y en `report.warnings`. Un tema derivado (`themeFromTokens(tokens, base)`) hereda el estilo de su base y solo cambia lo que dicen los tokens.

### Ayudas para las piezas

Las piezas no leen cadenas de `theme.style`: llaman a estas ayudas (puras, deterministas, sin valores identidad en el estilo que devuelven): `cornerRadius`, `borderWidth`, `surfaceStyle`, `textStyle`, `numeralStyle`, `highlightStyle`, `backgroundLayer`, `entrance`, `settle`, `staggerFrames`, `staggerOverride`, `staggerScale`, `transitionVeil`, `cameraOptions`, `doodleStyle`, `vignetteStrength`, `vignetteColor`, `accentMark`, `chartStyle`, `chartFill`, `storyDefaults`, `withStoryDefaults`; para `fx/`: `lineLook`, `solidLook`, `depthLook`, `textLook` y `sketchOffset` (`themes/styleLine.ts`). Además: `surfaceParts` (lo mismo que `surfaceStyle`, en datos, para SVG), `borderWidth(theme, rol, { bold })`, `surfaceStyle(..., { bold, corner, titleCard })`, `entrance(..., { curve, offset })` y `textStyle(theme, "label", { strong })` y `textStyle(theme, "caption", { follow })`. Cuál usa cada pieza y qué rol corresponde a qué radio: `docs/estilo.md`.

### `checkTheme` y el estilo

Además de los colores, `checkTheme` revisa el estilo: valores inválidos (error) y las combinaciones que dañan la lectura, como un vidrio tenue sobre un fondo cargado con texto atenuado, una superficie teñida, un marcador o un patrón de fondo que bajan el contraste del texto, números atenuados, o tarjetas sin borde ni sombra que se pierden contra el fondo. Revisa también `line`, `solid` y `text`: trazos finos (`hairline`) con `border` de poco contraste, aristas de sólidos `outline` o `translucent` que no se separan del fondo, el cursor de bloque (`onAccent` sobre `accent`), losetas y adornos de texto. Los pares se pueden reconocer en `acknowledge` con nombres como `style.surface.glass/textMuted`.

## Cómo traer tu design system

1. **Tokens.** Pasá los tokens (CSS con variables o JSON) a `themeFromTokensWithReport(tokens, neutral)`. Colores, fuentes, radios y sombras usan los alias de arriba; el estilo, `--style-*`. Un design system con otros nombres: renombrá los tokens o pasá `{ style: {...} }` y `{ data: {...} }`.
2. **Adaptador e informe.** Leé `report.mapped` (qué token fue a qué rol), `report.fallback` y `report.style.fallback` (qué quedó con el valor de la base: ahí se nota qué le falta al design system), `report.style.invalid` y `report.warnings`. Un `fallback` en un color de marca es casi siempre un token mal nombrado.
3. **Decisiones de estilo.** Para cada grupo de `style`, elegí el carácter: ¿esquinas rectas o píldoras? ¿tarjetas sólidas, de contorno, de vidrio o teñidas? ¿sombra, filo o halo? ¿el número en degradado o sólido? ¿resalte con subrayado o marcador? ¿qué fondo, qué movimiento, con o sin garabatos? Empezá por `editorial`, `neon` o `papel` como referencia (`themes/editorial.ts`, `neon.ts`, `papel.ts`: un tema entero, de 60 líneas).
4. **Revisión.** `checkTheme(theme)` tiene que dar `[]` sin reconocimientos; si trae avisos, `suggestion` dice el tono más cercano que pasa y los de `style.*` dicen qué valor subir o bajar. Si una marca aprobada incumple un par, reconocelo con `acknowledge`.
5. **Un video en cada formato.** Probá el design system con un video real (o `examples/design-systems`, cuando exista) en los tres formatos que el video admita: `npm run render -- <id> --check` con `--format horizontal`, `--format vertical` y `--format cuadrado`, `npm run qa -- <id> --count 40` y la hoja de cuadros (`npm run sheet -- <id> --count 12`) mirada de verdad: un estilo se ve mal antes de medirse mal.

```tsx
import { themeFromTokensWithReport, checkTheme, ThemeProvider } from "./themes";

const { theme, report } = themeFromTokensWithReport(tokens, neutral, { style: { shape: { corners: "rounded" }, background: { kind: "grid" } } });
console.log(report.style.invalid, checkTheme(theme));
<ThemeProvider theme={theme}>{/* escenas */}</ThemeProvider>;
```
