# Estilo del design system (`theme.style`)

Contrato para quien migra `kit/`, `stories/`, `fx/` y `examples/`. Objetivo: cambiar el design system cambia la **estética** (forma, superficies, tratamiento del texto, fondo, movimiento, decoración) y no solo los colores, sin tocar el código de las escenas. Hasta ahora un tema cambiaba colores, tipografías, radios, sombras, curvas y nubes; la composición y el carácter estaban fijos en las piezas, y las decisiones de estilo vivían en `spec.design` de cada video. `theme.style` sube esas decisiones al tema; `spec.design` pasa a ser un ajuste por video sobre el design system.

Estado: **la capa existe en `themes/`; `fx/text` y `fx/three` leen los grupos `type`, `shape`, `surface`, `motion.stagger`, `line`, `solid`, `depth` y `text` (ver las tablas); el resto de las piezas todavía no.** Con el estilo por defecto el resultado es idéntico al de hoy (lo prueban las pruebas de `themes/style.test.tsx`, que comparan contra los valores literales de las piezas). Cada pieza se migra en el orden de la lista del final.

## Cómo se usa

- `theme.style` es opcional y parcial en el tema; `useTheme().style` siempre viene **completo** (como `data` y `type.ui`). Un valor inválido lanza un error que lista lo que se acepta; `checkTheme` lo informa como error sin lanzar.
- Las piezas **no comparan cadenas del estilo**: llaman a las ayudas de `themes/` (`import { surfaceStyle, ... } from "../themes"`). Son puras, deterministas y devuelven estilos planos que **omiten los valores identidad** (sin `translateY(0px)`, `scale(1)`, `opacity: 1`); si el conjunto de propiedades cambia durante la animación, la pieza usa `styleKey` de `fx/core` como `key` (ver `docs/reglas.md`, "Residuos en elementos quietos").
- Los tokens son `--style-<grupo>-<campo>` (`--style-shape-corners`); en JSON, `{ style: { shape: { corners: "sharp" } } }`; compacto: `themeFromTokens(tokens, base, { style: {...} })`. Detalle en `themes/README.md`.
- Los tres design systems de ejemplo (`editorial`, `neon`, `papel`, en `themes/`) sirven de prueba: una pieza migrada tiene que verse distinta con cada uno.

## Campos, valores y quién los cumple

Los valores por defecto (primer valor de cada lista, o el número que se indica) reproducen el aspecto actual. "Estado": **sin consumidor** = ninguna pieza lo lee hoy (todos, hasta que se migre); "sin candidato claro" marca los campos que agregué y cuya pieza consumidora no está definida con seguridad.

### `shape`: forma

| Campo | Valores (por defecto) | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `corners` | `pill` (por defecto), `rounded`, `sharp` | `DockedHeadline`, `Chip`, `Pill` (stories), píldoras de `Interlude`: radio de chip (`pill` = 999, `rounded` = `radius.md`, `sharp` = 0). Tarjetas de `fx/ui` (`NotificationStack`, `ChatThread`, `CommandPalette`, `TileGrid`, `CardFan`, `BeforeAfter`, `TileDone`), `CardFlip`, `CarouselRing`, panel del cierre, cartel de la apertura: radio de tarjeta/panel/cartel. Barras de acento y de firma: radio de barra. | `cornerRadius(theme, role)` con rol `chip` / `card` / `panel` / `hero` / `control` / `bar` | sin consumidor |
| `border` | 0 a 6 px (1) | Borde de todas las superficies: la pieza suma lo suyo (chip +1, píldora +2: con 1 da los 2 y 3 px de hoy). | `borderWidth(theme, role)` (o `surfaceStyle`) | sin consumidor |
| `outlined` | `true` (por defecto), `false` | `false` quita el borde de tarjetas, chips y píldoras (solo `surface.kind: "outline"` lo conserva, porque ese tipo es un borde). | `surfaceStyle` | sin consumidor |

### `surface`: superficies

| Campo | Valores | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `kind` | `solid` (por defecto), `glass`, `outline`, `tinted` | Relleno de las mismas piezas de arriba: `solid` = `color.surface`; `glass` = `surface` con `opacity` (emulado, sin `backdrop-filter`); `outline` = relleno del fondo y borde de tinta (`color.text`); `tinted` = `surface` teñida 10 % de acento. El cartel de la apertura usa vidrio si `story.titleCard` es `glass`. | `surfaceStyle(theme, role, { on, faint, glow, level })` con rol `card` / `panel` / `headline` / `chip` / `pill` / `title` | sin consumidor |
| `elevation` | `shadow` (por defecto), `flat`, `border`, `glow` | Sombra de esas piezas: `shadow` = la del tema (`sm`/`md`/`lg` según el rol); `flat` = ninguna (tampoco halos); `border` = filo duro desplazado en tinta, sin desenfoque; `glow` = halo de acento y borde de acento. El destello de un chip (`pop`) y el halo de la píldora solo existen con `shadow` y `glow`. | `surfaceStyle` | sin consumidor |
| `opacity` | 0,3 a 1 (0,74) | Opacidad del relleno `glass`. | `surfaceStyle` | sin consumidor |

### `type`: tratamiento del texto

| Campo | Valores | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `titleWeight` | `regular`, `medium`, `semibold` (por defecto), `stat` | Peso de titulares: título de `DockedHeadline`, nombre de la fila (`HeadlineRow`), nombre de `Pill`, texto de la firma, efectos de `fx/text` que hoy usan `semibold` (cuando no llega `weight`), `MarkerDraw`. (`ExtrudeType` usa `stat` y no se toca.) | `textStyle(theme, "title", { tracking })` | sin consumidor |
| `labelWeight` | ídem (`medium`) | Peso de rótulos: `Chip`, etiquetas de `fx/ui`. | `textStyle(theme, "label")` | sin consumidor |
| `titleTracking` | -0,1 a 0,2 em (0) | Se **suma** al interletrado que la pieza ya lleva (los nombres de la lista llevan -0,02 em: `tracking: -0.02`). | `textStyle` | sin consumidor |
| `eyebrowCase`, `eyebrowTracking` | `as-is` / `upper`; 0 a 0,4 em (0) | Rótulos del tamaño `type.eyebrow`: subtítulo de `DockedHeadline`, línea de la lista, etiquetas pequeñas de `fx/ui`. | `textStyle(theme, "eyebrow")` | sin candidato claro (no hay hoy un componente "eyebrow"; conviene crear `kit/Eyebrow` al migrar) |
| `numerals` | `gradient` (por defecto), `solid`, `outline`, `muted` | Números de paso y de lista: `DockedHeadline` (número), `HeadlineRow` (número), `Pill` (número), números de `FlowSteps`. **No** rige en métricas (`DigitRoll`, `SplitFlap`, `CountUp`, `DonutRing`): son cifras de contenido, no ordinales. | `numeralStyle(theme, { frame, loop, on })` | sin consumidor |
| `highlight` | `gradient` (por defecto), `underline`, `marker`, `accent` | Palabra resaltada: `HighlightedTitle` (stories), `GradientText` cuando se usa como resalte; `MarkerDraw` (fx/art) ya dibuja un resalte de marcador con el acento y se alinea con `marker`. | `highlightStyle(theme, { frame, loop, progress })` | sin consumidor |

### `background`: fondo

| Campo | Valores | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `kind` | `clouds` (por defecto), `plain`, `grid`, `dots`, `gradient`, `noise` | `Stage` y `StoryStage`: capa de fondo bajo el contenido; `CloudBackground` solo se dibuja con `clouds` (o si la escena pasa `cloud` a propósito). `noise` es un mosaico SVG fijo generado con un generador congruencial: determinista y sin animación. | `backgroundLayer(theme)` → `{ kind, clouds, cloudOpacity, style }` | sin consumidor |
| `intensity` | 0 a 1 (1) | Multiplica la opacidad de las nubes (`theme.cloud.opacity`) o la fuerza del patrón. | `backgroundLayer` | sin consumidor |

Los parámetros de las nubes siguen en `theme.cloud`.

### `motion`: carácter del movimiento (sobre `easing` y `duration`, que no cambian)

| Campo | Valores | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `entrance` | `auto` (por defecto), `rise`, `fade`, `scale`, `slide`, `wipe` | Entrada de elementos genéricos: `DockedHeadline` (hoy desliza -30 px), tarjetas de `NotificationStack` (sube 50 px con asentado), burbujas de `ChatThread`, `TileGrid`, `CardFan`, `CommandPalette`, filas y cartel de stories. `auto` deja a cada pieza con la suya (`native`, `distance`); otro valor la reemplaza. Los efectos con animación propia (`MaskedRise`, `KineticWords`...) no la usan. | `entrance(theme, progress, index, { native, distance, from, side, alternate })` | sin consumidor |
| `overshoot` | 0 a 0,3 (0) | Rebote al asentarse de lo que pasa por `entrance`. | `settle(p, overshoot)` / `entrance` | sin consumidor |
| `stagger` | 0 a 12 cuadros (4) | Paso entre elementos de un conjunto: Piezas con paso en cuadros (`MaskedRise`, `SplitFlap`, filas de la lista): pasan **su propio paso** como `base` y el tema lo escala (4 = sin cambio, 2 = la mitad). Piezas que escalonan con una fracción de su duración (`staggerT`: `NotificationStack`, `CardFan`, `BarsGrow`, `Bars3D`, `LogoLand`, `PaperCollage`, `BlueprintDraw`): `spread * staggerScale(theme)`, con tope 0,95. | `staggerFrames(theme, index, { base })` / `staggerScale(theme)` | sin consumidor |
| `cameraBlur` | `true` / `false` | Quien llama a `cameraAt` (`Opening`, `Interlude`, escenas de `examples/`): `false` pasa `maxBlur: 0`. | `cameraOptions(theme)` → `{ tiltGain?, maxBlur? }` para esparcir en las opciones de `cameraAt` | sin consumidor; lo aplica quien llama, no una pieza |
| `cameraTilt` | 0 a 3 (1) | Multiplica `tiltGain` (0,05) de `cameraAt`. | `cameraOptions` | ídem |
| `transition` | `wash` (por defecto), `through`, `cut`, `wipe` | `Wash` (kit): `wash` = velo; `wipe` = cortina de izquierda a derecha; `cut` = escalón al llegar a 1; `through` = sin velo (la escena siguiente entra sobre el fondo que sigue; hace falta que el final de la escena atraviese un elemento, como hoy). Conserva `data-qa-veil` y `data-qa-ignore="covered"` en `wash` y `wipe`. | `transitionVeil(theme, progress, color?)` → `{ kind, style } \| null` | sin consumidor |

### `decor`: decoración

| Campo | Valores | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `doodles` | `true` / `false` | `DoodleCircle`, `DoodleArrow`, `DoodleUnderline` devuelven `null` con `false`. Una escena no puede depender de un garabato para que se entienda. | `doodleStyle(theme).enabled` | sin consumidor |
| `doodleStroke` | `hand` (por defecto), `geometric` | `hand` = el temblor de hoy; `geometric` = trazo limpio (amplitud 0): `kit/doodle.ts` necesita un modo sin temblor. También `MarkerDraw`. | `doodleStyle(theme).jitter` | sin consumidor (pide una capacidad nueva en `kit/doodle.ts`) |
| `vignette` | 0 a 2 (1) | `Vignette`: multiplica `strength` (0 la apaga). | `vignetteStrength(theme)` | sin consumidor |
| `accent` | `underline`, `bar` (por defecto), `dot`, `none` | Marca de acento de cada fila de la lista (`HeadlineRow`, hoy barra de degradado de 8 px) y de la firma del cierre; `MaskedRise` con `dot` conserva su punto. | `accentMark(theme, { length, thickness, progress })` | sin consumidor |
| `gradientLoop` | 0 o entero >= 2 (0) | Vaivén del degradado de `GradientText` (cuando no recibe `loop`), de `numeralStyle` y `highlightStyle`, y de `story.gradient.loop`. | `numeralStyle`, `highlightStyle`, `storyDefaults` | sin consumidor |

### `story`: valores por defecto de `StoryDesign` (`spec.design` los pisa)

| Campo | Equivale a | Estado |
|---|---|---|
| `titleCard` | `design.titleCard` (`solid` por defecto) | sin consumidor |
| `listLayout`, `listUnderline` | `design.list` (`stacked`, `row`) | sin consumidor |
| `handoff` | `design.handoff` (`wash`). No se deriva de `motion.transition`: la transición rige entre escenas; el `handoff`, el cierre de la apertura | sin consumidor |
| `headlineSize` | `design.headline.size` (`md`) | sin consumidor |
| `closingBg` | `design.closing.bg` (`bg`; un rol de color del tema) | sin consumidor |
| `signoffBar` | **no existe en `StoryDesign` hoy**: hay que agregar `closing.bar?: boolean` (y validarlo) y que `Closing` lo cumpla | sin consumidor y sin campo en stories |
| `wallColumns`, `wallRows` | `design.wall.columns/rows` (vacío = según el formato: 6 y 6 en horizontal, 3 y 12 en vertical) | sin consumidor |
| `wallChipScale`, `wallDolly`, `wallDepth` | `design.wall.chipScale/dolly/depth` (1, 0, 1) | sin consumidor |
| `wallBlurOpening`, `wallBlurClosing` | `design.wall.blur.opening/closing` (`true`) | sin consumidor |
| (`decor.gradientLoop`) | `design.gradient.loop` | sin consumidor |

Ayudas: `storyDefaults(theme)` da los valores del tema en la forma larga de `StoryDesign`; `withStoryDefaults(theme, spec.design)` los mezcla con lo que el video indica (gana el video), acepta las formas cortas (`list: "inline"`, `wall.blur: false`) y devuelve siempre la larga; deja pasar `clouds` y lo demás.

### `chart`: gráficos

| Campo | Valores | Pieza → qué cambia | Ayuda | Estado |
|---|---|---|---|---|
| `barRadius` | `none`, `sm`, `md` (por defecto), `lg`, `pill` | Esquinas de las barras: `BarsGrow` (hoy `radius.md`), barras del miniaturizado del cierre (hoy `radius.sm`). | `chartStyle(theme).barRadius` (px) | sin consumidor |
| `lineWidth` | 1 a 12 px (5) | `LineDraw` (hoy 5), contorno de `RadarMorph` (hoy 4). | `chartStyle(theme).lineWidth` | sin consumidor |
| `grid` | `auto` (por defecto), `on`, `off` | `auto` = cada gráfico como hoy (`LineDraw` y `RadarMorph` dibujan guías de 1,5 px; `BarsGrow` solo la línea base). `on` / `off` fuerzan. | `chartStyle(theme).grid` | sin consumidor |
| `fill` | `solid` (por defecto), `gradient`, `hatched` | Relleno de barras y áreas (`BarsGrow`, `Bars3D` no: es geometría). `gradient` y `hatched` necesitan un `<defs>` con un id derivado de las props (nunca `useId`). | `chartFill(theme, color, id)` | sin consumidor |

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

## Qué NO puede depender del estilo

- **Tamaños que afectan la lectura:** la escala `theme.type` (incluidos `ui` y `display`), el área segura `theme.safe`, la letra mínima de 18 px y el contraste de 4,5:1 que revisa `qa`. El estilo no cambia tamaños de letra.
- **Tamaño exterior de lo que se mide:** `Chip` (`fitText`), `Pill` (`pillFit`), la lista (`listLayout`), el muro y las miniaturas se miden para que quepan. Un borde más grueso o un `titleTracking` distinto no pueden correr esas medidas: el borde se compensa con el relleno (o `boxSizing: "border-box"` con el relleno calculado con el borde nominal de 2 y 3 px) y el interletrado entra en la estimación del ancho del texto (`fitText` y `measureWidth` reciben el `letterSpacing`). `eyebrowCase: "upper"` ensancha el texto un 10 a 15 %: las piezas que miden eyebrows lo cuentan.
- **El contenido y la jerarquía:** ni `doodles: false` ni `transition: "cut"` pueden quitar información. Una escena se entiende sin garabatos y sin velo.
- **Determinismo:** ninguna ayuda usa estado, azar ni reloj; `noise` es un mosaico fijo; nada se anima con CSS. En reposo no se emiten `transform`, `opacity`, `filter` ni `clipPath` identidad.
- **La forma del aparato en `PhoneFrame` / `PhoneOrbit`:** un teléfono sigue siendo un teléfono con `shape.corners: "sharp"` (el borde del dispositivo no es "la esquina del design system"); lo que se muestra dentro sí sigue el estilo.
- **Colores:** `useTheme().color`. El estilo elige cómo se usan; nunca introduce un `#hex` en una pieza.

## Reglas de revisión

- `checkTheme` revisa el estilo: valores inválidos (error) y, con el vidrio, las superficies teñidas, el marcador, los números atenuados, los fondos de patrón y las tarjetas sin borde ni sombra, el contraste del texto sobre el peor fondo posible. Los pares se pueden reconocer en `acknowledge` con nombres `style.surface.glass/textMuted`, `style.surface.tinted/text`, `style.type.highlight/marker`, `style.type.numerals/textMuted`, `style.background.<tipo>/text`, `style.surface/edge`.
- Cada design system trae un tema que pasa `checkTheme` sin reconocimientos (los tres de `themes/` lo hacen).

## Lista de migración, en orden

Cada carpeta se migra entera, con el mismo patrón: (a) la pieza llama a la ayuda; (b) con el estilo por defecto el HTML del cuadro es **idéntico** al de antes (se prueba con `rest.test.tsx` de la carpeta y `--check`); (c) con `editorial`, `neon` y `papel` se ve distinta y pasa `qa`. Orden: `kit` → `stories` → `fx` (text, three, data, ui, art) → `examples`.

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
