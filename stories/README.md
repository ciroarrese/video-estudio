# stories

Estructuras narrativas listas, generadas desde UN objeto de configuración: un video con varios temas recibe la apertura, las vueltas al listado ("volver a la lista") y el cierre sin escribirlos. Todo es función pura del cuadro y sale del tema (`useTheme()`); se apoya en `kit/` (Stage, GradientText, World/cameraAt/zoomThrough, Wash, DockedHeadline, kf).

## El design system manda (`theme.style`)

La estética de la historia (esquinas, superficies, tratamiento del texto, fondo, movimiento, decoración y cómo se arman la apertura, la lista y el cierre) sale del design system activo: `theme.style` (ver `docs/estilo.md` y `themes/README.md`). Un video que no indica nada recibe el estilo de historias del design system; con los temas `neutral` y `dark` es exactamente el aspecto de siempre. Con `editorial`, `neon` y `papel` (ejemplos inventados en `themes/`) la misma historia cambia de forma, no solo de colores: se ve con `npm run -s render -- story-demo --props '{"theme":"editorial"}'` (o `neon`, `papel`; también `--format vertical`).

`spec.design` pasa a ser un **ajuste por video sobre el design system**: cada opción que el video indica gana, el resto sale del tema (`withStoryDefaults(theme, spec.design)`; lo hacen todos los bloques con `useStorySpec` / `useStoryDesign`).

| Campo de `theme.style` | Qué cambia en las historias |
| --- | --- |
| `shape.corners`, `shape.border`, `shape.outlined` | Radio y borde de las piezas del muro (`Chip`), de la píldora del cierre (`Pill`), del cartel del título, de los paneles y de la miniatura por defecto, del punto y el anillo de la tilde y de las marcas de acento. La medida de cada pieza no cambia (el relleno compensa el borde). |
| `surface.kind`, `surface.elevation`, `surface.opacity` | Relleno, borde y sombra de esas superficies (`surfaceStyle`): sólida, vidrio emulado, contorno, teñida; con sombra, plana, filo duro o halo. El panel flotante del cierre usa la sombra larga solo con elevación `shadow`. |
| `type.titleWeight`, `titleTracking` | Peso y interletrado de los nombres de la lista, del cartel, de la píldora y de la firma (`textStyle`). |
| `type.labelWeight`, `eyebrowTracking` | Letra de las piezas del muro; el "Sigue ·" de la vuelta compacta (que siempre va en mayúsculas). |
| `type.numerals` | Números de la lista y de la píldora, tilde (degradado de marca o sólido) y tira de la vuelta compacta (`numeralStyle`). |
| `type.highlight` | Palabra resaltada del título de la apertura y firma sin marca: degradado, acento, filete o marcador (se va dibujando de izquierda a derecha). |
| `background.kind`, `background.intensity` | Fondo de todos los bloques y de las escenas (`StoryStage` sobre `Stage`): nubes, liso, grilla, puntos, degradado o grano. Las filas atenuadas de la vuelta calculan su opacidad contra el peor fondo del patrón. |
| `motion.entrance`, `overshoot`, `stagger` | Entrada de las filas de la lista (de la derecha por defecto), del cartel del título (asentado de escala, sin fundido: se lee desde el primer cuadro) y de la vuelta compacta; paso entre filas y entre paneles. |
| `motion.cameraBlur`, `cameraTilt` | Cámara de la apertura y de las vueltas (`useCameraAt`). |
| `motion.transition` | Velo del final de las vueltas y telón de la firma (fundido, cortina, corte; con `through` no hay velo, salvo el telón de la firma, que siempre hace falta para que se lea). El final de la **apertura** lo decide `story.handoff`, no la transición. |
| `decor.accent` | Marca bajo la fila que sigue y bajo la firma: barra de degradado, filete, punto o nada. |
| `decor.gradientLoop` | `design.gradient.loop` (vaivén del degradado de los textos). |
| `chart.barRadius`, `lineWidth`, `grid`, `fill` | Miniatura por defecto del cierre: esquinas de las barras (un escalón menos que el gráfico grande), línea (1 px más), guías y relleno (liso, degradado o rayado). |
| `story.titleCard`, `listLayout`, `listUnderline`, `handoff`, `headlineSize`, `closingBg`, `signoffBar`, `wall*` | Los valores por defecto de `spec.design` (tabla de abajo). En formato vertical las columnas y filas del muro del tema no rigen (el muro alto lo decide el formato); las que el video pide en `spec.design.wall` sí. |

Lo que NO depende del estilo: los tamaños de letra, el área segura, la medida de la lista, del muro y de las miniaturas, y el contenido (con `doodles: false` o `transition: "cut"` no se quita información). Un tema con `surface.kind: "outline"` pide al cartel de la apertura un borde de tinta que `borderWidth(theme, "title")` no da (la historia lo dibuja ella).

## Configuración (`StorySpec`)

```ts
const spec: StorySpec = {
  title: { text: "Un día en la oficina", highlight: "la oficina" }, // highlight va con el degradado
  topics: [{ id: "ventas", name: "Panel de ventas", line: "los números del día" }, /* 2 a 6 */],
  labels: ["Resumen diario", "Stock mínimo" /* ... */],           // palabras del muro; si faltan se repiten
  signoff: { logo: "brand/logo.png", tagline: "Hecho con ...", text: "Gracias por **mirar**" }, // o `slot: <MiSello />` en vez de `logo`; `text` es opcional si hay logo o slot
  timing: { opening: 300, interlude: 120, interludeCompact: 40, closing: 480 },  // opcional (cuadros enteros, mínimo 60; interludeCompact mínimo 24; otras claves se rechazan)
  design: { titleCard: "glass", list: "inline", handoff: "dock", wall: { columns: 8, rows: 4, blur: false }, clouds: { opacity: 0.25 } }, // opcional: ver "Opciones de diseño"
};
```

- `labels` vacío usa los nombres de los temas. Los textos largos se ajustan con `fitText` (caracteres × ancho medio del glifo, sin medir): primero se achica la letra, después se corta con "…".
- `signoff.logo` es una ruta de `/public` (se resuelve con `asset()` y bloquea el cuadro hasta cargar). `signoff.slot` es un nodo propio (marca, sello, ícono; reemplaza al logo). Sin logo ni `slot`, `text` se muestra con el degradado a tamaño `type.h1` y una barra de degradado debajo; con marca baja a `type.h2` para que mande la marca. La nota (`tagline`) va en `type.body`. `text` es opcional cuando hay `logo` o `slot` (entra la marca, la barra y la nota); sin ninguno de los tres es un error. `text` y `tagline` admiten un fragmento en negrita entre dobles asteriscos (`"Gracias por **mirar**"`; ver `parseRich`); si el texto no entra y se corta con "…", se muestra sin negrita. Cada pieza de la firma queda con `visibility: hidden` mientras su opacidad vale 0 (ocupa su lugar pero no se pinta ni la ve `qa`) y en reposo no lleva `opacity` ni `transform`.
- Se asume 30 fps. El tamaño sale de `useVideoConfig()` y del tema. `defineStory` publica por defecto solo el formato base; cada formato extra se pide a propósito con `formats: ["vertical", "cuadrado"]` (1080×1920 y 1080×1080 con el base 1920×1080), porque obliga a que cada escena de tema tenga su disposición. Declara su línea de tiempo como escenas (`--list-scenes`, `--scene opening|<id de tema>|interlude-N|closing`).
- Vertical y cuadrado: la apertura baja el título a hasta 3 renglones y separa las filas del muro; la lista usa el ancho seguro; el cierre acomoda los paneles en una o dos columnas con la escala que entra en el cuadro (`panelLayout(n, width, height)`), los lugares reservados van en una columna (`reservedSlots`) y el muro de etiquetas cubre el alto. Las escenas de tema tienen que adaptarse ellas mismas con `useFormat()` (ver `examples/story-demo`).

## Conectar las escenas

```tsx
const scenes: TopicScene[] = [
  { id: "ventas", component: Ventas, durationInFrames: 600, thumbnail: MiniVentas }, // thumbnail opcional (lienzo 560x340)
  /* una por tema, en el mismo orden que spec.topics */
];
export default defineStory({ id: "mi-video", spec, scenes, formats: ["vertical"], audio: { src: "music/pista.m4a" } }); // sin `formats`: solo el base
```

Cada escena se dibuja dentro de un `Stage` y puede usar `useTopic()` (`{ index, name, line }`, `index` desde 0) o mostrar el titular ya armado:

```tsx
<TopicHeadline start={4} hide={hideFromScale(cam.scale)} />
```

`TopicHeadline` toma de la historia el diseño (`design.list: "inline"` → una sola píldora con la línea del tema; `design.headline.size`; `design.gradient.loop`) y se puede pisar por prop: `layout="stacked" | "inline"`, `subtitle="..."`, `size="md" | "sm"`. Una escena que quiere el renglón con la línea no necesita armar `DockedHeadline` a mano: la apertura con `handoff: "dock"` usa exactamente este componente.

### Escena renderizada sola (fuera de la historia)

Fuera de `composeStory` no hay tema. Para poder renderizarla, verla en la hoja y pasarle `qa` sin armar toda la historia:

- `<TopicHeadline title="Panel de ventas" number={1} />`: con `title` (y `number`, 1 por defecto) dibuja el titular sin historia; dentro de la historia, `title`/`number` pisan al tema. Sin `title` y sin historia no dibuja nada y avisa una vez en la consola (no lanza).
- `useTopic({ name: "Panel de ventas" })`: con `fallback` devuelve ese tema (`index` 0, `line` vacía) fuera de la historia; sin `fallback` y sin historia lanza un error que dice cómo resolverlo. `useTopicOrNull()` devuelve `null`.
- Dentro de la historia nada cambia: `useTopic()` y `<TopicHeadline />` salen del tema de `spec.topics`.
- El contenido de la escena no debe depender de `StoryStage` ni de `composeStory`: la escena se registra sola con `defineVideo` y su propio `Stage`.

Convención: la escena termina con un `Wash` (o atravesando algo); la vuelta al listado empieza sobre el fondo del tema. Con `design.handoff: "dock"` la apertura entrega la píldora del titular ya puesta: la escena del primer tema no necesita nada especial (`<TopicHeadline />` arranca completo; su `start` se ignora).

## Temas sin escena (historias parciales)

`scenes` va parejo a `spec.topics`; un tema sin escena se indica con `null`: sale en la lista de la apertura y en el cierre (con `topic.thumbnail` o la tarjeta por defecto), se saltea en el medio y no tiene vuelta al listado. En las vueltas, **regla**: un tema sin escena no es "pendiente" ni "visto": se ve plano (atenuado como los ya vistos, pero sin tilde), nunca es el siguiente ni se lo atraviesa; así "01, 02 (sin escena), 03" no muestra un 02 que parece pendiente junto a un 03 tildado. Si ese tema ya se mostró de otra manera (en un video previo, en otra pieza), `topics[i].seen: true` lo muestra tildado desde el principio de cada vuelta, sin pulso. En la compacta no cuenta en la tira. Una lista vacía (`composeStory(spec, [])`) vale por "ninguno tiene escena": solo apertura y cierre. El presupuesto y `--list-scenes` cuentan una vuelta por escena (`storyBudget(spec, [150, null, 150])`).

```ts
defineStory({ id: "mi-video", spec, scenes: [escenaVentas, null, escenaAtencion, null] }); // 4 temas listados, 2 con escena
```

Las vueltas se numeran entre las escenas que hay (`interlude-1`, `interlude-2`...); cada entrada de `timeline` trae `topic` (índice del tema; en una vuelta, el último visto).

## Armar a mano

`composeStory` es una conveniencia: las piezas se pueden usar sueltas dentro de `Sequence` (con la duración que sale de sus `*Frames(spec)`), cada una con su `spec`:

```tsx
import { Opening, Closing, Interlude, TopicProvider, StoryStage, openingFrames, closingFrames, interludeFrames } from "../../stories";

<Sequence from={0} durationInFrames={openingFrames(spec)}><Opening spec={spec} first={1} /></Sequence>   // `first`: tema que se atraviesa/acopla al final
<Sequence from={300} durationInFrames={600}>
  <TopicProvider spec={spec} index={1} docked>      {/* useTopic() y <TopicHeadline /> salen de spec.topics[1]; docked: la píldora ya está puesta */}
    <StoryStage cloud={spec.design?.clouds}><MiEscena /></StoryStage>
  </TopicProvider>
</Sequence>
<Sequence from={900} durationInFrames={interludeFrames(spec)}><Interlude spec={spec} done={2} skip={[0, 3]} /></Sequence>
<Sequence from={1020} durationInFrames={closingFrames(spec)}><Closing spec={spec} /></Sequence> {/* `scenes` es opcional: miniaturas de `topic.thumbnail` o por defecto */}
```

Piezas exportadas: `Opening`, `Interlude`, `InterludeCompact`, `Closing` (y sus `*Frames`), `TopicProvider`/`TopicContext`, `StoryStage`, `Chip`, `Pill`, `CheckMark`, `HeadlineRow`, `HighlightedTitle`, `RichText`, `listLayout`, `nextTopic`. Cada pieza es una función pura del cuadro local de su `Sequence`. `Opening` dura `openingFrames(spec)` (300 por defecto): con otra duración los tiempos se escalan, pero fuera de esa duración no hay garantía.

## Opciones de diseño (`spec.design`: ajuste por video)

Todas van en `spec.design` y son opcionales: lo que no se indica sale del design system (`theme.style.story`; con `neutral` y `dark`, el aspecto de siempre). Lo que se indica gana sobre el tema. Todo sale del tema.

| Opción | Valores | Qué hace |
| --- | --- | --- |
| `titleCard` | `"solid"` (defecto), `"glass"` | Cartel del título de la apertura: opaco o translúcido con borde fino. El vidrio es una superficie semiopaca (`surface` al 74 %), **no** `backdrop-filter`: el desenfoque del fondo se rasteriza según el historial y no es determinista bajo `--check`. |
| `list` | `"stacked"` (defecto), `"inline"` o `{ layout?, underline? }` | Filas de la lista: número y nombre arriba con la línea debajo, o `01 Nombre · línea` en un solo renglón (el nombre en negrita grande y la línea al 70 %, más tenue). `"inline"` solo rige en formatos anchos; en vertical se usa la apilada. Afecta a la apertura y a las vueltas. Forma larga: `{ layout: "stacked" \| "inline", underline: "row" \| "name" }`; `underline: "name"` acorta el subrayado del tema que sigue a lo que mide el nombre (por defecto `"row"`: hasta el borde derecho de la fila). La forma corta sigue valiendo. |
| `handoff` | `"wash"` (defecto), `"dock"`, `"through"` | Final de la apertura: se atraviesa el primer titular y un velo cubre el cuadro, o el titular del primer tema con escena queda acoplado arriba a la izquierda (la píldora de `TopicHeadline`) y la escena arranca con ella ya puesta. Con acople, las nubes de la apertura llegan al último cuadro en el punto donde arrancan en la escena (sin salto). Sin escenas se ignora. El acople va **siempre al primer tema con escena** (si el primero no tiene, al siguiente). La píldora es la misma pieza (`TopicHeadline`, mismos props: diseño, tamaño y línea de la historia) en el último cuadro de la apertura y en el primero de la escena, así que no hay salto de tamaño; lo comprueba `stories/opciones.test.tsx`. Con `list: "inline"` es la píldora de un renglón con la línea del tema. `"through"`: se atraviesa el titular del primer tema con escena (zoom como `zoomThrough`) pero sin velo: las nubes siguen sin salto hasta el último cuadro, el titular se desvanece y la escena entra sobre el fondo con su titular entrando por su cuenta (`start`). |
| `headline.size` | `"md"` (defecto), `"sm"` | Tamaño de la píldora del titular (`TopicHeadline` y la que acopla la apertura): `"sm"` es el 85 % de letra, huecos y relleno. También por prop: `<TopicHeadline size="sm" />`. |
| `gradient.loop` | entero >= 2 (cuadros) | Los textos con degradado de la historia (resalte del título, números de la lista, número de la píldora y firma sin marca) hacen un vaivén que vuelve exacto cada `loop` cuadros (`GradientText loop`). Sin él quedan quietos. |
| `closing.bg` | rol del tema (`"bg"` defecto, p. ej. `"surface"`) | Fondo que cubre el cierre cuando entra la firma. |
| `closing.bar` | `true` (defecto), `false` | Marca de acento bajo la firma (barra de degradado, filete o punto según `decor.accent`); `false` la quita. |
| `wall.columns`, `wall.rows` | enteros de 2 a 12 | Piezas del muro de la apertura (6 × 6 en horizontal, 3 × 12 en vertical por defecto). |
| `wall.blur` | `true` (defecto), `false` o `{ opening?, closing? }` | `false`: las piezas del muro de la apertura no se desenfocan con la distancia y el muro del cierre no arranca desenfocado. El objeto lo decide por bloque (lo que falte es `true`). |
| `wall.chipScale` | 0,5 a 3 (1) | Tamaño de las piezas del muro de la apertura (la grilla no cambia: con piezas muy grandes se solapan). |
| `wall.dolly` | -240 a 2000 px (0) | Recorrido extra de la cámara hacia el muro durante la apertura; 0 es el de siempre (240 px). |
| `wall.depth` | 0 a 3 (1) | Multiplicador de la dispersión en profundidad de las piezas del muro de la apertura (0: todas en el mismo plano). |
| `clouds` | `CloudOptions` de `kit` | Fondo de nubes de todos los bloques (apertura, vueltas, cierre y las escenas que arma `composeStory`): `colors` (roles del tema), `blobs` (posiciones en fracciones del cuadro y tamaño), `opacity`, `count`, `seed`, `blur`. Lo que falte sale de `theme.cloud` (que ya trae `colors`, `count`, `seed`, `blobs`, `opacity`, también por tokens `--cloud-*`: ver `themes/README.md`; sin `design.clouds` los bloques usan el fondo del tema tal cual). Las filas atenuadas de la vuelta (ya vistas o sin escena) se atenúan menos si las nubes efectivas (las del tema con lo que pise `design.clouds`) son más fuertes, para que el texto grande conserve 3:1 sobre el peor fondo (`quietOpacity`); con nubes comunes no cambia nada. |

## Determinismo: verificar por escena

`ve-render <id> --check` sobre una historia entera toma cuadros repartidos y puede no pasar por el cuadro donde falla un bloque; un fallo del cartel de la apertura se vio con `--scene opening` y no con el muestreo parejo. **Para una historia, correr `--check` por escena**, en cada formato que admita:

```bash
npm run render -- <id> --check --scene opening
npm run render -- <id> --check --scene interlude-1    # (si tiene vueltas)
npm run render -- <id> --check --scene closing
```

Las piezas de `stories/` emiten `transform`, `opacity` y `filter` solo mientras animan (en reposo ninguna lleva `translateY(0px) scale(1)`, `blur(0)` ni opacidad casi 1: un residual compone el elemento en una capa propia que se rasteriza según el historial) y remontan el elemento cuando cambia el conjunto de propiedades (`styleKey`). Lo comprueban `stories/rest.test.tsx` (marcado independiente del historial y sin residuos, para cada pieza y cada opción) y `stories/determinism.e2e.test.ts` (`--check` por escena de varias historias con títulos y opciones distintos; es lenta, ~10 min, y corre aparte con `npm run test:e2e`: `npm test` no la incluye). Si agregás una pieza o una opción, sumala a `PIECES` en `rest.test.tsx` y un caso a `determinism.cases.ts`.

## Línea de tiempo

`composeStory(spec, scenes, { interludes = true, audio })` devuelve `{ component, durationInFrames, timeline }`:

```
Opening (300) → [escena i → Interlude(done = i+1) (120)] × n → Closing (480)
```

`timeline` = `[{ id, kind: "opening"|"topic"|"interlude"|"closing", from, durationInFrames }]`, contiguo y sin huecos. Con `interludes: false` los temas van uno tras otro; con `interludes: "compact"` cada vuelta es una tira corta (ver abajo). `defineStory` registra el video con `engine.defineVideo` (con `formats` y `scenes`) y acepta `theme`: un nombre ("neutral", "dark", "editorial", "neon", "papel") o un objeto `Theme` (se usa tal cual en la apertura, las vueltas, el cierre y dentro de las escenas). Por props (`--props '{"theme":"dark"}'`, `&props=...`) se puede pisar en el render con un nombre; el objeto no se publica como prop (no es serializable) y por eso `defaultProps` queda vacío.

Piezas sueltas: `<Opening spec />`, `<Interlude spec done />`, `<Closing spec scenes />` y sus duraciones `OPENING_FRAMES`, `INTERLUDE_FRAMES`, `CLOSING_FRAMES` (ver "Armar a mano").

## Vuelta compacta

La vuelta completa repite la lista de temas tras cada escena y con 3 temas se come 360 cuadros (12 s): en un video de 30 s es el 20 %. `interludes: "compact"` la reemplaza por una tira de progreso (un segmento por tema), el tema que se acaba de ver con su tilde y, debajo, el que sigue (o "Sigue el resumen" tras el último). **Dura 40 cuadros por defecto (`timing.interludeCompact`), mínimo 24**; los tiempos internos se escalan. `composeStory` y `defineStory` la aceptan igual: `defineStory({ ..., interludes: "compact" })`. Es función pura del cuadro, usa solo valores del tema y se adapta a los tres formatos. `storyBudget(spec, scenes, { interludes: "compact" })` y `--list-scenes` la cuentan (por defecto 3 × 40 en vez de 3 × 120; mínimo 24 por vuelta).

## Presupuesto de cuadros

Los bloques generados tienen duración propia (apertura 300, cada vuelta al listado 120, cierre 480 por defecto; mínimo 60 cada uno, se cambian con `timing`). Con 3 temas y vueltas son **1140 cuadros (38 s) antes de sumar una sola escena**: un video de 25 s es imposible sin `timing` (o sin `interludes: false`).

```ts
import { storyBudget, formatStoryBudget } from "../../stories";
console.log(formatStoryBudget(storyBudget(spec, scenes)));      // una línea por bloque, con el mínimo de cada uno
storyBudget(spec, scenes, { interludes: false }).total;          // apertura, vueltas, cierre, escenas, total y minTotal
storyBudget(spec, scenes, { interludes: "compact" });            // vueltas de 40 cuadros (mínimo 24 cada una)
```

`ve-qa <id> --list-scenes` (y `ve-sheet`) imprime ese presupuesto debajo de la lista de escenas de cualquier historia. `composeStory` y `defineStory` no lanzan por una duración larga: el total es la suma de los bloques.

## Cierre: píldoras y paneles

Cada píldora va sobre el borde superior de su panel. El diseño (`panelLayout`) garantiza, para 2 a 6 temas en los tres formatos, que ninguna píldora toque el panel de otro tema ni salga del cuadro, con un hueco de 140 px entre filas y `PILL_BAND` arriba de la primera; si hace falta, baja la escala de los paneles. Las píldoras se achican (hasta 0,68 × `type.caption`) y cortan con "…" para no pisarse con la vecina de su fila (`pillFit`, `pillBudget`). Con nombres largos (probado con 40 caracteres, de 2 a 6 temas, en los tres formatos) la cámara del cierre arranca con el zoom que deja la píldora y el panel dentro del cuadro (`closingCamStart`, 1,1 como máximo; en vertical baja un poco), y la píldora que viaja al muro se limita al 80 % del ancho ya agrandada.

**Número de la píldora.** Va en un color sólido: el primer acento (`accent`, `accent2`) que llega a 4,5:1 sobre `surface`, o el color de texto si ninguno llega (`pillNumberColor(theme, bg?, prefer?)`). El degradado quedaba a 2,68:1 sobre la píldora en `qa`.

**Miniatura por defecto.** Sin `thumbnail` el panel muestra una tarjeta derivada de lo que hay: el número del tema (en el color del gráfico si llega a 4,5:1 sobre la barra del título; si no, un acento o el texto: `pillNumberColor`), los colores de `theme.color.chart` y una de cuatro composiciones (barras, línea, anillo, filas) elegida por el índice y con datos que salen del nombre, así que dos temas no se ven iguales. Aun así es genérica: **se recomienda mucho pasar un `thumbnail` real** (la escena recreada en 560x340); es lo que más separa un video con plantilla de uno hecho a medida. Los paneles entran con una profundidad extra que se acota en los formatos que llenan el cuadro (`panelEntryLift`). La miniatura de cada panel lleva `data-qa-ignore="min-size"`: es una vista reducida y su letra es chica a propósito.

## Límites

- Validaciones (errores en español): ids de escena únicos y distintos de `opening`, `closing` e `interlude-N`; `durationInFrames` entero > 0; `labels`, si viene, es una lista de textos no vacíos (ausente o vacío usa los nombres de los temas); `signoff.text` obligatorio salvo con `logo` o `slot`; `design` con claves y valores válidos (`closing` acepta `bg` y `bar`).

- De 2 a 6 temas (otro número lanza un error claro). La lista, el tamaño de letra, los paneles del cierre y los lugares reservados del muro se calculan según `n`.
- Escala (1920×1080, sale de `theme.type`): la lista es lo más grande de la pantalla (nombre ~0.8 × h1, línea ~0.9 × body, filas de ~170 px hasta 4 temas; con 5 o 6 se achica parejo y el nombre no baja de ~44 px). Título de apertura a `type.hero`, etiquetas del muro ~30 px (marcadas con `data-qa-ignore`), píldoras del cierre ~34 px, firma a `type.h2`.
- Con nombres muy largos la lista usa un solo tamaño (el del nombre más largo, con piso al 60 %) y corta con "…".
- Profundidad real: cada pieza del muro y cada panel lleva su propia `perspective()` en su `transform` (`rigTransform`), sin `preserve-3d` ni `perspective` en un ancestro; el orden se resuelve con `zIndex`. Hay inclinación, travelling lento, desenfoque por distancia, sombras y el muro desenfocado que entra en foco en el cierre.
- Regla para no romper el determinismo: en una capa 3D todo el movimiento va dentro del `transform`; un `left`/`top` fraccionario (p. ej. un vaivén con `Math.sin` sumado a `top`) se rasteriza distinto según el historial de cuadros y `render --check` lo detecta. Las posiciones de layout van en enteros.
- Si `timing` cambia una duración, los tiempos internos del bloque se escalan en proporción.

Ejemplo: `examples/story-demo` (`/?video=story-demo&props={"theme":"dark"}`). Fondo del cierre: la firma entra sobre `theme.color.bg` (un velo que tapa el muro); `design.closing.bg` elige otro rol. Pruebas: `stories/stories.test.tsx`, `stories/opciones.test.tsx` (temas sin escena y opciones), `stories/rest.test.tsx` (reposo e historial), `stories/determinism.e2e.test.ts` (`--check` por escena; solo con `npm run test:e2e`).
