# kit

Kit de movimiento reutilizable sobre `engine/` y `themes/`. Todo sale de `kit/index.ts`.

## Regla de pureza

Cada pieza es una función pura del cuadro (de `useFrame()` o de una prop `frame` explícita) y del tema (`useTheme()`). La lista completa está en `docs/reglas.md` ("Lista única de determinismo"): nada de estado que acumule, temporizadores, animaciones CSS, `useId` ni `Math.random` (se usa `random(seed)` del motor). Colores, tipografías, radios, sombras y curvas salen del tema: ninguna pieza trae valores de marca. `__ve.checkDeterminism` debe dar `ok` en las escenas que las usan.

## Estilo del design system (`theme.style`)

Las piezas con forma, superficie, texto, fondo o movimiento leen `theme.style` por las ayudas de `themes/` (`surfaceStyle`, `cornerRadius`, `textStyle`, `numeralStyle`, `highlightStyle`, `entrance`, `transitionVeil`, `backgroundLayer`, `doodleStyle`, `vignetteStrength`). Con el estilo por defecto (`neutral`, `dark`) el marcado y los píxeles son los de antes; con `editorial`, `neon` y `papel` se ven distintas (`examples/kit-demo`, `{"theme":"neon"}`). Ninguna pieza compara cadenas del estilo.

| Pieza | Qué toma del estilo |
|---|---|
| `Stage` | props `clouds` (por defecto sí), `cloudOpacity`, `cloud` (`CloudOptions`: colores, cantidad, semilla, manchas, opacidad, desenfoque, deriva) y `frame`; el fondo sale de `theme.style.background` (nubes, liso, grilla, puntos, degradado, grano) y las nubes solo se dibujan si ese estilo las pide o si la escena pasa `cloud` |
| `CloudBackground` | opacidad por defecto = `theme.cloud.opacity * background.intensity`; desenfoque por defecto = `theme.cloud.blur` (110 px si el tema no lo declara); deriva por defecto = `background.drift` (1 = el vaivén de siempre, 0 = quietas, 2 a 3 se nota); lo leen también `Stage` y `StoryStage` |
| `DockedHeadline` | `surfaceStyle("headline")`, `textStyle("title")` y `("caption")` (el subtítulo; sigue al eyebrow salvo que el design system fije `type.caption*`), número por `Numeral`, `entrance(native: slide, 30 px)`; el tamaño exterior no cambia con el borde |
| `GradientText` | `decor.gradientLoop` cuando no recibe `loop` ni `pan` |
| `Numeral`, `Highlight` | `type.numerals` y `type.highlight` (con `decor.gradientLoop`) |
| `Eyebrow` | `type.eyebrowCase` y `eyebrowTracking` |
| `Wash` | `motion.transition`: `wash`, `wipe` (cortina), `cut` (escalón) o `through` (sin velo); conserva `data-qa-veil` |
| `Vignette` | `strength * decor.vignette`; color por defecto = `decor.vignetteColor` (el acento) |
| `DoodleCircle/Arrow/Underline` | `decor.doodles: false` no dibuja; `doodleStroke: geometric` = trazo sin temblor (elipse cerrada, raya recta, remates rectos). Son para sistemas de trazo a mano: para señalar, `Callout` |
| `useCameraAt` | `cameraAt` con `cameraOptions(theme)` por defecto (`cameraBlur`, `cameraTilt`); lo explícito en `opts` gana |

Sin cambios (no tienen forma ni superficie): `Cursor`, `FlyingCard` (dibuja lo que le pasan los hijos; puede girar y cambiar de tamaño en vuelo), `World`, `CountUp` (es una métrica: no sigue `numerals`) y `camera.ts` (función pura sin tema; para el estilo, `useCameraAt` o `cameraOptions(theme)` esparcido en las opciones).

## Piezas

- **Ayudas**: `kf(frame, claves, valores, easing?)` cuadros clave; `track(frame, [[f, x, y], ...])` trayectos 2D; `typed(texto, frame, inicio, cps)` texto que se escribe.
- **Cámara**: `cameraAt(frame, claves, opts?)` devuelve `{x, y, scale, rx, ry, blur}` con inclinación y desenfoque según la velocidad (cámara quieta = sin inclinación ni desenfoque; topes configurables). `<World camera width height settled?>` aplica la transformación y el desenfoque a sus hijos (coordenadas del mundo) y marca su contenedor con `data-qa-world`. `zoomThrough(frame, [ini, fin], cam, objetivo, power?)` convierte la cámara en un atravesado de un punto (se pasa por `opts.map`). `<Wash frame range color?>` velo de cierre de escena; `useCameraAt(frame, claves, opts?)` es `cameraAt` con los valores del estilo.
- **Cursor y viñeta**: `<Cursor frame keys clicks show>` con onda de clic en el acento; `<Vignette amount color? strength?>` (color del design system, el acento por defecto; `color` es un rol del tema o `data.<nombre>`).
- **Profundidad**: `flyInZ(progress, { from, perspective, x, y, rotateX, rotateY, fade })` devuelve el `style` de una entrada en profundidad para un elemento (ver abajo).
- **Garabatos** (solo para sistemas de trazo a mano; para señalar, `Callout`) (trazo a mano que "hierve": el temblor se vuelve a sortear cada `boil` cuadros, 3 por defecto): `<DoodleCircle>`, `<DoodleArrow>`, `<DoodleUnderline>`; se dibujan y se desvanecen por cuadro; el trazo usa acento → acento 2 del tema. Cada uno necesita un `id` único.
- **Texto y fondo**: `<Eyebrow>`, `<Numeral>`, `<Highlight>` (rótulo, número de paso y palabra resaltada según el estilo), `<GradientText>` (degradado del tema, `pan` o `loop` opcionales), `<CloudBackground>` (manchas de `theme.cloud`, con `colors`, `count`, `seed`, `blobs`, `opacity` y `blur` para pisarlas), `<CountUp from to start duration format?>`.
- **Titular**: `<DockedHeadline index title subtitle frame start hide layout>` y `hideFromScale(scale, umbral?, rango?)` para que se aparte cuando la cámara se acerca.
- **Vuelo**: `flight(frame, [ini, fin], from, to, {arc})` y `<FlyingCard>` (arco y estela; `toWidth`/`toHeight` cambian el tamaño en vuelo y `rotate` gira, ver abajo).
- **Salida de la cámara**: `exitThrough(theme, frame, rango, cam, objetivo, native?)` para el `map` de `cameraAt`: el atravesado de siempre (`dive`) o el empuje suave de `motion.exit: settle`.
- **Atenuar lo demás**: `<FocusGroup range variant?>` envuelve lo que no es el objetivo de una señal `focus` (ver `Callout`).
- **Una escena dentro de otra**: `<NestedScene scene start? frame? format? scale | width | height>` (vista previa viva o miniatura).
- **Tema por ámbito**: `<ThemeScope theme paint? font? style?>` cambia el tema de un subárbol (se anida); con `paint` pinta fondo, texto y tipografía del tema; con `font` (sin `paint`) aplica solo la tipografía, sin pintar ni cambiar la maquetación; declara el `@font-face` de sus fuentes y espera su carga. Ver `themes/README.md`.
- **Escena**: `<Stage>` fondo, tipografía y nubes opcionales del tema.
- **Piezas de interfaz** (para recrear formularios, listas y avisos; `kit/ui.tsx`): `<Chip>`, `<Button>`, `<Avatar>`, `<Check>`, `<ListRow>` e `<Icon>`. Ver la tabla "Piezas de interfaz" abajo.
- **Subtítulos**: `<Subtitles cues estilo?>` (bloque o karaoke), hasta dos renglones medidos con `textWidth`, en el área segura de cada formato; `subtitleBand` es la franja que hay que dejar libre; lectores y escritores de JSON, SRT y VTT y `subtitulosDeGuion` en `kit/subtitulos.ts`. Guía completa: `docs/subtitulos.md`.
- **Maquetar sin píxeles fijos** (ver "Disposición y medidas" abajo): `textWidth(theme, texto, opts)` ancho medido; `<Callout>`, `placeBeside`, `calloutState` y `coveredOpacity` para una pastilla que se pone en lugar libre; `headlineStrip` y `cameraKeepClear` para dejar libre la franja del titular; `cameraView` para saber qué ve la cámara. Atenuar texto: `dimOpacity` / `dimmedColor` (en `themes/`).

## Tutorial de interfaz

Para un recorrido de una interfaz recreada: la cámara va de un foco al siguiente, cada foco queda **centrado** y lo que lo explica va **pegado** a él. Todo es función pura del cuadro y del tema. Receta corta: `npm run nuevo -- paso <slug> <nombre>` (la escena declara una interfaz y una tabla de tiempos) y el ejemplo `examples/tutorial-demo` (dos pasos, 10 s).

| Pieza | Qué hace |
|---|---|
| `<StepFrame overview zoom signals step? profile? keepClear? overlay? stops? returnAt? arrive? travel? margin? safe? targetPad?>` | El marco de paso. Recibe la cámara (vista general `{ x, y, scale? }`, rango de zoom `{ in, out? }`) y la lista de señales (`StepSignal`: `id?`, `target` (rectángulo del mundo), `start`, `duration`, `label?`, `labelSide?`, `card?: { label, value, side }`, `scale?`, `arrive?`, `variant?`) y dibuja la cámara guiada, el foco, la etiqueta, la tarjeta de dato y la barra de progreso (`step: { index, count, duration }`). La interfaz (en coordenadas del mundo) va de hijo. Los cuadros son los del contexto: dentro de un `Sequence`, los de ese paso. El perfil de cámara es `plana` por defecto. Con la señal `focus` del tema dibuja el anillo; atenuar lo demás es cosa de la escena (`FocusGroup` sobre lo que no es el objetivo). |
| `guidedCameraPlan(opts)` / `guidedCameraKeys(opts)` | Función pura que devuelve las claves de cámara (`CameraKey[]`) y las paradas (`GuidedStop`: `id`, `kind`, `arrive`, `depart`, `key`, `fits`). Arranca en la vista general; el acercamiento es el viaje al primer objetivo y cada objetivo queda centrado en el cuadro. Llega `arrive` cuadros después del inicio de la señal (14) y viaja en `travel` (22): sostiene la parada anterior y sale `travel` cuadros antes de llegar (si no hay tiempo, sale en cuanto llegó, con un viaje más corto). La escala es `zoom.in` y **solo** baja si el objetivo (con `targetPad`, 16) no entra en el área útil (el cuadro menos `margin`, 80, o `safe`): hasta `zoom.out` (por defecto la escala de la vista general); `fits: false` dice que ni así entra. `stops` suma encuadres a mano (llegan en su cuadro `f`) y `returnAt` vuelve a la vista general. Dos paradas que llegan en el mismo cuadro lanzan un error en español. `guidedSettledAt(plan, frame)` da la señal sobre la que está asentada la cámara. |
| `cameraAt(frame, keys, { profile: "plana" })` / `useCameraAt` | El perfil `plana` (`CAMERA_PROFILES`) apaga inclinación y desenfoque de movimiento: es la cámara de un recorrido de interfaz, donde las capas fijas se anclan con una proyección exacta. Lo explícito en `opts` gana al perfil, y el perfil gana a lo que pide el tema (`cameraTilt`, `cameraBlur`). |
| `projectRect(rect, cam, { width, height }, { perspective? })` y `projectPoint` | Dónde cae en pantalla un rectángulo (o un punto) del mundo con una cámara dada: la misma cuenta que `World`. Sin inclinación es la cuenta plana; con inclinación proyecta las cuatro esquinas con la perspectiva de `World` y devuelve la caja envolvente; si una esquina queda detrás de la cámara lanza un error que lo dice y sugiere el perfil `plana`. Es lo que ancla una capa de pantalla a algo del mundo sin quedar desfasada un cuadro. |
| `calloutDecision(theme, opts)` y `<Callout fixed={{ side, align }}>` | Lado y alineación de la etiqueta decididos **una sola vez**. `calloutDecision` se llama con el objetivo ya asentado (proyectado con la cámara final de su señal) y devuelve `{ side, align }`; pasado a `fixed` en cada cuadro, la pastilla ocupa siempre ese lado y solo sigue al rectángulo, sin cambiar de lado mientras la cámara viaja. Sin `fixed`, `Callout` se comporta como siempre. `placeBeside` acepta `align` (0, 0,5 o 1) y `decideBeside` devuelve lado y alineación elegidos. |
| `<DataCard target label value side? fixed? range avoid? within? gap? size?>` | Tarjeta de dato ampliado: rótulo chico y valor grande junto al foco, del lado indicado. Superficie `card` del tema, caja medida con `textWidth`, entrada `entrance`. `dataCardDecision` y `dataCardPlacement` dan la misma cuenta fuera de la pieza. |
| `<ProgressBar step steps progress? thickness?>` | Una sola barra fina arriba, sin fondo ni rótulo, del color de acento: avanza con el paso y el avance dentro del paso (`stepProgress(step, steps, within)`). Ancho y alto enteros. |

Límites del marco: es horizontal-primero (la disposición de la interfaz la decide quien la escribe: `useFormat().pick`); con la señal `focus` no atenúa lo demás solo (el objetivo está dentro del mundo, y `FocusGroup` atenúa todo lo que envuelve); la tarjeta con un lado sin lugar (por ejemplo `right` con el objetivo ya ancho) se corre y puede pisar el foco: elegí un lado con aire (`StepSignal.card.side`).

### Marcas para `qa`

El marco las pone; quien arme el mundo a mano con `World` puede ponerlas igual. Son atributos sin efecto visual.

| Atributo | Dónde va | Qué dice |
|---|---|---|
| `data-qa-world` (`"true"`) | El contenedor que la cámara transforma (lo agrega `World` siempre). | Lo que hay adentro se mueve con la cámara y el encuadre puede cortarlo a propósito: no es un error que una parte quede fuera del cuadro. |
| `data-qa-overlay` | Las capas fijas en espacio de pantalla que son anotaciones del video: la etiqueta y el trazo del foco (`Callout overlay`), la tarjeta de dato (`DataCard`) y la barra de progreso (valor `"progreso"`: no está anclada a un objetivo). | Lo que esas capas tapan no cuenta como defecto, salvo que sea el objetivo de la señal activa. |
| `data-qa-target` (el `id` de la señal) | El elemento, o un `div` transparente con su geometría dentro del mundo, que es el objetivo de la señal **activa** en ese cuadro (desde `start` hasta `start + duration`). | Ese objetivo nunca se exceptúa: si está cortado o tapado, es un defecto. |
| `data-qa-settled` (`"true"`) | El mismo contenedor `data-qa-world`, mientras la cámara está asentada sobre una señal (llegó y todavía no salió hacia la siguiente). No se emite viajando, en la vista general ni en una parada a mano. | Es cuando el objetivo tiene que estar centrado y legible. |

```tsx
// Una escena de un paso: la interfaz y una tabla de tiempos. El marco hace el resto.
const SENALES: StepSignal[] = [
  { id: "fecha", target: CAMPO_FECHA, start: 14, duration: 60, label: "Elegí la fecha", card: { label: "Cupos libres", value: "12 de 20", side: "below" } },
  { id: "boton", target: BOTON, start: 80, duration: 50, label: "Confirmá con este botón" },
];
<StepFrame overview={{ x: width / 2, y: height / 2 }} zoom={{ in: 1.6 }} step={{ index: 0, count: 2, duration: 150 }} signals={SENALES}>
  <Interfaz />
</StepFrame>
```

Dos cosas que conviene saber: (1) un texto de la interfaz que se posiciona de forma absoluta dentro de `World` necesita `whiteSpace: "nowrap"` (el mundo mide 1 x 1 px y el texto se parte en cada palabra); (2) el texto de las capas fijas no escala con la cámara, así que se lee igual en el plano general y en el acercado.

## Referencia de firmas

Props exactas de las piezas que más se usan (todas aceptan `frame?` para fijar el cuadro; sin él leen el del motor). Los `?` son opcionales y `=` marca el valor por defecto.

| Pieza | Props | Notas |
|---|---|---|
| `DockedHeadline` | `index: number`, `title: string`, `subtitle?: string`, `start = 0`, `hide = 0`, `layout = "stacked"`, `size = "md"`, `gradientLoop?` | Píldora fija en pantalla (fuera de `World`), en `left = theme.safe.x / 2`, `top = theme.safe.y / 2`. `index` es el número que se muestra (`01`, `02`...; empieza en 1 porque se muestra tal cual). Entra en `start..start + 18`; `hide` (0 a 1) la aparta: pasale `hideFromScale(cam.scale)`. `layout="inline"` pone título y subtítulo en una línea ("04 Nombre · línea"); `"stacked"` (por defecto) apila el subtítulo. `size="sm"` achica letra, huecos y relleno al 85 %. `gradientLoop` (cuadros) hace vaivén el degradado del número. |
| `hideFromScale` | `(scale, threshold = 1, range = 0.08)` | 0 con escala 1, 1 desde `1,08`. |
| `FlyingCard` | `range: [ini, fin]`, `from: {x, y}`, `to: {x, y}`, `arc = 0`, `width`, `height`, `toWidth?`, `toHeight?`, `rotate?` (grados: número o `[desde, hasta]`), `trail = 5`, `trailLag = 1.5`, `hideBefore = true`, `hideAfter = false`, `children` | `from`/`to` son el **centro** de la tarjeta; los hijos se dibujan en `width x height` centrados ahí. Antes de `range[0]` no se dibuja (`hideBefore`; con `hideBefore={false}` espera en `from`), y después de `range[1]` queda en `to` (`hideAfter` la oculta): la tarjeta "real" del origen sigue ahí hasta que arranca el vuelo, y mientras vuela dejá un hueco punteado. `arc` en px, el signo elige el lado. `toWidth`/`toHeight` hacen que cambie de tamaño durante el vuelo (con la curva del vuelo; sin ellos, no cambia) y `rotate` que gire (sin ellos, el marcado de siempre; un texto bajo `rotate()` es el riesgo conocido de `docs/reglas.md`: si `--check` falla, girá una tarjeta sin texto). |
| `Cursor` | `keys: [cuadro, x, y][]`, `clicks?: number[]`, `show: [ini, fin]` | Coordenadas del mundo (va dentro de `World`). La última parada antes de cada clic, 2 cuadros antes. `show` más largo que 20 cuadros hace fundido de 10 al entrar y al salir. |
| `DoodleCircle` | `id`, `start`, `end = 99999`, `cx`, `cy`, `rx`, `ry`, `boil = 3`, `width = 5` | Elipse centrada en `(cx, cy)`. `end` es el cuadro donde empieza a desvanecerse (dura 10). |
| `DoodleArrow` | `id`, `start`, `end`, `x1`, `y1`, `x2`, `y2`, `bend = 0.25`, `boil = 3`, `width = 6` | De `(x1, y1)` a `(x2, y2)` con la punta en el segundo; `bend` curva el trazo (el signo elige el lado). |
| `DoodleUnderline` | `id`, `start`, `end`, `x`, `y`, `length`, `boil = 3`, `width = 5` | Raya horizontal desde `(x, y)` hacia la derecha. |
| `Wash` | `range: [ini, fin]`, `color?` | Velo de cuadro completo (color del fondo del tema por defecto). Va fuera de `World`, al final del contenido. Lleva `data-qa-veil` para que `qa` lo trate como transición. |
| `Subtitles` | `cues: Subtitulo[]` (segundos), `estilo = "bloque"` (o `"karaoke"`), `offsetSec = 0`, `size?`, `bottom?` | Subtítulo activo de hasta dos renglones, abajo y al centro; en vertical por encima de la zona de las redes. Sale todo del tema (`surfaceStyle`, `entrance`, `cornerRadius`); no corta con "…": si no entra en dos renglones, pagina. Va en la escena raíz, sobre los velos. `subtitleBand(theme, { width, height })` da la franja (`Rect`) para dejarla libre. |
| `ThemeScope` | `theme: Theme`, `paint = false`, `font = false`, `style?`, `children` | Cambia el tema de un subárbol. Con `paint`, pinta una superficie (el `style` le da posición, tamaño, radio y sombra). Con `font` y sin `paint`, aplica la tipografía del tema del ámbito (`font.family`, un contenedor `display: contents`: no cambia la maquetación); sirve para una interfaz recreada con otra letra que el video. Ver `docs/guia-escenas.md`, sección 10. |
| `World` | `camera`, `width`, `height`, `perspective = 2400`, `settled?`, `children` | `width`/`height` del formato (`useFormat()`), no 1920x1080 escritos a mano. |
| `Stage` | `clouds = true`, `cloudOpacity?`, `cloud?: CloudOptions`, `children` | Fondo, tipografía y nubes del tema. `cloud` (`colors`, `count`, `seed`, `blobs`, `opacity`, `blur`) pisa lo que declara `theme.cloud` solo en esa escena. |
| `CloudBackground` | `colors?`, `count?`, `seed?`, `blobs?`, `opacity?`, `blur?` (por defecto `theme.cloud.blur`, y si no, 110), `width?`, `height?` | Cada propiedad pisa a `theme.cloud`. `colors` y `blobs[].color` aceptan roles (`"accent2"`, `"data.estado"`, `"chart[2]"`) o colores del tema. `blobs: { x, y, size? }[]` (x, y en fracciones del cuadro) reemplaza el reparto sembrado. |
| `Vignette` | `amount: number` (0 a 1), `color?` (por defecto `decor.vignetteColor`: el acento), `strength = 1` | Oscurece los bordes; usala con el zoom. Es un degradado de cuadro completo: cae sobre el texto cercano a un borde (no es transparente a `qa`: lo que hay debajo se sigue juzgando) y `editorial` no la dibuja. `color`: rol del tema (`"bg"`, `"text"`, `"data.x"`) o color sacado del tema; en una interfaz oscura, `color="bg"` y un `strength` bajo evitan teñirla. Opacidad del borde: `0,22 * strength * amount`. |
| `flyInZ` | `(progress, { from = 900, perspective = 1400, x, y, rotateX, rotateY, fade = true })` | Devuelve un `style` (no un componente). Ver "Entrada en profundidad". |
| `CountUp` | `from = 0`, `to`, `start`, `duration`, `format?`, `style?` | Número que cuenta. |
| `GradientText` | `children`, `pan = 0`, `loop?` (por defecto `decor.gradientLoop`), `style?` | Texto con el degradado del tema. `loop` = cuadros de un vaivén completo (vuelve exacto al terminar el ciclo); `pan` = velocidad sin ciclo exacto. Ambos salen del cuadro. |

## Piezas de interfaz

Las piezas que toda interfaz recreada necesita y que antes cada video escribía por su cuenta. Todo sale del tema (colores por rol, esquinas por `cornerRadius`, borde y sombra por `surfaceStyle`/`borderWidth`, letra por `textStyle`, trazos por `style.line`): con otro design system cambian de forma sin tocar la escena. Son puras: el estado que cambia con el cuadro (apretado, tildado, dibujado) se pasa como un número de 0 a 1 que calcula la escena (`kf`). No llevan posición: se ubican con el contenedor. (`Chip` y `Pill` de `stories/` son las piezas propias de la historia —muro, píldora del titular—; no son estas.)

| Pieza | Props | Qué hace |
|---|---|---|
| `Chip` | `children`, `tone = "neutral"` (`neutral`, `accent`, `success`, `warning`, `danger`), `on?`, `size?`, `style?` | Píldora o etiqueta. `neutral` es la superficie `chip` del design system (`on` la enciende con borde de acento); `accent` va rellena; los estados llevan un punto del color antes del texto, así el contraste del texto no depende del color del estado. `size` = letra en px (por defecto `type.caption`); los espacios son proporcionales. |
| `Button` | `children`, `variant = "primary"` (o `secondary`), `pressed = 0`, `size?`, `icon?`, `style?` | Botón de acción con las esquinas del rol `control`. `pressed` (0 a 1) mezcla el relleno hacia `accent2` (o `surfaceAlt`): el apretado cambia el color, no el tamaño. |
| `Avatar` | `name`, `index = 0`, `size = 56`, `ring?`, `style?` | Círculo con la inicial; color de `color.chart[index]` y letra del color más legible sobre él. `ring` agrega un anillo del color de la superficie para apilar avatares. |
| `Check` | `progress = 1`, `size = 48`, `tone = "accent"` (o `success`), `filled = true`, `style?` | Tilde dentro de un círculo que se dibuja con `progress`; grosor y puntas del trazo siguen `style.line` (`weight`, `cap`). Con `progress = 1` no emite propiedades de dibujo. |
| `ListRow` | `title`, `detail?`, `leading?`, `trailing?`, `on?`, `divider?`, `size?`, `style?` | Fila de lista: pieza a la izquierda (`Avatar`, `Icon`), texto en el medio (`minWidth: 0`: un nombre largo no empuja lo de la derecha), pieza a la derecha (`Chip`, `Check`, una hora). `on` la resalta con `surfaceAlt`; `divider` agrega la raya fina del tema. |
| `Icon` | `name`, `size = 40`, `color = "text"`, `progress = 1`, `style?` | Ícono de trazo propio, dibujado para este repo en una caja de 24 x 24: `calendar`, `bell`, `clock`, `user`, `check`, `home`, `search`, `heart`, `document`, `message` (`ICON_NAMES`). `color` es un rol del tema (`accent`, `onAccent`...) o `data.<nombre>`; el grosor y las puntas salen de `style.line`; `progress` dibuja el trazo con el cuadro. Es un conjunto chico para recrear interfaces, no una fuente de íconos: si falta uno, se pide. |

La letra de los títulos (`font.display`, `themes/README.md`) no se aplica a estas piezas: son interfaz y siguen con `font.family`.

## Disposición y medidas

Lo que hace que una escena aguante otro design system (otra tipografía, otro fondo, otro tamaño de letra) es no escribir posiciones que suponen las medidas de una fuente. Estas ayudas son funciones puras y salen de `kit/index.ts`; el motivo y los malos patrones están en `docs/guia-escenas.md`, sección 15.

| Ayuda | Qué hace |
|---|---|
| `textWidth(theme, texto, { size?, weight?, role? })` | Ancho en px de una línea con la tipografía del tema; `role` (`title`, `label`, `eyebrow`, `caption`) suma el peso, el interletrado y las mayúsculas del design system. Envuelve el medidor de `fx/text` (`measureWidth`: canvas en el navegador, estimación por glifo en jsdom); no lo duplica. Mide la fuente del tema: con otra fuente, dejá `minWidth` y un margen. |
| `placeBeside(target, { w, h }, { avoid?, within?, prefer?, gap? })` | Dónde poner una pieza al lado de un rectángulo: prueba los lados en orden (`right`, `below`, `left`, `above`), la mete en `within` y devuelve el primer lugar que no pisa ningún `avoid` ni el objetivo (`{ x, y, side, overlap, covers }`, enteros). Si no hay lugar libre, el que menos pisa, y `covers` dice qué índices de `avoid`. |
| `calloutState(frame, [ini, fin], { ramp = 10 })` y `coveredOpacity(progress, floor = 0)` | El progreso (0 a 1) de una pieza que está entre dos cuadros, y la opacidad que tiene que tener lo que ella tapa (1 con progreso 0, `floor` con 1). Una sola cuenta para las dos mitades. |
| `<Callout target text? range avoid? within? prefer? gap? size? variant? id?>` | Señal anclada a un objetivo **con la forma del design system** (`style.annotation.mark`: `hand`, `arrow`, `elbow`, `bracket`, `tag`, `ring`, `focus`, `underline`, `none`; `variant` fuerza otra como excepción; sin `text` es solo la marca; con `focus`, lo demás se atenúa con `FocusGroup`). Con rótulo: pastilla con `placeBeside` y la caja medida; superficie `chip` encendida de `surfaceStyle`, rótulo `textStyle("label")`, entrada `entrance`, `lineHeight` explícito y `minWidth` (con otra fuente crece, no se corta). `calloutPlacement(theme, opts)` da la misma ubicación y `covers` para apagar lo tapado. |
| `<FocusGroup range variant? ramp? frame? style?>` | Atenúa lo que envuelve con `focusOpacity(theme, calloutState(frame, range), variant)` mientras una señal `focus` está puesta; con cualquier otra señal no emite nada (se puede dejar siempre). El objetivo y el `Callout` van fuera del grupo. Opacidad en el contenedor, sin `isolation`, `will-change` ni `filter` (con `isolation` `--check` falla). Lleva `data-qa-focus` para que `qa` trate el contraste bajo como atenuación a propósito. |
| `<NestedScene scene sceneProps? start? frame? format? size? scale? width? height? qa? style?>` | Una escena completa dibujada a su tamaño natural y achicada con una `scale()`: `text-rendering: geometricPrecision`, `config` y cuadro local de la escena de adentro, posiciones enteras, `data-qa-decor` y `data-qa-fixed-scale` (con `qa={false}`, sin marcas). Ver `docs/guia-escenas.md`, sección 17. |
| `headlineStrip(theme, { width, height? }, { layout?, size?, subtitle?, gap? })` | La franja `{ x: 0, y: 0, w, h }` que el titular fijo ocupa en la parte de arriba (de borde a borde, hasta el pie de la píldora más `gap`). El contenido de la vista general empieza en `y + h`. |
| `cameraView(cam, { width, height })` | Qué parte del mundo ve la cámara (un rectángulo en coordenadas del mundo): sirve de `within` de un `Callout` que está bajo zoom. |
| `cameraKeepClear(clave, sujeto, { strip, format, margin?, visibleBelow? })` | Receta para elegir una clave de cámara: corre el foco lo mínimo para que `sujeto` (en coordenadas del mundo) quede entero en el cuadro y, si el titular se ve a esa escala (hasta 1,08), debajo de la franja. Devuelve `{ x, y, scale, fits }`; `fits: false` = no cabe a esa escala. |

```tsx
// Una pastilla que señala una tarjeta sin pisar las etiquetas de al lado; si no puede evitarlas, las apaga mientras está.
const theme = useTheme();
const RANGE: [number, number] = [60, 110];
const place = calloutPlacement(theme, { target: card, text: "Acá", avoid: labels, within: view });
const p = calloutState(frame, RANGE);
{labels.map((r, i) => <Etiqueta key={i} rect={r} style={{ opacity: place.covers.includes(i) ? coveredOpacity(p) : 1 }} />)}
<Callout target={card} text="Acá" range={RANGE} avoid={labels} within={view} />

// La cámara de la vista general: el panel entero y debajo del titular.
const strip = headlineStrip(theme, { width, height });
const k = cameraKeepClear({ x: width / 2, y: height / 2, scale: 1 }, panelRect, { strip, format: { width, height } });
const KEYS = [{ f: 0, x: k.x, y: k.y, scale: 1 }, ...];
```

`dimOpacity(fg, bg, { min, floor })` y `dimmedColor(theme, rol, bg, { min })` (en `themes/`, ver `themes/README.md`) calculan la atenuación más débil que conserva el contraste: no pongas una `opacity` fija menor que 0,5 sobre texto.

## Entrada en profundidad: `flyInZ`

La profundidad real (`preserve-3d`, `perspective` en un ancestro) está prohibida por determinismo, así que un panel que "llega volando" se hace con la perspectiva propia de cada elemento:

```tsx
const p = kf(frame, [10, 40], [0, 1]);
<div style={{ position: "absolute", left: 120, top: 190, ...flyInZ(p, { from: 800, x: 140, y: 60 }) }}>{/* panel */}</div>
```

- `progress` va de 0 (lejos, invisible con `fade`) a 1 (en su lugar); curvá el progreso con el easing del tema en `kf`.
- Devuelve `transform: perspective(P) translate3d(x, y, -from) ...` para ese elemento, sin `preserve-3d` ni perspectiva en el ancestro; el layout (`left`/`top`) lo ponés vos en enteros y todo el movimiento va en el `transform`.
- Al llegar (`progress >= 1`) devuelve `{}`: sin `transform` ni `opacity` residuales (la causa más frecuente de que falle `--check`).
- `|from|` tiene que ser menor que `perspective` (si no, el elemento quedaría detrás de la cámara y lanza un error). `from` negativo hace que llegue desde adelante.
- No lo uses en piezas que se cruzan en profundidad: ordená con `zIndex`. Cubierto por `--check` en `examples/kit-demo` (las tarjetas de estadística).

## Precondiciones

- `kf`: `keys` estrictamente creciente (2 o más claves, o una sola = valor fijo); si no, lanza el error del motor.
- `cameraAt`: al menos una clave; `f` estrictamente creciente (si no, lanza un error que nombra los cuadros). Una clave = cámara fija.
- Casos degenerados que NO fallan: `Cursor` con una sola clave (fijo) o `show` corto (el fundido se acorta); `CountUp` con `duration` 0 (salta a `to`); `Wash`, `flight` y `zoomThrough` con inicio = fin (escalón).
- `Doodle*`: `id` único por garabato (se sanea para el degradado: solo letras, números, `_` y `-`).
- `Stage` declara `@font-face` con el primer nombre de `theme.font.family` (sin comillas) para los archivos de `theme.font.files`.
- `World` usa transformación 2D cuando no hay inclinación (`rx = ry = 0`) y emite `scale(...)` solo mientras la escala no es 1 (con la cámara quieta en escala 1 y sin inclinación no queda `scale(1)` ni `perspective`; lo prueba `kit/rest.test.tsx`); con inclinación, agrega `perspective(P) rotateX() rotateY()` dentro del `transform` del propio elemento (sin `perspective` ni `preserve-3d` en un ancestro, con `left`/`top` enteros y todo el movimiento en el `transform`; el mismo patrón que `rigTransform` de `stories/`). El mundo se inclina como un plano, así que los hijos no se cruzan en profundidad. Esto evita capturas no idénticas según el historial de cuadros (ver `docs/reglas.md`).

## Uso mínimo

```tsx
import { Stage, World, cameraAt, DockedHeadline, hideFromScale, Wash } from "../../kit";
import { ThemeProvider, neutral } from "../../themes";
import { useFrame } from "../../engine";

const KEYS = [{ f: 0, x: 960, y: 540, scale: 1 }, { f: 60, x: 400, y: 300, scale: 1.8 }];

function Scene() {
  const frame = useFrame();
  const cam = cameraAt(frame, KEYS);
  return (
    <Stage>
      <World camera={cam} width={1920} height={1080}>{/* contenido en coordenadas del mundo */}</World>
      <DockedHeadline index={1} title="Título" hide={hideFromScale(cam.scale)} />
      <Wash range={[80, 90]} />
    </Stage>
  );
}

export const Video = () => <ThemeProvider theme={neutral}><Scene /></ThemeProvider>;
```

`Cursor` ubica la flecha en píxeles enteros (`left`/`top` redondeados): con un `scale()` en un ancestro, una posición fraccionaria hacía fallar `--check`.

Ejemplos: `examples/theme-scope` (cambio de tema por ámbito). Ejemplo completo: `examples/kit-demo` (`/?video=kit-demo&props={"theme":"dark"}`; también `editorial`, `neon`, `papel`).
