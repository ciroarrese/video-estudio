# stories

Estructuras narrativas listas, generadas desde UN objeto de configuración: un video con varios temas recibe la apertura, las vueltas al listado ("volver a la lista") y el cierre sin escribirlos. Todo es función pura del cuadro y sale del tema (`useTheme()`); se apoya en `kit/` (Stage, GradientText, World/cameraAt/zoomThrough, Wash, DockedHeadline, kf).

## Configuración (`StorySpec`)

```ts
const spec: StorySpec = {
  title: { text: "Un día en la oficina", highlight: "la oficina" }, // highlight va con el degradado
  topics: [{ id: "ventas", name: "Panel de ventas", line: "los números del día" }, /* 2 a 6 */],
  labels: ["Resumen diario", "Stock mínimo" /* ... */],           // palabras del muro; si faltan se repiten
  signoff: { logo: "brand/logo.png", tagline: "Hecho con ...", text: "Gracias por mirar" },
  timing: { opening: 300, interlude: 120, closing: 480 },          // opcional (cuadros enteros, mínimo 60; otras claves se rechazan)
};
```

- `labels` vacío usa los nombres de los temas. Los textos largos se ajustan con `fitText` (caracteres × ancho medio del glifo, sin medir): primero se achica la letra, después se corta con "…".
- `signoff.logo` es una ruta de `/public` (se resuelve con `asset()` y bloquea el cuadro hasta cargar). Sin logo, `text` se muestra con el degradado.
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

### Escena renderizada sola (fuera de la historia)

Fuera de `composeStory` no hay tema. Para poder renderizarla, verla en la hoja y pasarle `qa` sin armar toda la historia:

- `<TopicHeadline title="Panel de ventas" number={1} />`: con `title` (y `number`, 1 por defecto) dibuja el titular sin historia; dentro de la historia, `title`/`number` pisan al tema. Sin `title` y sin historia no dibuja nada y avisa una vez en la consola (no lanza).
- `useTopic({ name: "Panel de ventas" })`: con `fallback` devuelve ese tema (`index` 0, `line` vacía) fuera de la historia; sin `fallback` y sin historia lanza un error que dice cómo resolverlo. `useTopicOrNull()` devuelve `null`.
- Dentro de la historia nada cambia: `useTopic()` y `<TopicHeadline />` salen del tema de `spec.topics`.
- El contenido de la escena no debe depender de `StoryStage` ni de `composeStory`: la escena se registra sola con `defineVideo` y su propio `Stage`.

Convención: la escena termina con un `Wash` (o atravesando algo); la vuelta al listado empieza sobre el fondo del tema.

## Línea de tiempo

`composeStory(spec, scenes, { interludes = true, audio })` devuelve `{ component, durationInFrames, timeline }`:

```
Opening (300) → [escena i → Interlude(done = i+1) (120)] × n → Closing (480)
```

`timeline` = `[{ id, kind: "opening"|"topic"|"interlude"|"closing", from, durationInFrames }]`, contiguo y sin huecos. Con `interludes: false` los temas van uno tras otro. `defineStory` registra el video con `engine.defineVideo` (con `formats` y `scenes`) y acepta `theme` ("neutral", "dark" o un objeto `Theme`), también por `&props={"theme":"dark"}`.

Piezas sueltas: `<Opening spec />`, `<Interlude spec done />`, `<Closing spec scenes />` y sus duraciones `OPENING_FRAMES`, `INTERLUDE_FRAMES`, `CLOSING_FRAMES`.

## Presupuesto de cuadros

Los bloques generados tienen duración propia (apertura 300, cada vuelta al listado 120, cierre 480 por defecto; mínimo 60 cada uno, se cambian con `timing`). Con 3 temas y vueltas son **1140 cuadros (38 s) antes de sumar una sola escena**: un video de 25 s es imposible sin `timing` (o sin `interludes: false`).

```ts
import { storyBudget, formatStoryBudget } from "../../stories";
console.log(formatStoryBudget(storyBudget(spec, scenes)));      // una línea por bloque, con el mínimo de cada uno
storyBudget(spec, scenes, { interludes: false }).total;          // apertura, vueltas, cierre, escenas, total y minTotal
```

`ve-qa <id> --list-scenes` (y `ve-sheet`) imprime ese presupuesto debajo de la lista de escenas de cualquier historia. `composeStory` y `defineStory` no lanzan por una duración larga: el total es la suma de los bloques.

## Cierre: píldoras y paneles

Cada píldora va sobre el borde superior de su panel. El diseño (`panelLayout`) garantiza, para 2 a 6 temas en los tres formatos, que ninguna píldora toque el panel de otro tema ni salga del cuadro, con un hueco de 140 px entre filas y `PILL_BAND` arriba de la primera; si hace falta, baja la escala de los paneles. Las píldoras se achican (hasta 0,68 × `type.caption`) y cortan con "…" para no pisarse con la vecina de su fila (`pillFit`, `pillBudget`). Los paneles entran con una profundidad extra que se acota en los formatos que llenan el cuadro (`panelEntryLift`). La miniatura de cada panel lleva `data-qa-ignore="min-size"`: es una vista reducida y su letra es chica a propósito.

## Límites

- Validaciones (errores en español): ids de escena únicos y distintos de `opening`, `closing` e `interlude-N`; `durationInFrames` entero > 0; `labels`, si viene, es una lista de textos no vacíos (ausente o vacío usa los nombres de los temas).

- De 2 a 6 temas (otro número lanza un error claro). La lista, el tamaño de letra, los paneles del cierre y los lugares reservados del muro se calculan según `n`.
- Escala (1920×1080, sale de `theme.type`): la lista es lo más grande de la pantalla (nombre ~0.8 × h1, línea ~0.9 × body, filas de ~170 px hasta 4 temas; con 5 o 6 se achica parejo y el nombre no baja de ~44 px). Título de apertura a `type.hero`, etiquetas del muro ~30 px (marcadas con `data-qa-ignore`), píldoras del cierre ~34 px, firma a `type.h2`.
- Con nombres muy largos la lista usa un solo tamaño (el del nombre más largo, con piso al 60 %) y corta con "…".
- Profundidad real: cada pieza del muro y cada panel lleva su propia `perspective()` en su `transform` (`rigTransform`), sin `preserve-3d` ni `perspective` en un ancestro; el orden se resuelve con `zIndex`. Hay inclinación, travelling lento, desenfoque por distancia, sombras y el muro desenfocado que entra en foco en el cierre.
- Regla para no romper el determinismo: en una capa 3D todo el movimiento va dentro del `transform`; un `left`/`top` fraccionario (p. ej. un vaivén con `Math.sin` sumado a `top`) se rasteriza distinto según el historial de cuadros y `render --check` lo detecta. Las posiciones de layout van en enteros.
- Si `timing` cambia una duración, los tiempos internos del bloque se escalan en proporción.

Ejemplo: `examples/story-demo` (`/?video=story-demo&props={"theme":"dark"}`). Pruebas: `stories/stories.test.tsx`.
