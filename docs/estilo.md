# Estilo del design system (`theme.style`)

Contrato para quien escribe o cambia una pieza de `kit/`, `stories/`, `fx/` o `examples/` (y para quien arma un design system). Objetivo: cambiar el design system cambia la **estética** (forma, superficies, tratamiento del texto, fondo, movimiento, decoración) y no solo los colores, sin tocar el código de las escenas. Hasta ahora un tema cambiaba colores, tipografías, radios, sombras, curvas y nubes; la composición y el carácter estaban fijos en las piezas, y las decisiones de estilo vivían en `spec.design` de cada video. `theme.style` sube esas decisiones al tema; `spec.design` pasa a ser un ajuste por video sobre el design system.

Estado: **la capa está cerrada**: `themes/` la define y todas las piezas de `kit/`, `stories/`, `fx/` y los ejemplos la leen por las ayudas, salvo las exenciones de la sección "Exenciones y desvíos deliberados". Con el estilo por defecto el resultado es idéntico al de antes (lo prueban `themes/style.test.tsx`, las pruebas de reposo de cada carpeta y las hojas de `neutral`, que se comparan píxel a píxel). El orden de migración del final queda como historia del trabajo.

## Cómo se usa

- `theme.style` es opcional y parcial en el tema; `useTheme().style` siempre viene **completo** (como `data` y `type.ui`). Un valor inválido lanza un error que lista lo que se acepta; `checkTheme` lo informa como error sin lanzar.
- Las piezas **no comparan cadenas del estilo**: llaman a las ayudas de `themes/` (`import { surfaceStyle, ... } from "../themes"`). Son puras, deterministas y devuelven estilos planos que **omiten los valores identidad** (sin `translateY(0px)`, `scale(1)`, `opacity: 1`); si el conjunto de propiedades cambia durante la animación, la pieza usa `styleKey` de `fx/core` como `key` (ver `docs/reglas.md`, "Residuos en elementos quietos").
- Los tokens son `--style-<grupo>-<campo>` (`--style-shape-corners`); en JSON, `{ style: { shape: { corners: "sharp" } } }`; compacto: `themeFromTokens(tokens, base, { style: {...} })`. Detalle en `themes/README.md`.
- Los tres design systems de ejemplo (`editorial`, `neon`, `papel`, en `themes/`) sirven de prueba: una pieza migrada tiene que verse distinta con cada uno.

## Campos, valores y quién los cumple

Los valores por defecto (primer valor de cada lista, o el número que se indica) reproducen el aspecto de siempre. "Estado": **cumplido** = lo leen las piezas que dice la columna "Pieza"; entre paréntesis, quién lo hace y qué queda exento (ver "Exenciones y desvíos deliberados").

### `shape`: forma

| Campo | Valores (por defecto) | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `corners` | `pill` (por defecto), `rounded`, `sharp` | `DockedHeadline`, `Chip`, `Pill` (stories), píldoras de `Interlude`: radio de chip (`pill` = 999, `rounded` = `radius.md`, `sharp` = 0). Tarjetas de `fx/ui` (`NotificationStack`, `ChatThread`, `TileGrid`, `CardFan`, `BeforeAfter`, `TileDone`), `CardFlip`, `CarouselRing`: `card`; `FlowSteps`: `panel`; `CommandPalette`, `BlueprintDraw`, panel del cierre: `window`; cartel de la apertura: `hero`. Barras de acento y de firma: radio de barra. | `cornerRadius(theme, role)` con rol `chip` (`radius.pill`) / `card` (`radius.lg`) / `panel` (`radius.panel`) / `window` (`radius.lg`) / `hero` (`radius.lg * 2`) / `control` (`radius.md`) / `bar` (`radius.pill`) | cumplido: `kit/DockedHeadline`; `stories` (`Chip`, `Pill`, `Opening`, `Interlude*`, `Closing`); `fx/ui`, `fx/three` (`CardFlip`, `CarouselRing`), `fx/data/FlowSteps`, `fx/art/BlueprintDraw`. Exento: el aparato de `PhoneFrame` / `PhoneOrbit` |
| `border` | 0 a 6 px (1) | Borde de todas las superficies: la pieza suma lo suyo (chip +1, píldora +2: con 1 da los 2 y 3 px de hoy). | `borderWidth(theme, role, { bold, titleCard })` (o `surfaceStyle`); `bold` suma el píxel de las fichas (2 px de hoy) y nadie lo suma a mano | cumplido (ídem) |
| `outlined` | `true` (por defecto), `false` | `false` quita el borde de tarjetas, chips y píldoras (solo `surface.kind: "outline"` lo conserva, porque ese tipo es un borde). | `surfaceStyle` | cumplido (ídem) |
| `heroScale` | 0,5 a 4 o vacío (vacío) | Radio del cartel del título (rol `hero`) como múltiplo de `radius.lg`; vacío = el de siempre (2 con `pill`, 1,5 con `rounded`). Con `sharp` no rige. | `cornerRadius(theme, "hero")` | cumplido: cartel de `Opening` |

### `surface`: superficies

| Campo | Valores | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `kind` | `solid` (por defecto), `glass`, `outline`, `tinted` | Relleno de las mismas piezas de arriba: `solid` = `color.surface`; `glass` = `surface` con `opacity` (emulado, sin `backdrop-filter`); `outline` = relleno del fondo y borde de tinta (`color.text`); `tinted` = `surface` teñida 10 % de acento. El cartel de la apertura usa vidrio si `story.titleCard` es `glass`. | `surfaceStyle(theme, role, { on, faint, glow, level, bold, corner, titleCard })` con rol `card` / `panel` / `window` / `headline` / `chip` / `pill` / `title`; `surfaceParts` da lo mismo en datos (relleno, borde, radio, sombra, halo) para SVG | cumplido (las mismas piezas que `shape`) |
| `elevation` | `shadow` (por defecto), `flat`, `border`, `glow` | Sombra de esas piezas: `shadow` = la del tema (`sm`/`md`/`lg` según el rol); `flat` = ninguna (tampoco halos); `border` = filo duro desplazado en tinta, sin desenfoque; `glow` = halo de acento y borde de acento. El destello de un chip (`pop`) y el halo de la píldora solo existen con `shadow` y `glow`. | `surfaceStyle` | cumplido (ídem) |
| `opacity` | 0,3 a 1 (0,74) | Opacidad del relleno `glass`. | `surfaceStyle` | cumplido (ídem) |

### `type`: tratamiento del texto

| Campo | Valores | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `titleWeight` | `regular`, `medium`, `semibold` (por defecto), `stat` | Peso de titulares: título de `DockedHeadline`, nombre de la fila (`HeadlineRow`), nombre de `Pill`, texto de la firma, efectos de `fx/text` que hoy usan `semibold` (cuando no llega `weight`), `MarkerDraw`. (`ExtrudeType` usa `stat` y no se toca.) | `textStyle(theme, "title", { tracking })` | cumplido: `DockedHeadline`, `stories`, `fx/text` (cuando no llega `weight`), `fx/ui`, `fx/data`, `MarkerDraw`. Exentos: `ExtrudeType`, `KineticWords`, `MarqueeBands`, `TypeRing`, `DigitRoll` (`stat` a propósito) |
| `labelWeight` | ídem (`medium`) | Peso de rótulos: `Chip`, etiquetas de `fx/ui`. | `textStyle(theme, "label", { strong })` (`strong`: un escalón más fuerte, `semibold` con el estilo por defecto) | cumplido: `Chip`, rótulos de `fx/ui`, `fx/data` y `fx/art` (con `strong`, un escalón más fuerte) |
| `titleTracking` | -0,1 a 0,2 em (0) | Se **suma** al interletrado que la pieza ya lleva (los nombres de la lista llevan -0,02 em: `tracking: -0.02`). | `textStyle` | cumplido (donde cumple `titleWeight`) |
| `eyebrowCase`, `eyebrowTracking` | `as-is` / `upper`; 0 a 0,4 em (0) | Rótulos del tamaño `type.eyebrow`: etiquetas pequeñas de `fx/ui`. El subtítulo del titular y la línea de la lista pasaron al rol `caption` (abajo). | `textStyle(theme, "eyebrow")` | cumplido: `kit/Eyebrow`, rótulos pequeños de `fx/ui` |
| `captionCase`, `captionTracking`, `captionWeight` | `eyebrow` (por defecto) / `as-is` / `upper` / `lower`; 0 a 0,4 em o vacío (el de `eyebrowTracking`); `auto` / `regular` / `medium` / `semibold` / `stat` | Rol `caption`, aparte del eyebrow, para el subtítulo del titular (`DockedHeadline`) y la línea de apoyo de la lista. Con los valores por defecto **sigue al eyebrow** (así un design system que no los toca no cambia); un sistema con eyebrows en mayúsculas puede dejar los subtítulos en caja normal (`as-is`). La línea de la lista nunca llevó la caja ni el interletrado del eyebrow: solo toma el rol `caption` si el design system lo fija (`follow: false`). Con `upper` el texto ensancha un 10 a 15 % y la lista (medida con `fitText`) puede cortarlo antes. | `textStyle(theme, "caption", { follow })` | cumplido: subtítulo de `DockedHeadline`, línea de la lista de `stories` |
| `numerals` | `gradient` (por defecto), `solid`, `outline`, `muted` | Números de paso y de lista: `DockedHeadline` (número), `HeadlineRow` (número), `Pill` (número), números de `FlowSteps`. **No** rige en métricas (`DigitRoll`, `SplitFlap`, `CountUp`, `DonutRing`): son cifras de contenido, no ordinales. | `numeralStyle(theme, { frame, loop, on })` | cumplido: `kit/Numeral`, `DockedHeadline`, `stories`, `FlowSteps`. Exentos: las métricas (`DigitRoll`, `SplitFlap`, `CountUp`, `DonutRing`) |
| `highlight` | `gradient` (por defecto), `underline`, `marker`, `accent` | Palabra resaltada: `HighlightedTitle` (stories), `GradientText` cuando se usa como resalte; `MarkerDraw` (fx/art) ya dibuja un resalte de marcador con el acento y se alinea con `marker`. | `highlightStyle(theme, { frame, loop, progress })` | cumplido: `kit/Highlight`, `HighlightedTitle` y firma de `stories`, `MarkerDraw` |

### `background`: fondo

| Campo | Valores | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `kind` | `clouds` (por defecto), `plain`, `grid`, `dots`, `gradient`, `noise` | `Stage` y `StoryStage`: capa de fondo bajo el contenido; `CloudBackground` solo se dibuja con `clouds` (o si la escena pasa `cloud` a propósito). `noise` es un mosaico SVG fijo generado con un generador congruencial: determinista y sin animación. | `backgroundLayer(theme)` → `{ kind, clouds, cloudOpacity, style }` | cumplido: `Stage`, `StoryStage`, `CloudBackground` |
| `intensity` | 0 a 1 (1) | Multiplica la opacidad de las nubes (`theme.cloud.opacity`) o la fuerza del patrón. | `backgroundLayer` | cumplido (ídem) |

Los parámetros de las nubes siguen en `theme.cloud`: colores, opacidad, cantidad, semilla, manchas y el **desenfoque** (`cloud.blur`, token `--cloud-blur`, 110 px si no se declara). `CloudBackground` lo lee, y con él `Stage` y `StoryStage` (que la dibujan); `cloud.blur` de una escena o `design.clouds.blur` de un video lo pisan.

### `motion`: carácter del movimiento (sobre `easing` y `duration`, que no cambian)

| Campo | Valores | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `entrance` | `auto` (por defecto), `rise`, `fade`, `scale`, `slide`, `wipe`, `depth` | Entrada de elementos genéricos: `DockedHeadline` (hoy desliza -30 px), tarjetas de `NotificationStack` (sube 50 px con asentado), burbujas de `ChatThread`, `TileGrid`, `CardFan`, `CommandPalette`, filas y cartel de stories. `auto` deja a cada pieza con la suya (`native`, `distance`); otro valor la reemplaza. `depth`: el elemento llega desde `depth` px de profundidad (600 por defecto) con su propia `perspective(1400px)` y un solo `translate3d` dentro de su `transform` (la regla de profundidad de `docs/reglas.md`: nunca perspectiva ni `preserve-3d` en un ancestro); es la misma cuenta que `flyInZ` de `kit/` (con 900 px da el mismo `transform`). Los efectos con animación propia (`MaskedRise`, `KineticWords`...) no la usan. | `entrance(theme, progress, index, { native, distance, depth, from, side, alternate, round, curve, offset })` (`curve`: curva propia que puede pasarse de 1, `offset`: traslado extra) | cumplido: `DockedHeadline`, `stories`, `NotificationStack`, `ChatThread`, `CardFan`, `CommandPalette`. Exentos: los efectos con animación propia |
| `overshoot` | 0 a 0,3 (0) | Rebote al asentarse de lo que pasa por `entrance`. | `settle(p, overshoot)` / `entrance` | cumplido (por `entrance`, y `BarsGrow` por `settle`) |
| `stagger` | 0 a 12 cuadros (4) | Paso entre elementos de un conjunto: Piezas con paso en cuadros (`MaskedRise`, `SplitFlap`, filas de la lista): pasan **su propio paso** como `base` y el tema lo escala (4 = sin cambio, 2 = la mitad). Piezas que escalonan con una fracción de su duración (`staggerT`: `NotificationStack`, `CardFan`, `BarsGrow`, `Bars3D`, `LogoLand`, `PaperCollage`, `BlueprintDraw`): `spread * staggerScale(theme)`, con tope 0,95. | `staggerFrames(theme, index, { base })` / `staggerScale(theme)` | cumplido: `stories`, `fx/text` (`MaskedRise`, `SplitFlap`), `fx/ui`, `fx/data`, `fx/art`, `fx/three` (`stepDelay`) |
| `staggerList`, `staggerRows`, `staggerItems`, `staggerChips` | 0 a 60 cuadros o vacío (vacío); `staggerChips` 0 a 10 con decimales | Pasos por contexto, para un sistema que no usa el mismo paso en todos lados. `stagger` sigue siendo la base. **Vacío** = ese contexto usa el paso propio de la pieza escalado por `stagger`, como siempre. **Con un número** = esos cuadros entre un elemento y el siguiente, tal cual (no se escala por el `base` de la pieza). `staggerList`: las filas grandes de la lista de la apertura (22 cuadros en una apertura pausada; se estira con `timing.opening`; ojo que las filas tienen que terminar de entrar antes de que arranque el atravesado). `staggerRows`: filas de la vuelta al listado (`Interlude`) y de interfaces (`examples/kit-demo`). `staggerItems`: elementos pequeños (paneles del cierre y su vuelo, tarjetas de `kit-demo`). `staggerChips`: cuadros por pieza con que aparecen las piezas del muro de la apertura (0,5 de siempre). | `staggerFrames(theme, index, { base, context, scale })`, `staggerOverride(theme, context)`, `staggerScale(theme, context)` | cumplido: `Opening` (lista y muro), `Interlude`, `Closing`, `examples/kit-demo`. Las piezas de `fx/` que escalonan por fracción de duración siguen leyendo solo `stagger` |
| `cameraBlur` | `true` / `false` | Quien llama a `cameraAt` (`Opening`, `Interlude`, escenas de `examples/`): `false` pasa `maxBlur: 0`. | `cameraOptions(theme)` → `{ tiltGain?, maxBlur? }` para esparcir en las opciones de `cameraAt` | cumplido: `useCameraAt` (kit), que usan `stories` y los ejemplos |
| `cameraTilt` | 0 a 3 (1) | Multiplica `tiltGain` (0,05) de `cameraAt`. | `cameraOptions` | cumplido (ídem `cameraBlur`) |
| `transition` | `wash` (por defecto), `through`, `cut`, `wipe` | `Wash` (kit): `wash` = velo; `wipe` = cortina de izquierda a derecha; `cut` = escalón al llegar a 1; `through` = sin velo (la escena siguiente entra sobre el fondo que sigue; hace falta que el final de la escena atraviese un elemento, como hoy). Conserva `data-qa-veil` y `data-qa-ignore="covered"` en `wash` y `wipe`. | `transitionVeil(theme, progress, color?)` → `{ kind, style } \| null` | cumplido: `Wash` (kit), velo de `stories` |

### `decor`: decoración

| Campo | Valores | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `doodles` | `true` / `false` | `DoodleCircle`, `DoodleArrow`, `DoodleUnderline` devuelven `null` con `false`. Una escena no puede depender de un garabato para que se entienda. | `doodleStyle(theme).enabled` | cumplido: `DoodleCircle`, `DoodleArrow`, `DoodleUnderline`, `PaperCollage`, `MarkerDraw` |
| `doodleStroke` | `hand` (por defecto), `geometric` | `hand` = el temblor de hoy; `geometric` = trazo limpio (amplitud 0): `kit/doodle.ts` necesita un modo sin temblor. También `MarkerDraw`. | `doodleStyle(theme).jitter` | cumplido (`kit/doodle.ts` tiene el modo sin temblor) |
| `vignette` | 0 a 2 (1) | `Vignette`: multiplica `strength` (0 la apaga). | `vignetteStrength(theme)` | cumplido: `Vignette` |
| `vignetteColor` | rol de color (`accent`) | Color de la viñeta; la escena puede pasar `color` a `Vignette`. | `vignetteColor(theme)` | cumplido: `Vignette` |
| `accentThickness` | 0,25 a 4 (1) | Multiplica el grosor de la marca de acento: cada pieza trae el suyo (8 px en la lista y la firma, 10 px en la vuelta compacta) y con 1 queda como siempre. En `underline` el filete es `max(2, 0,4 * grosor)`; en `dot`, 1,5 * grosor. | `accentMark` | cumplido: `stories` (lista, firma, vuelta compacta) |
| `accent` | `underline`, `bar` (por defecto), `dot`, `none` | Marca de acento de cada fila de la lista (`HeadlineRow`, hoy barra de degradado de 8 px) y de la firma del cierre; `MaskedRise` con `dot` conserva su punto. | `accentMark(theme, { length, thickness, progress })` | cumplido: `stories` (lista, firma, cierre) |
| `gradientLoop` | 0 o entero >= 2 (0) | Vaivén del degradado de `GradientText` (cuando no recibe `loop`), de `numeralStyle` y `highlightStyle`, y de `story.gradient.loop`. | `numeralStyle`, `highlightStyle`, `storyDefaults` | cumplido: `GradientText`, `Numeral`, `Highlight`, `stories` |

### `story`: valores por defecto de `StoryDesign` (`spec.design` los pisa)

| Campo | Equivale a | Estado |
|---|---|---|
| `titleCard` | `design.titleCard` (`solid` por defecto) | cumplido (`Opening`) |
| `listLayout`, `listUnderline` | `design.list` (`stacked`, `row`) | cumplido (`Opening`, lista) |
| `handoff` | `design.handoff` (`wash`). No se deriva de `motion.transition`: la transición rige entre escenas; el `handoff`, el cierre de la apertura | cumplido |
| `headlineSize` | `design.headline.size` (`md`) | cumplido |
| `closingBg` | `design.closing.bg` (`bg`; un rol de color del tema) | cumplido (`Closing`) |
| `signoffBar` | `design.closing.bar` (existe en `StoryDesign` y se valida) | cumplido (`Closing`) |
| `wallColumns`, `wallRows` | `design.wall.columns/rows` (vacío = según el formato: 6 y 6 en horizontal, 3 y 12 en vertical) | cumplido en horizontal y cuadrado; **en vertical no rige** (desvío deliberado: ver "Exenciones y desvíos deliberados") |
| `wallChipScale`, `wallDolly`, `wallDepth` | `design.wall.chipScale/dolly/depth` (1, 0, 1) | cumplido |
| `wallGapX`, `wallGapY` | `design.wall.gapX/gapY` (1; 0,4 a 3) | Multiplican la separación entre columnas y entre filas del muro de la apertura (escalan desde el centro) | cumplido (`Opening`) |
| `wallBrick` | `design.wall.brick` (1; 0 a 3) | Corrimiento "ladrillo" de las filas alternas (200 px de siempre por el multiplicador); 0 deja las columnas alineadas: una grilla ajustada | cumplido (`Opening`) |
| `wallJitter` | `design.wall.jitter` (1; 0 a 4) | Multiplicador del temblor de posición de cada pieza; es `random("x" + i)`, sembrado y determinista; 0 = ninguno | cumplido (`Opening`). El muro del cierre es otra grilla (celdas de 480 x 200 alrededor de los lugares reservados) y no lo lee |
| `wallBlurOpening`, `wallBlurClosing` | `design.wall.blur.opening/closing` (`true`) | cumplido |
| (`decor.gradientLoop`) | `design.gradient.loop` | cumplido |

Ayudas: `storyDefaults(theme)` da los valores del tema en la forma larga de `StoryDesign`; `withStoryDefaults(theme, spec.design)` los mezcla con lo que el video indica (gana el video), acepta las formas cortas (`list: "inline"`, `wall.blur: false`) y devuelve siempre la larga; deja pasar `clouds` y lo demás.

### `chart`: gráficos

| Campo | Valores | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `barRadius` | `none`, `sm`, `md` (por defecto), `lg`, `pill` | Esquinas de las barras: `BarsGrow` (hoy `radius.md`), barras del miniaturizado del cierre (hoy `radius.sm`). | `chartStyle(theme).barRadius` (px) | cumplido: `BarsGrow`, miniatura del cierre (un escalón menos: desvío deliberado) |
| `lineWidth` | 1 a 12 px (5) | `LineDraw` (hoy 5), contorno de `RadarMorph` (hoy 4). | `chartStyle(theme).lineWidth` | cumplido: `LineDraw`, `RadarMorph` |
| `grid` | `auto` (por defecto), `on`, `off` | `auto` = cada gráfico como hoy (`LineDraw` y `RadarMorph` dibujan guías de 1,5 px; `BarsGrow` solo la línea base). `on` / `off` fuerzan. | `chartStyle(theme).grid` | cumplido: `BarsGrow`, `LineDraw`, `RadarMorph` |
| `fill` | `solid` (por defecto), `gradient`, `hatched` | Relleno de barras y áreas (`BarsGrow`, `Bars3D` no: es geometría). `gradient` y `hatched` necesitan un `<defs>` con un id derivado de las props (nunca `useId`). | `chartFill(theme, color, id)` | cumplido: `BarsGrow`, `LineDraw`, `RadarMorph`, miniatura del cierre |

### `line`, `solid`, `depth`, `text`: efectos de línea, sólidos y texto (`fx/three`, `fx/text`)

Los campos de arriba movían tarjetas y titulares; los alambres, puntos, sólidos y letras de los efectos eran siempre el mismo dibujo. Estos cuatro grupos (todos con valor por defecto idéntico al aspecto anterior; `neutral` y `dark` no los declaran) cubren eso. Las piezas de `fx/three` los leen por la **pluma** (`penFor`, en `fx/three/common.ts`, que envuelve `lineLook`, `solidLook` y `depthLook`; `useThreeFx` la entrega como `pen`) y las de `fx/text` por `fx/text/look.tsx` (sobre `textLook`). Ninguna pieza compara cadenas.

| Campo | Valores (por defecto) | Qué cambia | Quién lo cumple |
|---|---|---|---|
| `line.weight` | `regular` (x1), `hairline` (x0,5), `bold` (x1,8) | Grosor de todos los trazos y tamaño de los puntos (x0,8 / x1 / x1,25) | todas las de canvas de `three/` (`Globe`, `ParticleSphere`, `CubeStack`, `CubeFold`, `Tunnel`, `TerrainMesh`, `TorusWire`, `Helix`, `OrbitRings`, `WaveDots`, `LayerExplode`, `IsoCity`, anillo de `PhoneOrbit`), borde de `CardFlip` y `CarouselRing`; contorno de `MarqueeBands` y del `SplitFlap` |
| `line.dash` | `solid`, `dashed`, `dotted` | Solo las líneas guía (retícula, marcos, aristas, órbitas, tarjetas de fondo); lo principal (rutas, hebras, marcos en acento) sigue lleno | `Globe`, `Tunnel`, `TerrainMesh`, `TorusWire`, `Helix`, `OrbitRings`, anillo de `PhoneOrbit`, `CarouselRing` (tarjetas de atrás) |
| `line.cap` | `round`, `square` | `square` = corte recto y esquinas vivas (`butt` + `miter`) | las mismas que `weight` (por `pen.caps`) |
| `line.glow` | 0 a 1 (0) | Halo: una segunda pasada ancha y tenue (no `shadowBlur`: así pasa `--check`). En DOM, `box-shadow` | trazos y puntos de `three/`, `TerrainMesh`, `ExtrudeType` (halo de la pila), bordes de `CardFlip`/`CarouselRing`; cursor y adorno de texto, `SplitFlap`, `MarqueeBands` (contorno), `TypeRing` |
| `line.dotShape` | `round`, `square`, `cross` | Forma de los puntos y del separador de texto | `Globe`, `ParticleSphere`, `Helix`, `OrbitRings`, `WaveDots`, `PhoneOrbit`; separador de `MarqueeBands` y `TypeRing` |
| `line.accentUse` | `balanced`, `sparse`, `rich` | Cuánto de una figura va en acento: `sparse` deja el acento solo en lo principal; `rich` tiñe también lo neutro | `ParticleSphere` (fracción), `CubeStack` (cubos), `Tunnel` (cada cuántos marcos), `TorusWire`, `Helix`, `TerrainMesh`, `IsoCity` (umbral de altura), `WaveDots`, `Globe`, `OrbitRings`, `CubeFold`, `LayerExplode` |
| `line.sketch` | 0 a 1 (0) | Temblor de mano: desplazamiento fijo según la posición en pantalla (`sketchOffset`), sin azar ni dependencia del cuadro; los vértices compartidos no se separan | todo lo que dibuja la pluma (`three/`) |
| `solid.fill` | `shaded`, `flat`, `outline`, `translucent` | Relleno de las caras: sombreado por cara, un tono por pieza, solo contorno (tapa lo de atrás) o cristal con borde | `CubeStack`, `CubeFold`, `IsoCity`, `LayerExplode`, esfera de `OrbitRings`, sol de `TerrainMesh` |
| `solid.contrast` | 0,2 a 1,6 (1) | Diferencia de luz entre las caras (en `shaded` y `flat`) | `CubeStack`, `CubeFold`, `IsoCity`, `LayerExplode` |
| `solid.edge` | `gap`, `ink`, `accent`, `none` | Arista: `gap` = la de siempre de cada pieza (color del fondo en los cubos, tinta en las capas) | las mismas que `fill` |
| `depth.extrude` | `stack`, `long-shadow`, `outline-stack`, `none` | Volumen: pila con degradé, sombra larga de un tono que se desvanece, copias de contorno que se tapan entre sí, o plano | `ExtrudeType` (los cuatro), `IsoCity` (`long-shadow`: sombra en el suelo), `LayerExplode` (`none`: capas finas; `long-shadow`: sombra de cada capa sobre la de abajo) |
| `depth.fog` | `true`, `false` | `false`: sin atenuación ni afinado por distancia (trazos parejos y nítidos) | `Globe`, `ParticleSphere`, `Tunnel`, `TerrainMesh`, `TorusWire`, `Helix`, `OrbitRings`, `WaveDots`, anillo de `PhoneOrbit`, `TypeRing` (letras de atrás) |
| `text.arrival` | `rise`, `fade`, `slide`, `scale` | Cómo llegan las letras y los extras | `MaskedRise`, `KineticWords` (por `MaskedRise`), extra de `Typewriter`, sufijo de `DigitRoll` |
| `text.caret` | `bar`, `block`, `underscore` | Cursor. En `ScrambleDecode`, `bar` no dibuja cursor (como siempre); `block` y `underscore` marcan el glifo que se está resolviendo | `Typewriter`, `ScrambleDecode` |
| `text.tile` | `card`, `flat`, `outline` | Losetas y bandas: llena con bisagra y radio, llena sin ellos, o solo contorno con el glifo del color de la loseta. En `MarqueeBands`, `flat` = `card` | `SplitFlap`, `MarqueeBands` |
| `text.charset` | `caps` (el propio del efecto), `hex`, `binary`, `symbols` | Alfabeto de los glifos al azar | `ScrambleDecode`, `SplitFlap` |
| `text.decoration` | `none`, `underline`, `marker`, `box` | Adorno que se dibuja bajo el texto al terminar: subrayado que avanza, barrido de marcador o recuadro (por palabra en `MaskedRise`; `KineticWords` lo apaga) | `MaskedRise`, `Typewriter`, `ScrambleDecode`, `DigitRoll` (solo el adorno: las cifras siguen exentas de `numerals`) |

Reglas: con el valor por defecto cada llamada de la pluma hace las mismas operaciones de canvas que antes (`fx/three/pen.test.ts`) y las hojas de `neutral` y `dark` son idénticas píxel a píxel; los colores salen siempre de la paleta del tema (`fx/canvasTheme.test.tsx` lo prueba con el estilo de los cinco temas); en reposo no quedan `transform`, `opacity` ni `font-size` identidad.

### Lo que decidí no incluir

- **`ui` (ventana, densidad):** ninguna pieza de `kit/` ni de `fx/` dibuja una ventana de aplicación (la barra de título del miniaturizado del cierre es lo único parecido y lo cubren `surface` y `shape`). Un campo sin consumidor posible es ruido. Si `kit/` incorpora una pieza `Window` o `Panel`, se agrega `ui.windowBar` (`none` / `dots` / `title`) y `ui.density` en ese momento.
- **Tamaño de la grilla, de los puntos y del grano:** son constantes de `themes/styleBackground.ts` (64, 48 y 160 px); el que quiera otro tamaño usa `intensity` o su propio fondo.
- **Colores del estilo** (color del marcador, de la grilla, del halo): salen de los roles del tema (`accent`, `border`, `text`); un color nuevo va en `theme.color` o `theme.data`.

## Roles de forma y superficie

Una pieza no elige un radio ni un grosor de borde: elige un **rol** y el design system decide.

| Rol | Radio (`cornerRadius`, con `pill` y `rounded`) | Para qué |
|---|---|---|
| `chip` | `radius.pill` (`rounded`: `radius.md`) | chips, píldoras, rótulos, marcas redondas |
| `card` | `radius.lg` | tarjetas sueltas (notificaciones, burbujas, fichas de una galería) |
| `panel` | `radius.panel` | contenedor mediano dentro de un diagrama o de una interfaz (los pasos de `FlowSteps`, las tarjetas de una demostración) |
| `window` | `radius.lg` | contenedor grande que ocupa la escena (paleta de comandos, plano, panel del cierre) |
| `hero` | `radius.lg * 2` (`rounded`: `* 1,5`) | el cartel del título |
| `control` | `radius.md` (`rounded`: `radius.sm`) | filas, botones, cuadrados de muestra |
| `bar` | `radius.pill` (`rounded`: `radius.sm`) | barras de progreso, de acento y de firma |

Con `sharp` todos valen 0. Si una pieza necesita las esquinas de otro rol en una superficie (una tarjeta con las de `panel`), lo pide con `surfaceStyle(theme, "card", { corner: "panel" })`; no hace `Math.min(theme.radius.panel, ...)` ni escala radios a mano.

Bordes: `borderWidth(theme, rol)` da `shape.border` (más 1 en `chip`, más 2 en `pill`); con `{ bold: true }` suma un píxel más (la ficha que tiene que leerse como objeto: 2 px con el estilo por defecto). Con `surface.kind: "outline"` todo rol lleva borde, el cartel también. El cartel (`title`) sigue la variante `story.titleCard` del tema; si el video decide otra, se la pasa: `surfaceStyle(theme, "title", { titleCard: design.titleCard })`.

SVG: `surfaceParts(theme, rol, opciones)` devuelve `{ fill, stroke: { color, width } | null, radius, shadow: { kind, x, y, blur, color }, glow, boxShadow }` sin pasar por cadenas de CSS (`surfaceStyle` se arma con él). `fx/data/styleKit.tsx` lo adapta a lo que usan los efectos SVG (`svgSurface`, `SvgShadow`).

Entrada: `entrance(theme, p, i, { native, distance, curve, offset })`. `curve` es la curva propia de la pieza (por ejemplo `Easing.lands`) y puede pasarse de 1; manda solo con `motion.entrance: "auto"`. `offset` suma un traslado propio (la tarjeta empujada por otra) al de la entrada, en un solo `transform`.

## Exenciones y desvíos deliberados

Lo que **no** sigue el estilo, y por qué:

- **`PhoneFrame` y `PhoneOrbit` (el aparato):** un teléfono sigue siendo un teléfono con `shape.corners: "sharp"`; el radio de pantalla sale de `radius.lg * 2,2` por geometría y recorta con `clip-path`. Lo que se muestra dentro sí sigue el estilo.
- **Cifras de métricas:** `DigitRoll`, `SplitFlap`, `CountUp`, `DonutRing` son contenido, no ordinales; `type.numerals` rige solo en números de paso y de lista (`DockedHeadline`, `HeadlineRow`, `Pill`, `FlowSteps`, tilde de las historias).
- **`KineticWords`, `MarqueeBands`, `TypeRing`, `ExtrudeType`, `DigitRoll`:** llevan el peso `stat` a propósito (el efecto es de énfasis).
- **Tamaños de diseño de las piezas:** las medidas del muro, de la lista y de las miniaturas, el tamaño de las tarjetas de una galería y la escala `theme.type` no salen del estilo (ver "Qué NO puede depender del estilo").
- **Geometría pura:** los efectos de `fx/three` que son geometría (`Globe`, `Helix`, `Tunnel`...) solo leen `line`, `solid`, `depth`; `Bars3D` y `DonutRing` no tienen forma ni superficie.

Dos desvíos que `stories/` informó y se mantienen:

1. **`story.wallColumns` y `story.wallRows` no rigen en formato vertical.** El muro alto (3 columnas, 12 filas) lo decide el formato: las columnas y filas que declara un tema se piensan para un cuadro apaisado. Lo que el video pide en `spec.design.wall.columns` / `rows` sí rige en todos los formatos.
2. **Las barras de la miniatura del cierre llevan un escalón menos de radio** que `chart.barRadius` (con el valor por defecto, `radius.sm` en vez de `radius.md`) y la línea 1 px más: la miniatura es un gráfico chico dentro de un panel y el radio se escala con él.

## Tokens de movimiento, nubes y colores de datos

Fuera de `style`, el adaptador de tokens (`themeFromTokens`) lee ahora: `--cloud-blur` (px, 0 a 400); `--ease-standard`, `--ease-out`, `--ease-in-out` (`cubic-bezier(x1, y1, x2, y2)`, cuatro números o, en JSON, una lista `[x1, y1, x2, y2]`; `x1` y `x2` entre 0 y 1) y `--duration-fast`, `--duration-base`, `--duration-slow` (cuadros: `12` o `12f`; `400ms` y `0.4s` se pasan a cuadros a 30 fps). También valen con prefijo `motion-` y `easing-`. Todo queda en `report.mapped` (`motion.easing.out`, `motion.duration.base`, `cloud.blur`); un valor inválido avisa en `report.warnings` y deja el de la base.

**Colores de datos de una interfaz recreada.** Un color de `data` declara sobre qué superficies se dibuja con `on` (por defecto `surface`): un rol (`bg`, `surface`, `surfaceAlt`), otro color de datos (`data.fichaFondo`) o un color (`#101820`), que sirve para las superficies PROPIAS de una herramienta recreada dentro de un `ThemeScope`. `scope` es una nota de dónde aparece ("dentro de la ficha oscura"). `checkTheme` lo juzga **solo** contra esas superficies (con `on: []` no lo juzga contra nada del tema) y el aviso lleva el ámbito. Ojo: declararlo no apaga a `qa`, que sigue juzgando el texto real en pantalla contra su fondo real; si el texto está sobre otra superficie de la que declaraste, `qa` lo va a decir.

```ts
themeFromTokens(css, base, { data: { ficha: { on: [] }, ok: { on: ["data.ficha"], min: 4.5, scope: "dentro de la ficha oscura" } } });
```

## Límites conocidos

Cosas que un design system **no puede** decidir por diseño (son del video o de la herramienta, no del estilo):

- **El recorrido y los tiempos de la cámara:** a dónde va, cuándo y con qué curva sale de la escena (`cameraAt`, `zoomThrough`); el estilo solo regula la inclinación (`cameraTilt`) y el desenfoque (`cameraBlur`).
- **La composición y la geometría de una escena:** dónde va cada panel, cuántas columnas tiene una grilla, el orden de lectura. El estilo cambia el aspecto de las piezas, no su lugar (salvo el muro de la apertura, que tiene sus campos `wall*`).
- **Los tamaños de letra y el área segura:** salen de `theme.type` y `theme.safe`, no de `style` (ver "Qué NO puede depender del estilo").
- **Los marcos de dispositivo** (`PhoneFrame`, `PhoneOrbit`): un teléfono sigue siendo un teléfono.
- **`backdrop-filter` (desenfoque del fondo de un vidrio):** no se usa porque rompe el determinismo del render; el vidrio se emula con opacidad (`surface.opacity`).
- **El muro del cierre y el diseño de las miniaturas:** grilla y medidas fijas.
- **`handoff: "through"` apunta al primer tema que TIENE escena:** si el primer tema no la tiene (`composeStory` recibió `null`), el atravesado de la apertura y el acople de `dock` van al primero con escena, no al primero de la lista.

## Qué NO puede depender del estilo

- **Tamaños que afectan la lectura:** la escala `theme.type` (incluidos `ui` y `display`), el área segura `theme.safe`, la letra mínima de 18 px y el contraste de 4,5:1 que revisa `qa`. El estilo no cambia tamaños de letra.
- **Tamaño exterior de lo que se mide:** `Chip` (`fitText`), `Pill` (`pillFit`), la lista (`listLayout`), el muro y las miniaturas se miden para que quepan. Un borde más grueso o un `titleTracking` distinto no pueden correr esas medidas: el borde se compensa con el relleno (o `boxSizing: "border-box"` con el relleno calculado con el borde nominal de 2 y 3 px) y el interletrado entra en la estimación del ancho del texto (`fitText` y `measureWidth` reciben el `letterSpacing`). `eyebrowCase: "upper"` ensancha el texto un 10 a 15 %: las piezas que miden eyebrows lo cuentan.
- **El contenido y la jerarquía:** ni `doodles: false` ni `transition: "cut"` pueden quitar información. Una escena se entiende sin garabatos y sin velo.
- **Determinismo:** ninguna ayuda usa estado, azar ni reloj; `noise` es un mosaico fijo; nada se anima con CSS. En reposo no se emiten `transform`, `opacity`, `filter` ni `clipPath` identidad.
- **La forma del aparato en `PhoneFrame` / `PhoneOrbit`:** un teléfono sigue siendo un teléfono con `shape.corners: "sharp"` (el borde del dispositivo no es "la esquina del design system"); lo que se muestra dentro sí sigue el estilo.
- **Colores:** `useTheme().color`. El estilo elige cómo se usan; nunca introduce un `#hex` en una pieza.

## Reglas de revisión

- `checkTheme` revisa el estilo: valores inválidos (error) y, con el vidrio, las superficies teñidas, el marcador, los números atenuados, los fondos de patrón y las tarjetas sin borde ni sombra, el contraste del texto sobre el peor fondo posible. Revisa también los grupos nuevos: `line.weight: "hairline"` con `color.border` o acento de poco contraste sobre el fondo, `line.glow` sobre un acento que no se separa del fondo, sólidos `outline` o `translucent` cuya arista (`edge`) falla el contraste o no existe, `solid.contrast` bajo, `text.tile` (glifo y loseta casi iguales), el cursor `block` (`onAccent` sobre `accent`) y el adorno `marker`, `underline` o `box` de `text.decoration`. Los pares se pueden reconocer en `acknowledge` con nombres `style.surface.glass/textMuted`, `style.surface.tinted/text`, `style.type.highlight/marker`, `style.type.numerals/textMuted`, `style.background.<tipo>/text`, `style.surface/edge`, `style.line.hairline/border`, `style.line.hairline/accent`, `style.line.glow/accent`, `style.solid.edge/<arista>`, `style.solid.contrast`, `style.text.tile.<tipo>/ink`, `style.text.caret/onAccent`, `style.text.decoration/<adorno>`.
- Cada design system trae un tema que pasa `checkTheme` sin reconocimientos (los tres de `themes/` lo hacen).

## Historial de la migración (hecha)

Esta lista es el plan con el que se migró cada carpeta, conservado como referencia de cómo se prueba una pieza nueva. Todas las tareas están hechas. El patrón: (a) la pieza llama a la ayuda; (b) con el estilo por defecto el HTML del cuadro es **idéntico** al de antes (se prueba con `rest.test.tsx` de la carpeta y `--check`); (c) con `editorial`, `neon` y `papel` se ve distinta y pasa `qa`. Orden: `kit` → `stories` → `fx` (text, three, data, ui, art) → `examples`.

### 1. `kit/` (10 tareas)

1. Revisión sin cambios de código: `Cursor`, `FlyingCard`, `World`, `CountUp` y `kit/camera.ts` (función pura sin tema) no tienen forma ni superficie y quedan como están; `CountUp` no sigue `numerals` (es una métrica). Dejarlo dicho en `kit/README.md`.
2. `CloudBackground`: la opacidad por defecto pasa a `backgroundLayer(theme).cloudOpacity` (con intensidad 1 es `theme.cloud.opacity`).
3. `Stage`: dibuja `backgroundLayer(theme).style` en una capa `position: absolute; inset: 0` bajo las nubes; las nubes solo si `clouds` y `layer.clouds` (o si la escena pasa `cloud` a propósito).
4. `DockedHeadline`: `surfaceStyle(theme, "headline")`, título con `textStyle("title")`, número con `numeralStyle` (`GradientText` solo si `numerals` es `gradient`), `gradientLoop` por defecto de `decor.gradientLoop`, entrada con `entrance(..., { native: "slide", distance: 30 })`. Mantener el reposo sin `opacity` ni `transform`.
5. `GradientText`: `loop` por defecto de `decor.gradientLoop`.
6. Nueva `kit/Highlight` (y `kit/Numeral`) que envuelven `highlightStyle` y `numeralStyle`, para que stories y escenas no repitan lógica.
7. `Wash`: usar `transitionVeil` (`through` y `cut` sin velo hasta el final); conservar `data-qa-veil`.
8. `Vignette`: `strength * vignetteStrength(theme)`.
9. `Doodles` (+ `kit/doodle.ts`): `doodleStyle`; `enabled: false` devuelve `null`; `jitter: false` pide un modo de amplitud 0 en `circlePoints`/`arrowPoints`/`underlinePoints`.
10. Documentación y pruebas: `kit/README.md` y un caso por pieza en `kit/rest.test.tsx` con los tres temas; `docs/guia-escenas.md` indica `cameraOptions(theme)` para quien llama a `cameraAt`.

### 2. `stories/` (11 tareas)

1. `types.ts`: agregar `closing.bar?: boolean` a `StoryDesign` y a `validateDesign`.
2. `shared.tsx`: `useStoryDesign(spec)` = `withStoryDefaults(useTheme(), spec.design)`; todo bloque lo usa en lugar de leer `spec.design` crudo (`listOptions`, `wallOptions` reciben el diseño ya mezclado). `layout.ts` (`listLayout`, muro) recibe el mismo.
3. `StoryStage`: `backgroundLayer` (igual que `Stage`).
4. `Chip`: `surfaceStyle(theme, "chip", { on, faint, glow: pop })` + `textStyle("label")`; la medida (`fitText`) no cambia con el borde.
5. `Pill`: `surfaceStyle(theme, "pill", { glow })`; el número con `numeralStyle` cuando `numerals` no es `gradient` (hoy usa `pillNumberColor` porque el degradado no llega a 4,5:1 sobre la superficie: se mantiene).
6. `HeadlineRow`: nombre con `textStyle("title", { tracking: -0.02 })`, número con `numeralStyle(..., { loop })`, barra con `accentMark(theme, { length, thickness: ROW_GAP.bar, progress })`.
7. `HighlightedTitle` y firma (`RichText`/`GradientText`): `highlightStyle`.
8. `Opening`: cartel con `surfaceStyle(theme, "title")` (reemplaza `glass ? ...`), `handoff` y `wall` del diseño mezclado, `cameraAt` con `cameraOptions(theme)`, desenfoque y cartel con `entrance`.
9. `Interlude` e `InterludeCompact`: punto y anillo de tilde con `cornerRadius("chip")`, `cameraOptions`, `Wash` del kit.
10. `Closing`: panel del cierre con `surfaceStyle(theme, "panel")`, barras de las miniaturas con `chartStyle(theme).barRadius`, barra de la firma con `accentMark` y `closing.bar`, fondo `closing.bg`.
11. Pruebas: `stories/opciones.test.tsx` agrega "el diseño del video pisa al del tema" y "con el tema por defecto no cambia"; `rest.test.tsx` con los tres temas; `README.md` (la tabla de `design` dice qué sale del tema).

### 3. `fx/text/` (4 tareas)

1. Los efectos que hoy usan `semibold` (ver cada archivo): peso por defecto = `textStyle(theme, "title").fontWeight`; `props.weight` sigue ganando.
2. `measure.ts` y los efectos que miden: aceptar `letterSpacing` y sumarlo al ancho (para `titleTracking`).
3. `MaskedRise` y `SplitFlap`: `each` = `staggerFrames(theme, 1, { base: each })`.
4. `MaskedRise` con `dot`: el punto sigue (no depende de `decor.accent`); `README.md` del grupo.

### 4. `fx/three/` (3 tareas)

1. `CardFlip` y `CarouselRing`: tarjetas con `surfaceStyle(theme, "card")` y `cornerRadius("card")`/`("control")`.
2. Escalonado de `Bars3D` (si tiene `staggerT`): `staggerScale`.
3. Prueba de que `three/` no cambia con el estilo por defecto (`components.test.tsx`). El resto (`Globe`, `Helix`, `Tunnel`...) es geometría y no se toca; `PhoneOrbit` es el caso de `PhoneFrame` (exento).

### 5. `fx/data/` (5 tareas)

1. `BarsGrow`: radio con `chartStyle(theme).barRadius`, relleno con `chartFill` (con `<defs>` de id derivado de `seed`/índice), líneas de guía cuando `grid` es `on`.
2. `LineDraw`: grosor `chartStyle(theme).lineWidth`; guías según `grid` (`auto` = como hoy).
3. `RadarMorph`: grosor y anillos según `lineWidth` y `grid`.
4. `FlowSteps`: panel con `cornerRadius("panel")`, número de paso con `numeralStyle`, escalonado con `staggerScale` si usa `staggerT`.
5. `Bars3D` y `DonutRing`: sin cambio (geometría); dejar nota en el README del grupo.

### 6. `fx/ui/` (8 tareas)

1. `NotificationStack`: `surfaceStyle(theme, "card")`, entrada con `entrance(..., { native: "rise", distance: 50 })` y el escalonado con `staggerScale`.
2. `ChatThread`, `CommandPalette`, `TileGrid`, `CardFan`, `BeforeAfter`, `TileDone`: superficie con `surfaceStyle` (el rol que corresponda) y radios con `cornerRadius`.
3. `TileGrid` y `CardFan`: escalonado con `staggerScale` y entrada con `entrance` (`native: "scale"` donde hoy escalan).
4. `PhoneFrame` y `PhoneScroll`: la pantalla y el borde del aparato **no** siguen `shape.corners` (exentos); el contenido de pantalla sí.
5. Rótulos pequeños (hora de la notificación, etiquetas): `textStyle("eyebrow")`.
6. `ui.test.tsx`: "reposo sin identidades" con los tres temas.
7. `fx/ui/README.md`: tabla de qué estilo toma cada efecto.
8. `phoneScreenRadius` queda como está.

### 7. `fx/art/` (3 tareas)

1. `PaperCollage` y `BlueprintDraw`: tarjeta/panel con `cornerRadius` (`panel`) y `surfaceStyle`; `BlueprintDraw` conserva su grilla propia (es su contenido).
2. `MarkerDraw`: trazo con `doodleStyle(theme).jitter` y `highlightStyle` (`marker`) si se usa como resalte.
3. `fx/art/README.md`. Los demás (`LogoLand`, `SealSpin`, `ShapeMorph`, `HalftoneWave`, `LiquidBlob`, `DotWipe`, `PixelBuild`, `RibbonTwist`) no cambian.

### 8. `examples/` y docs (5 tareas)

1. Nuevo `examples/design-systems`: la misma escena (titular, lista, tarjetas, gráfico, garabato, cierre) renderizada con `neutral`, `editorial`, `neon` y `papel` vía `ThemeScope`, con `formats` horizontal, vertical y cuadrado; `--check` en los tres formatos y `qa` en limpio.
2. `examples/story-demo` y `examples/kit-demo`: con un selector de tema por `--props` (`{"theme":"neon"}`).
3. `examples/theme-scope`: agregar el estilo a la demostración.
4. `docs/animaciones.md` y `docs/guia-escenas.md`: una línea por ayuda y la regla "no ramificar sobre cadenas del estilo".
5. `CLAUDE.md` y `docs/reglas.md`: agregar a "Todo sale del tema" que las decisiones de forma, superficie y movimiento salen de `theme.style` por las ayudas.

Total: 49 tareas (kit 10, stories 11, fx/text 4, fx/three 3, fx/data 5, fx/ui 8, fx/art 3, examples y docs 5).
