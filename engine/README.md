# engine

Motor de video propio, escrito desde cero (TypeScript + React 18); ver `docs/ORIGEN.md`. Un video es una funcion pura del numero de cuadro.

## REGLA DE DETERMINISMO (obligatoria)

**Toda escena debe ser una funcion pura del numero de cuadro (y de sus props).** El runtime reutiliza UNA sola raiz de React y salta entre cuadros en cualquier orden (y en paralelo por partes), asi que el estado que persiste entre renders cambia el resultado segun el historial.

- Lista completa de lo prohibido y permitido (con motivo y arreglo de cada punto): `docs/reglas.md`, sección "Lista única de determinismo". Resumen: nada de estado que acumule, temporizadores, `Date`, `Math.random()` (usar `random(seed)`), CSS animado ni `useId`.
- Los efectos solo se permiten para `holdRender`/`releaseRender` (esperar fuentes e imagenes) y para el dibujo de `FrameCanvas` (un `useLayoutEffect` que en cada render limpia el lienzo y lo redibuja entero desde el cuadro y las props; no guarda nada entre cuadros).
- Verificacion: `__ve.checkDeterminism([frames])` renderiza cada cuadro dos veces (tras el cuadro 0 y tras otro cuadro) y compara `innerHTML`; `ok: false` significa que la escena depende del historial. Correrlo en QA sobre cuadros representativos.

## API (todo sale de `engine/index.ts`)

- `FrameProvider({frame, config, children})`, `useFrame()`, `useVideoConfig()`; `VideoConfig = {fps, width, height, durationInFrames}`.
- `interpolate(frame, input, output, {easing?, clamp = true})`: lineal por tramos, easing por tramo; lanza error si `input` no es estrictamente creciente o las longitudes difieren.
- `Easing`: `linear`, `cubicIn/cubicOut/cubicInOut`, `bezier(x1,y1,x2,y2)`, presets `Easing.out` = bezier(0.16,1,0.3,1) y `Easing.inOut` = bezier(0.65,0,0.35,1); `Easing.back(overshoot = 1.56)` (salida con sobrepaso) y `Easing.lands` = bezier(0.34,1.56,0.64,1). El resultado del easing puede superar 1: `interpolate` lo aplica tal cual (solo recorta el rango de entrada).
- `FrameCanvas({width, height, draw(ctx, frame, {width, height}), deps?, frame?, pixelRatio?, style?})`: `<canvas>` que se limpia y se redibuja por completo en cada render (`useLayoutEffect` sin dependencias, asi `setFrame` lo captura ya dibujado dentro de `flushSync`). Coordenadas logicas; la resolucion real sigue a `devicePixelRatio`. `draw` debe ser pura. `checkDeterminism` compara tambien el `toDataURL` de los lienzos (`Stage.canvasData()`).
- `random(seed)`: determinista, en [0,1).
- `Sequence({from, durationInFrames?})`, `Series` + `Series.Item({durationInFrames})`: componen anidados; fuera de rango no montan nada.
- `Fill({style})`: div absoluto a cuadro completo.
- `holdRender(label?)` -> handle, `releaseRender(handle)`, `pendingHolds()` (etiquetas pendientes), `waitForHolds(timeoutMs?)`. Si `waitForHolds` agota el tiempo (30 s en `setFrame`/`ready`) rechaza con un error que lista las etiquetas pendientes; **el renderizador debe tratarlo como error fatal** (no capturar el cuadro).
- `asset(path)`: URL de un archivo en `/public` (respeta `BASE_URL`).
- `Audio({src, startFrom?, volume?})`: no dibuja; registra durante el render (idempotente, no depende de efectos) una pista `{src, from, to, startFrom, volume}`:
  - `from`: cuadro ABSOLUTO de inicio (suma de los `Sequence`/`Series.Item` que lo envuelven); nunca negativo (si un `Sequence` empieza antes del cuadro 0, `from` se fija en 0 y la diferencia se suma a `startFrom`).
  - `to`: cuadro absoluto donde termina el `Sequence`/`Series.Item` mas cercano que tenga duracion (exclusivo, ya acotado por los padres); `Infinity` si no hay limite (en `__ve` llega como `null`). El mezclador debe recortar la pista ahi.
  - `startFrom`: cuadros a saltar del inicio del archivo (negativo lanza error). `volume`: multiplicador.
  - `collectAudio()` / `clearAudio()`.
- `defineVideo({id, component, fps, width, height, durationInFrames, defaultProps?, formats?, scenes?})`, `getVideos()`, `getVideo(id)`. Repetir un `id` en el mismo archivo reemplaza el anterior (HMR); el mismo `id` en dos carpetas lanza un error en español que nombra las dos.
- **Formatos**: `width` x `height` es el formato base. `formats: ['vertical', 'cuadrado']` habilita los otros con tamaños derivados (lado largo L, corto S: horizontal L x S, vertical S x L, cuadrado S x S; 1920x1080 da 1080x1920 y 1080x1080), o un objeto `{ vertical: { width, height } }` con tamaños propios. Los lados tienen que ser pares (H.264): un tamaño base o explícito impar se rechaza con un error que propone los pares cercanos; un objeto que lista el formato del tamaño base con otro tamaño también se rechaza (no pisa el base). Sin `formats` el video solo existe en su formato base. Se elige con `&format=vertical` en la página runtime y con `--format` en `render`, `qa` y `sheet`.
- `useFormat()` -> `{ format, width, height, pick }`: `format` es `'horizontal' | 'vertical' | 'cuadrado'`; `pick({ horizontal: a, vertical: b, cuadrado: c })` elige un valor (lo que falta usa el de `horizontal`, que es obligatorio). El tamaño del escenario sale también de `useVideoConfig()` (`width`, `height`, `format`): las escenas tienen que leerlo de ahí y no suponer 1920x1080.
- **Escenas**: `<Sequence name>` y `<Series.Item name>` (opcional) nombran una escena; `defineVideo({ scenes: [{ id, name?, from, durationInFrames }] })` las declara de antemano (`defineStory` lo hace con su línea de tiempo). `resolveScenes(stage)` devuelve las declaradas o, si no hay, las que aparecen al dibujar todos los cuadros una vez (como `scanAudio`).

## Contrato de la pagina runtime (para el agente Render)

Pagina Vite: `engine/runtime/index.html` (`npm run dev` o `npm run build` + `vite preview`; salida en `dist/`).

URL: `/?video=<id>` (por defecto, el primer video registrado). Opcional `&props=<json objeto>` se mezcla con `defaultProps`. Si es invalido (o el `video` no existe) `window.__ve` igual se define, con `ready` rechazado con un mensaje claro y `setFrame` rechazando lo mismo.
Los videos se descubren solos: `engine/runtime/videos.ts` usa `import.meta.glob` sobre `examples/*/index.{ts,tsx}`, `videos/*/index.{ts,tsx}` y `videos/*/*/index.{ts,tsx}` (donde `templates/nuevo.sh` deja escenas e historia) y las carga de a una, en orden alfabético (`engine/runtime/discover.ts`), diciéndole al registro de qué carpeta sale cada `id`. Si `videos/` no existe no pasa nada. **Un video roto no deja inservibles a los demás**: una carpeta que lanza al cargarse, un archivo que no compila (vite lo reemplaza por un módulo que lanza el error; ver `render/README.md`) o un `id` repetido se anotan por carpeta (`__ve.loadErrors`: `{folder, folders, ids, message}`; `__ve.loadError` es el texto junto) y la carga sigue con el resto. `ready`/`setFrame` solo fallan si el video pedido es uno de los comprometidos (un `id` repetido: el mensaje nombra las dos carpetas) o si no existe (y entonces el error lista las carpetas que no cargaron, por si era una de ellas). Con la variable de entorno `VE_VIDEOS_DIR`, vite.config.ts busca los videos en esa carpeta en vez de en `videos/` (pruebas con videos temporales; ver `render/testing.ts`).
Opcional `&format=<horizontal|vertical|cuadrado>`: dibuja el video en ese formato (el `#stage` toma su tamaño).

La pagina monta el video en un `#stage` de exactamente `width x height` px (position relative, overflow hidden, en la esquina 0,0 de la pagina). Para capturar: viewport = width x height y `page.screenshot()` o clip a `#stage`.

`window.__ve`:

| Miembro | Descripcion |
|---|---|
| `ready: Promise<void>` | Se resuelve tras montar el cuadro 0, `document.fonts.ready` y sin holds. Rechaza si el id es desconocido. |
| `videos` | Lista de metadatos `{id, fps, width, height, durationInFrames, format, formats, source}` de todos los videos registrados (`formats`: tamaño de cada formato habilitado; `source`: carpeta de origen). |
| `loadError` | Mensaje si falló la carga de las carpetas de video (id repetido, archivo roto); `null` si todo cargó. |
| `scenes()` | `Promise<{id, name?, from, durationInFrames}[]>`: escenas declaradas o juntadas de `<Sequence name>` (recorre todos los cuadros una vez; solo cuando se pide). |
| `setFrame(n): Promise<void>` | `n` entero en `[0, durationInFrames-1]` (si no, `RangeError`). Renderiza el cuadro de forma sincrona (`flushSync`) y se resuelve cuando: fuentes listas, todos los holds liberados (`waitForHolds`, 30 s de limite) y pasaron dos `requestAnimationFrame`. Despues se puede capturar. |
| `audio()` | Pistas `{src, from, to, startFrom, volume}` registradas hasta ahora (`to: null` = sin limite), ordenadas por `from`. Solo incluye cuadros ya visitados. |
| `scanAudio()` | Desmonta el escenario, limpia el registro, renderiza todos los cuadros una vez (sin esperas) y devuelve todas las pistas; luego vuelve al cuadro que se mostraba. El resultado se guarda en cache (la pagina esta atada a un video y unas props; recargar invalida). **Llamarlo una sola vez, antes de renderizar; nunca por parte/shard** (cada shard con su propia pagina daria el mismo resultado: mezclar el audio una vez, a nivel global). |
| `checkDeterminism(frames)` | `Promise<{frame, ok, error?, diffs?}[]>`; ver la regla de determinismo. Si falla, `diffs` dice qué elementos cambiaron entre los dos renders (ruta DOM, texto, atributo y los dos valores). Restaura el cuadro mostrado antes. |
| `describeAt(n, [[x, y], ...])` | Muestra el cuadro `n` y devuelve, por punto (px del escenario), los elementos que hay ahí de arriba hacia abajo (ruta DOM, texto corto, `data-*`/`name`). Lo usa `--check` para decir qué hay en el bbox que difiere. |
| `loadErrors` | Errores por carpeta de video (ver arriba). |

Notas: nada del motor usa temporizadores ni animaciones CSS; el aspecto de un cuadro depende solo de `n` y de las props.
