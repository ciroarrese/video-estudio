# stories

Estructuras narrativas listas, generadas desde UN objeto de configuración: un video con varios temas recibe la apertura, las vueltas al listado ("volver a la lista") y el cierre sin escribirlos. Todo es función pura del cuadro y sale del tema (`useTheme()`); se apoya en `kit/` (Stage, GradientText, World/cameraAt/zoomThrough, Wash, DockedHeadline, kf).

## Configuración (`StorySpec`)

```ts
const spec: StorySpec = {
  title: { text: "Un día en la oficina", highlight: "la oficina" }, // highlight va con el degradado
  topics: [{ id: "ventas", name: "Panel de ventas", line: "los números del día" }, /* 2 a 6 */],
  labels: ["Resumen diario", "Stock mínimo" /* ... */],           // palabras del muro; si faltan se repiten
  signoff: { logo: "brand/logo.png", tagline: "Hecho con ...", text: "Gracias por mirar" },
  timing: { opening: 300, interlude: 120, closing: 480 },          // opcional (cuadros, mínimo 60)
};
```

- `labels` vacío usa los nombres de los temas. Los textos largos se ajustan con `fitText` (caracteres × ancho medio del glifo, sin medir): primero se achica la letra, después se corta con "…".
- `signoff.logo` es una ruta de `/public` (se resuelve con `asset()` y bloquea el cuadro hasta cargar). Sin logo, `text` se muestra con el degradado.
- Se asume 30 fps y 1920×1080 (los tamaños salen de `useVideoConfig()` y del tema).

## Conectar las escenas

```tsx
const scenes: TopicScene[] = [
  { id: "ventas", component: Ventas, durationInFrames: 600, thumbnail: MiniVentas }, // thumbnail opcional (lienzo 560x340)
  /* una por tema, en el mismo orden que spec.topics */
];
export default defineStory({ id: "mi-video", spec, scenes, audio: { src: "music/pista.m4a" } });
```

Cada escena se dibuja dentro de un `Stage` y puede usar `useTopic()` (`{ index, name, line }`, `index` desde 0) o mostrar el titular ya armado:

```tsx
<TopicHeadline start={4} hide={hideFromScale(cam.scale)} />
```

Convención: la escena termina con un `Wash` (o atravesando algo); la vuelta al listado empieza sobre el fondo del tema.

## Línea de tiempo

`composeStory(spec, scenes, { interludes = true, audio })` devuelve `{ component, durationInFrames, timeline }`:

```
Opening (300) → [escena i → Interlude(done = i+1) (120)] × n → Closing (480)
```

`timeline` = `[{ id, kind: "opening"|"topic"|"interlude"|"closing", from, durationInFrames }]`, contiguo y sin huecos. Con `interludes: false` los temas van uno tras otro. `defineStory` registra el video con `engine.defineVideo` y acepta `theme` ("neutral", "dark" o un objeto `Theme`), también por `&props={"theme":"dark"}`.

Piezas sueltas: `<Opening spec />`, `<Interlude spec done />`, `<Closing spec scenes />` y sus duraciones `OPENING_FRAMES`, `INTERLUDE_FRAMES`, `CLOSING_FRAMES`.

## Límites

- De 2 a 6 temas (otro número lanza un error claro). La lista, el tamaño de letra, los paneles del cierre y los lugares reservados del muro se calculan según `n`.
- Escala (1920×1080, sale de `theme.type`): la lista es lo más grande de la pantalla (nombre ~0.8 × h1, línea ~0.9 × body, filas de ~170 px hasta 4 temas; con 5 o 6 se achica parejo y el nombre no baja de ~44 px). Título de apertura a `type.hero`, etiquetas del muro ~30 px (marcadas con `data-qa-ignore`), píldoras del cierre ~34 px, firma a `type.h2`.
- Con nombres muy largos la lista usa un solo tamaño (el del nombre más largo, con piso al 60 %) y corta con "…".
- Profundidad real: cada pieza del muro y cada panel lleva su propia `perspective()` en su `transform` (`rigTransform`), sin `preserve-3d` ni `perspective` en un ancestro; el orden se resuelve con `zIndex`. Hay inclinación, travelling lento, desenfoque por distancia, sombras y el muro desenfocado que entra en foco en el cierre.
- Regla para no romper el determinismo: en una capa 3D todo el movimiento va dentro del `transform`; un `left`/`top` fraccionario (p. ej. un vaivén con `Math.sin` sumado a `top`) se rasteriza distinto según el historial de cuadros y `render --check` lo detecta. Las posiciones de layout van en enteros.
- Si `timing` cambia una duración, los tiempos internos del bloque se escalan en proporción.

Ejemplo: `examples/story-demo` (`/?video=story-demo&props={"theme":"dark"}`). Pruebas: `stories/stories.test.tsx`.
