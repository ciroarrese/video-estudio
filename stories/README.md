# stories

Estructuras narrativas listas, generadas desde UN objeto de configuración: un video con varios temas recibe la apertura, las vueltas al listado ("volver a la lista") y el cierre sin escribirlos. Todo es función pura del cuadro y sale del tema (`useTheme()`); se apoya en `kit/` (Stage, GradientText, World/cameraAt/zoomThrough, Wash, DockedHeadline, kf).

## Configuración (`StorySpec`)

```ts
const spec: StorySpec = {
  title: { text: "Un día en la oficina", highlight: "la oficina" }, // highlight va con el degradado
  topics: [{ id: "ventas", name: "Panel de ventas", line: "los números del día" }, /* 2 a 6 */],
  labels: ["Resumen diario", "Stock mínimo" /* ... */],           // palabras del muro; si faltan se repiten
  signoff: { logo: "brand/logo.png", tagline: "Hecho con ...", text: "Gracias por mirar" },
  timing: { opening: 300, interlude: 120, closing: 450 },          // opcional (cuadros, mínimo 60)
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
Opening (300) → [escena i → Interlude(done = i+1) (120)] × n → Closing (450)
```

`timeline` = `[{ id, kind: "opening"|"topic"|"interlude"|"closing", from, durationInFrames }]`, contiguo y sin huecos. Con `interludes: false` los temas van uno tras otro. `defineStory` registra el video con `engine.defineVideo` y acepta `theme` ("neutral", "dark" o un objeto `Theme`), también por `&props={"theme":"dark"}`.

Piezas sueltas: `<Opening spec />`, `<Interlude spec done />`, `<Closing spec scenes />` y sus duraciones `OPENING_FRAMES`, `INTERLUDE_FRAMES`, `CLOSING_FRAMES`.

## Límites

- De 2 a 6 temas (otro número lanza un error claro). La lista, el tamaño de letra, los paneles del cierre y los lugares reservados del muro se calculan según `n`.
- Con nombres muy largos la lista usa un solo tamaño (el del nombre más largo, con piso al 60 %) y corta con "…".
- Sin 3D de CSS: la profundidad (muro, paneles) se proyecta a mano y cada pieza usa solo traslado y escala, porque las capas 3D, los giros y los sesgos no se rasterizan igual según el historial de cuadros (`render --check` lo detecta). Por eso los planos no se inclinan. Tampoco hay `backdrop-filter`, `filter` ni sombras grandes sobre piezas escaladas.
- Si `timing` cambia una duración, los tiempos internos del bloque se escalan en proporción.

Ejemplo: `examples/story-demo` (`/?video=story-demo&props={"theme":"dark"}`). Pruebas: `stories/stories.test.tsx`.
