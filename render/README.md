# render

Convierte un video registrado en un MP4: Chromium captura cada cuadro con `__ve.setFrame(n)` y ffmpeg codifica y mezcla el audio.

## Uso

```bash
npm run render -- hello                       # out/hello.mp4
npm run render -- hello --out out/a.mp4 --props '{"title":"Hola"}'
npm run render -- hello --frames 30-59 --scale 0.5 --crf 23
npm run render -- audio-check --assets ./mis-audios
npm run render -- hello --check               # verifica determinismo
npm run render -- --list                      # videos descubiertos (examples/* y videos/*); al final, los errores por carpeta
npm run render -- hello --format vertical     # horizontal, vertical o cuadrado
npm run render -- hello --list-scenes         # escenas con nombre y sus cuadros
npm run render -- hello --scene world         # solo esa escena (id, nombre o índice desde 0)
npm run render -- hello --liviano             # además deja out/hello-liviano.mp4 de 25 MB como máximo
npm run limpiar -- hello --seco               # salidas viejas de ese video (ver "Limpiar salidas viejas")
```

Tambien `npx ve-render <id> ...`. **La herramienta se ejecuta desde un clon de este repositorio**: el bin carga el TypeScript con `tsx` y compila el runtime con `vite`, ambos devDependencies (instalados con `npm install` en el clon). No esta pensada para instalarse como paquete suelto; se eligio esto para no ensanchar las dependencias de ejecucion del motor (solo React).

## Opciones

| Opcion | Descripcion |
|---|---|
| `--out` | Archivo de salida (por defecto `out/<id>.mp4`; con `VE_VIDEOS_DIR`, `<VE_VIDEOS_DIR>/out/<id>.mp4`) |
| `--props '<json>'` | Objeto JSON mezclado con `defaultProps` |
| `--frames a-b` | Solo ese rango (inclusive): un extracto con el audio que le corresponde, alineado al del video completo (ver "Extracto con sonido"). Sin `--out`, sale como `out/<id>-f<a>-<b>.mp4` para no pisar el video completo |
| `--seconds a-b` | Lo mismo en tiempo: `12.5-20` o `1:30-2:05.5` (m:ss o h:mm:ss); el fin no se incluye. No se combina con `--frames` ni `--scene`. Con `--check`, también |
| `--format f` | `horizontal`, `vertical` o `cuadrado`. El video tiene que habilitarlo (`formats` en `defineVideo`); si no, error que dice cuáles admite. La salida por defecto pasa a `out/<id>-<formato>.mp4` |
| `--scene id\|n` | Solo esa escena (id o nombre; o el índice desde 0 que muestra `--list-scenes`). Fija el rango de cuadros: no se combina con `--frames`. Salida por defecto `out/<id>-<escena>.mp4`. También en `--check` |
| `--list` | Lista los videos que descubrió el runtime con su tamaño, duración, formatos y carpeta (no lleva `<videoId>`). Si alguna carpeta no cargó (archivo roto, `id` repetido) lo informa después de la lista, sin dejar de listar los demás |
| `--list-scenes` | Lista las escenas con nombre del video (id, cuadros, duración) |
| `--concurrency N` | Paginas en paralelo (por defecto `min(cpus, 6)`) |
| `--scale N` | Escala de salida (`0.5`, `2`...); dimensiones pares garantizadas |
| `--crf N` | Calidad H.264 (por defecto 18) |
| `--segment N` | Cuadros por parte (por defecto 150) |
| `--no-audio` | Sin audio |
| `--audio-bitrate R` | Tasa del AAC (por defecto `192k`; `256k`...). Ver "Pico del audio codificado" |
| `--audio-peak-max=dB` | Pico verdadero máximo (dBTP) del audio YA codificado en el mp4 (por defecto `-1`). Si lo supera, avisa. Con valor negativo conviene el `=` (también se acepta `--audio-peak-max -2`) |
| `--audio-peak-strict` | Si el pico del audio codificado supera el máximo, falla y no deja el mp4 (para scripts y entregas) |
| `--no-audio-peak-check` | No mide el pico del audio codificado |
| `--liviano [MB]` | Además del mp4, deja al lado `<salida>-liviano.mp4` de como máximo `MB` mebibytes (por defecto 25). Ver "Copia liviana". Con un id de video numérico, `--liviano=25` |
| `--no-cache` | Vuelve a renderizar todas las partes |
| `--keep-frames` | Deja los cuadros en `<carpeta de salida>/<id>[-formato][-escena]-frames/` (el mismo sufijo que el nombre de salida por defecto, así formatos y escenas distintos no se pisan) |
| `--frame-format png\|jpeg` | Captura sin perdida (por defecto) o JPEG (algo mas rapido, con perdida) |
| `--jpeg-quality N` | Calidad JPEG (por defecto 95) |
| `--assets <dir>` | Directorio extra de estaticos/audio (repetible, se busca primero; también `VE_ASSETS`, rutas separadas por `:`). Lo aceptan `render`, `qa`, `sheet`, `privacy` y el servidor de desarrollo (por `VE_ASSETS`). Además se sirven solas, sin pasar nada, `videos/<slug>/assets`, `videos/<slug>/audio` y `<VE_VIDEOS_DIR>/assets` (ver "Archivos del video") |
| `--strict-fonts` | Una familia del sistema que el tema nombra sin archivo (`"Inter", sans-serif`) y no está instalada hace fallar; sin la bandera solo avisa (también `VE_STRICT_FONTS=1`). Ver "Fuentes del sistema que faltan" |
| `--allow-missing-fonts` | Borrador: una fuente que no carga avisa en vez de fallar el render (también `VE_ALLOW_MISSING_FONTS=1`; en `qa`, `sheet` y `privacy` también). Ver "Fuentes que no cargan" |
| `--check` | No codifica: verifica determinismo (sale con codigo 1 si falla). Tolerante por defecto |
| `--check-count N` | Con `--check`: cuadros repartidos parejos en el rango (por defecto 12) |
| `--check-per-scene N` | Con `--check`: cuadros por escena con nombre, varios cerca del inicio (por defecto 6) |
| `--check-all` | Con `--check`: todos los cuadros del rango (lento; se compara de a 48 cuadros para no llenar la memoria) |
| `--check-max-delta N` | Maxima diferencia por canal tolerada; ningun pixel puede pasarla (por defecto 2) |
| `--check-max-ratio R` | Fraccion maxima de pixeles con delta mayor que 1 (por defecto 0.001 = 0.1 %); los de delta 1 tienen su propia cota de 20 % |
| `--check-strict` | Comparacion de PNG byte a byte (implica `--check`) |

API: `renderVideo(options)` (con `format`, `scene`, `seconds`, `assets`, `allowMissingFonts`, `audioBitrate`, `audioPeakMax`, `audioPeakStrict`, `audioPeakCheck` y `liviano`) devuelve `{out, frames, seconds, renderedSegments, cachedSegments, audioPeakDbtp?, liviano?}`; `checkVideo(options)` devuelve `{ok, ...}`, `listScenes(options)` y `listVideos()` (todos en `render/render.ts`).

## Como funciona

1. Compila el runtime con vite en `.ve-cache/bundles/<hash de las fuentes>/` (se reutiliza si nada cambio; el hash incluye `package-lock.json`, `tsconfig.json`, `vite.config.ts` y todo el proyecto salvo `node_modules`, `dist`, `out`, `render`, `docs`, `*.md` y lo que empieza con punto; **incluye `videos/`**, aunque no esté en git; con `VE_VIDEOS_DIR` el `videos/` real ni se compila ni entra en el hash y en su lugar va esa carpeta; `audio/fuentes/` no entra, ver "Cache por partes"). El directorio nunca se modifica una vez creado, asi que dos renders simultaneos (o `npm run build`) no se pisan. Lo sirve en un puerto libre.
2. Una pagina dedicada llama `__ve.scanAudio()` una sola vez, y todos los archivos de audio se resuelven ANTES de renderizar (si falta uno, falla de inmediato).
3. Los cuadros pendientes se reparten en tramos contiguos entre N paginas; cada una espera `__ve.ready` y por cuadro hace `await __ve.setFrame(n)` + captura de `#stage` (CDP `Page.captureScreenshot`). Un rechazo de `setFrame` o un error de pagina aborta con el mensaje.
4. En cuanto una parte tiene todos sus cuadros se codifica a `.ve-cache/seg-<clave>.mp4` (H.264, yuv420p, fps constante) y se borran sus cuadros (uso de disco acotado; la codificacion se solapa con la captura). Al final se concatenan sin recodificar y en la misma pasada se mezcla el audio (`atrim`, `adelay`, `volume`, `amix`) con `+faststart`. **El audio no entra en la clave de las partes**: los archivos de audio (`.wav`, `.mp3`, `.m4a`, `.aac`, `.ogg`, `.opus`, `.flac`, `.aif`...) no cuentan en la huella del video ni en la lista de estáticos de cada parte, así que cambiar solo el audio (otra mezcla, otro techo, otro volumen del archivo) multiplexa el audio nuevo sobre las partes de video en cache y tarda segundos, no minutos. Lo que sigue invalidando las partes: el código del video y los estáticos que el render realmente pidió (fuentes, imágenes). Cambiar el `volume`, el `from` o el `src` de un `<Audio>` es cambiar el código de la escena, y ahí sí se vuelve a renderizar. La compilación del runtime (unos segundos) sí se rehace si cambia un audio dentro de `videos/` o `public/`: solo se salta el render de cuadros.
4b. **Pico del audio codificado.** Con audio, después de multiplexar se mide el pico verdadero (BS.1770, sobremuestreo x4) del audio YA decodificado del mp4 (filtro `ebur128` de ffmpeg). El AAC es con pérdida y puede dejar crestas sobre la mezcla que le entró: una mezcla con techo -2 dBTP llegó a decodificar a +0,9 dBTP. Si el pico supera `--audio-peak-max` (-1 dBTP por defecto) se avisa con cuánto hay que bajar el techo de la mezcla (`npm run audio -- mezcla ... --techo <más bajo>`); con `--audio-peak-strict` falla y no deja el mp4. Subir `--audio-bitrate` ayuda poco: lo que sirve es bajar el techo de la mezcla. El resultado trae `audioPeakDbtp`.
5. Todo lo temporal vive en `.ve-cache/tmp-<pid>-<id>/` y se borra al terminar, al fallar y con Ctrl-C / SIGTERM (el CLI cierra Chromium y limpia antes de salir con 130 / 143).

Chromium se lanza con `--disable-partial-raster` (entre otras banderas): sin ella, el rasterizado parcial reutiliza teselas del cuadro anterior y algunos cuadros salen con diferencias de 1 nivel segun el historial. Se puede agregar mas banderas con `VE_CHROMIUM_ARGS`.

## `--check`: que cuadros mira

- **Video completo con escenas con nombre** (declaradas con `scenes`, `<Sequence name>`, `composeStory`...): 12 cuadros repartidos parejos **más 6 por escena** (`--check-per-scene`), 3 de ellos cerca del inicio de cada escena (cuadros 2, 10 y 24 de la escena) porque ahí ocurren las entradas, y el resto repartido hasta el final. Antes eran 12 cuadros parejos en todo el video y una falla en la apertura de una historia larga se escapaba (`--scene apertura` la encontraba).
- **Sin escenas con nombre:** 12 repartidos (`--check-count N` los cambia).
- **`--frames a-b`:** se verifica **dentro del rango** (12 repartidos, o todos si el rango tiene 12 o menos), sin agregar cuadros por escena. Antes `--check` ignoraba `--frames` sin avisar.
- **`--scene x`:** los repartidos más los de la escena (el rango de la escena).
- **`--check-all`:** todos los cuadros del rango (video, escena o `--frames`); lento (cada cuadro se dibuja y captura cuatro veces).

La salida dice cuántos cuadros se verificaron y por qué (`check: 78 cuadros (12 repartidos + hasta 6 por escena en 11 escenas, ...)`, y al final `check: OK (determinista; N cuadros verificados)`). Para ver las escenas el runtime dibuja todos los cuadros una vez (solo el DOM, unos segundos en un video largo).

## `--check`: que compara y por que es tolerante

Dos pruebas: (1) `__ve.checkDeterminism` sobre esos cuadros, **siempre estricto** (compara el DOM ignorando el orden de atributos, clases y propiedades de `style`, que no cambia píxeles: si falla, la escena depende del historial); (2) esos cuadros se capturan dos veces en layouts de paginas distintos y se comparan los PNG: la comparación de HTML ignora el orden, la de PNG atrapa cualquier diferencia visual.

La comparacion de PNG es tolerante por defecto porque Chromium rasteriza desenfoques, sombras e inclinaciones 3D con diferencias de ~1 nivel en unos pocos pixeles segun el historial de cuadros de la pagina; ese ruido es imperceptible y exigir igualdad byte a byte empujaba a quitar esos efectos. Un cuadro pasa si se cumplen **las tres** cotas siguientes (delta = maxima diferencia por canal de un pixel, de 0 a 255):

1. **Ningun pixel con delta > 2** (`--check-max-delta`). Un cambio real, como una linea de 1 px que se corre, no pasa.
2. **Pixeles con delta 2 <= 0.1 %** del cuadro (`--check-max-ratio`, 0.001). Solo cuentan los pixeles con delta mayor que 1.
3. **Pixeles con delta 1 <= 20 %** del cuadro (cota fija, ruido de desenfoques y sombras grandes). Una deriva uniforme de 2 niveles en todo el cuadro falla por la cota 2.

Asi, una sombra o un desenfoque de cualquier tamano con 1 nivel de ruido no hace fallar el chequeo. Para cada cuadro con diferencias se imprime el delta maximo, la cantidad y proporcion de pixeles distintos y el rectangulo (bbox) que los contiene; los toleradas se marcan como "ruido tolerado". Un cambio real (un bloque de 40x40 con +30 niveles, una linea de 1 px corrida, o delta 3 en unos pocos pixeles) falla: ver `render/compare.test.ts`. `--check-strict` exige igualdad exacta. Los PNG se decodifican con un decodificador propio minimo (`render/png.ts`), sin dependencias.

`--disable-partial-raster` (ver arriba) ya elimina la mayor parte de ese ruido.

## Uso desde otras herramientas

`render/index.ts` exporta `renderVideo`, `checkVideo`, `ensureBundle(root, cacheDir, runId, log)` (bundle de vite en `<cacheDir>/bundles/<hash>`; devuelve el directorio), `newRunId()`, `defaultRoot`, `hashDir`, `serveStatic(roots, pageRoot)`, `launchChromium()`.

## Cache por partes

Clave de cada parte = hash de: huella del código **de ese video** (ver abajo; si no se puede calcular, el hash de todo el bundle), id, props, rango de cuadros, escala, crf, version de ffmpeg, version de Chromium, `VE_CHROMIUM`/`VE_CHROMIUM_ARGS`, fps, dimensiones y formato del video, ajustes del codificador (preset, bframes, pix_fmt) y formato de captura. **Los estáticos no están en la clave** (antes entraba ruta+tamaño+fecha de TODOS los archivos de las carpetas de estáticos y de `public/`, y agregar un archivo suelto rehacía el video entero); se validan aparte, ver "Estáticos usados". Una segunda corrida sin cambios no renderiza nada.

Las partes se alinean a multiplos de `--segment`. Con `--frames a-b` solo se comparten con un render completo las partes que quedan **enteras** dentro del rango; las de los bordes son parciales (su rango es distinto) y tienen su propia clave.

**Estáticos usados (`render/estaticos.ts`).** El servidor de estáticos sabe qué URLs sirvió durante el render. Junto a cada parte (`.ve-cache/seg-<clave>.mp4`) se guarda `seg-<clave>.estaticos.json`: la lista de URLs que el render pidió (fuentes, imágenes, lo que sea que salga de `--assets`, `videos/<slug>/assets`, `<VE_VIDEOS_DIR>/assets`, `public/`...), el archivo al que se resolvió cada una y el hash de su contenido. Para reutilizar una parte, cada URL de su lista se vuelve a resolver contra las carpetas **de ahora**, con la misma prioridad que el servidor, y se compara:

- el contenido (hash; con una caché por tamaño+fecha+inodo, así que no se relee lo que no cambió): `cambió el estático /logo.png`;
- de qué archivo sale: un archivo nuevo en una carpeta de más prioridad que tapa a uno usado también invalida;
- si daba 404 y ahora existe (`apareció el estático ...`) o al revés (`desapareció ...`).

Un archivo que ningún cuadro pidió (una pista original, un intermedio, un borrador) no cambia nada: agregarlo, tocarlo o borrarlo no invalida. No puede haber falsos aciertos: una parte sin lista (caché de antes de este cambio) o cuya lista no se pudo garantizar (un estático cambió **mientras** se renderizaba: se detecta comparando su firma en el primer pedido y al terminar la parte) se rehace siempre; y la parte vieja se borra antes de rehacerla, así que no queda un mp4 viejo con una lista nueva. Lo que genera la compilación (`/assets/<nombre>-<hash>.js`) y el audio no se anotan: los cubre la huella del código.

La lista de cada parte es **todo lo pedido hasta que esa parte terminó de capturarse, por cualquier página**: es un conjunto mayor que lo que usó la parte, así que solo puede invalidar de más (cambiar una imagen que usa solo una escena puede rehacer también partes de otras escenas que se renderizaron en paralelo), nunca de menos. Refinarlo por página y por cuadro no vale el riesgo: una imagen que termina de cargar un cuadro tarde se atribuiría mal.

**`audio/fuentes/` no se sirve ni entra a nada.** Para las pistas originales, los empalmes y otros intermedios de una mezcla (ver `docs/audio.md`), usá `videos/<slug>/audio/fuentes/`: dentro de una carpeta llamada `audio`, la subcarpeta `fuentes/` da 404 en el servidor (no se puede pedir), no entra a la huella del video (la huella no mira las subcarpetas `assets/` ni `audio/` de la carpeta del video: sus archivos solo cuentan si el código los importa o el render los pide) y tampoco al hash de compilación del runtime (`ensureBundle` la saltea). Guardar ahí un original de 500 MB no cambia ninguna clave. `assets/fuentes/` (por ejemplo tipografías) se sigue sirviendo normal: la regla es solo para `audio/fuentes/`.

**`videos/<slug>/referencias/` (material de referencia de la persona).** Capturas, documentos y notas que manda la persona para recrear una interfaz. Solo se sirven las carpetas `assets/` y `audio/` del video, así que `referencias/` no se sirve; no entra a la huella del video (agregar una captura no invalida ninguna parte); y `privacy --scan-source` la saltea (tiene datos reales a propósito y nunca entra al video). Sí entra al hash de compilación del runtime (cuesta unos segundos de compilación, no cuadros). Si no se versiona la carpeta de videos, tampoco se versiona esto; con un `git init` local, es la persona quien decide si lo incluye.

**Por qué no se reutilizó (`caché: ...`).** Cuando hay partes por renderizar, `render` lo dice: `caché: 33 partes sin entrada: cambió el código del video (videos/x/escena.tsx, kit/Foo.tsx)`, `cambió el bundle` (cuando no se pudo aislar el video), `cambiaron las props`, `cambió la escala`, `cambió el crf`, `cambió el formato u opciones de render (la versión de ffmpeg, ...)`, `no había entrada en la caché para este video (primer render, o caché borrada)`; y, para las partes que existían pero sus estáticos cambiaron, `caché: 2 partes invalidadas: cambió el estático /b.svg`. Con `--no-cache`: `caché: desactivada`. Sale de comparar con `.ve-cache/ultimo-<video+formato>.json`, que cada render deja con los ingredientes de su clave (con el hash de cada archivo de código, para nombrar cuáles cambiaron); es solo diagnóstico: si falta, no cambia qué se reutiliza.

**Una prop de sonido no cambia la clave? No: por qué.** Cambiar solo una prop de sonido en una historia (o apagar el audio de una escena) vuelve a renderizar todo porque esa prop vive en el código del video (la historia, la escena) y la huella es el hash de ese código; con `--props` entra en la clave tal cual. El motor no sabe qué parte del código o de las props afecta a los cuadros y cuál solo a `<Audio>`: una prop puede ser a la vez volumen y opacidad de una barra, y excluirla por el nombre daría partes viejas sin avisar, lo que esta caché no acepta. Qué haría falta para hacerlo seguro: que el video declare sus props de solo sonido (por ejemplo `defineVideo({ audioProps: [...] })` en `engine/`) y que el runtime lo **verifique** (que ningún componente que dibuja las lea: una excepción si una escena lee una prop declarada de audio); o un archivo de código reservado para el sonido (`sonido.ts`) que el runtime garantice que solo alimenta a `<Audio>`. Ninguna de las dos cabe en `render/`: se dejó sin hacer. Mientras tanto: la mezcla y `cues.json` (archivos de `audio/`) ya no rehacen nada; para iterar el sonido, mantené los parámetros en archivos de datos dentro de `audio/` y no en el código de la escena.

**Huella por video.** vite.config.ts emite `ve-deps.json` en el bundle: los fuentes que usa el runtime y los que alcanza cada carpeta de video siguiendo imports estáticos, imports dinámicos con literal, `import.meta.glob` y los recursos `new URL('./x.png', import.meta.url)` con literal, estén o no dentro de la carpeta del video. Si un video (o el runtime) usa algo que no se puede seguir (`new URL(variable, import.meta.url)`, `import(variable)`), el video queda en `opaque` y su huella pasa a ser el hash de todo el bundle: ante la duda, se invalida todo, nunca se reutiliza una parte vieja. La huella de un video (`videoCodeFiles`, y `videoCodeHash` para el hash solo) mezcla esos fuentes, los archivos de la carpeta del video (salvo sus subcarpetas `assets/` y `audio/`, que son estáticos, y `referencias/`, el material de referencia de la persona: capturas y notas que no son código ni se sirven), `package-lock.json`, `tsconfig.json`, `vite.config.ts` y `engine/runtime/index.html`. Editar `videos/a/` ya no invalida las partes de `videos/b/` ni las de los ejemplos; tocar el motor, el kit o el tema sí invalida las de los videos que los usan (los barriles `engine/index.ts` y `kit/index.ts` arrastran todo su contenido, así que en la práctica es casi todo). Supuesto: un video no depende del código de otro video; los módulos de los otros videos se cargan en la página pero solo registran su `defineVideo`.

**Por escena: no se hace.** Una escena es una función de React: el motor no sabe de qué archivos depende ni en qué carpeta vive, y los segmentos cruzan los límites entre escenas (una vuelta al listado depende de todas las anteriores y de la línea de tiempo). Una clave por carpeta de escena daría cachés viejas sin avisar cuando la escena usa código compartido; por eso la granularidad es el video. Para iterar sobre una escena se renderiza sola con `--scene`, que solo toca sus partes. `.ve-cache/` (partes y bundles) no se limpia solo: borrarlo a mano si crece.

## Tiempo restante

La captura imprime una línea por cada 5 % con el tiempo estimado que falta: `render: 35% (525/1500 cuadros, 6.5 fps, faltan ~2 min 30 s)`. La estimación usa la velocidad de los últimos ~60 s (no el promedio desde el inicio, que sesgan el arranque de las páginas y las escenas pesadas); si un tramo es lento y pasa más de un minuto sin llegar al siguiente 5 %, imprime una línea igual. Son líneas de texto comunes, sin retornos de carro ni códigos de control: sirven igual en una terminal que en un log. Solo cuenta los cuadros por renderizar (lo que está en la caché no entra). Código en `render/progreso.ts`.

## Copia liviana (`--liviano [MB]`)

`npm run render -- <id> --liviano` (25 MB) o `--liviano 40` deja, al lado de la salida y sin tocarla, `<salida>-liviano.mp4` (con `--out out/x.mp4`: `out/x-liviano.mp4`; respeta `VE_VIDEOS_DIR`/`VE_OUT_DIR` como la salida). Un "MB" son 1024 x 1024 bytes (así cuentan los canales de entrega que ponen un tope). El audio se copia sin recodificar; el video se recodifica con H.264 a la tasa que sale de `tope x 0,95 - audio` y la duración. Después se mide el tamaño real: si se pasó, se reintenta una vez, en dos pasadas y con la tasa corregida por lo medido y un 7 % menos. Si aun así no entra, el archivo queda, el comando avisa y sale con código 1 (el mp4 completo está bien). Si el original ya entra en el tope, la copia es idéntica; si el tope no alcanza ni para el audio, error. No cambia la resolución: con un tope muy bajo para la duración conviene además `--scale 0.5`. Código en `render/liviano.ts`.

## Design systems instalados (`npm run sistemas`)

`npm run sistemas` (`-- --json` para leerlo desde un script) lista, sin escribir nada, los design systems instalados en la carpeta de videos: la de `VE_VIDEOS_DIR` o `.video-studio.local.json` (igual que el resto, por `render/dirs.ts`) o `videos/` del clon. Un sistema instalado es una carpeta directa con `theme.ts` y `README.md` en su raíz y sin ningún `index.ts(x)` adentro; por cada uno muestra la ruta, las piezas `.tsx`, si hay `assets/<sistema>` y `<sistema>-base`, y los videos cuyo `theme.ts` lo reexporta. Convención completa en `docs/instalacion.md`, "Compartir un design system". Código en `render/sistemas.ts` y `render/sistemas-cli.ts`.

## Limpiar salidas viejas (`npm run limpiar`)

`npm run limpiar -- <slug|id>` lista las salidas de ese video en la carpeta de salidas (`out/`, `<VE_VIDEOS_DIR>/out` o `VE_OUT_DIR`) que son **más viejas que su código**, y las borra con confirmación. Son salidas del video los mp4 (`<id>[-formato][-escena][-f<a>-<b>][-liviano].mp4`), las hojas (`<id>[...]-sheet.png`) y las carpetas de cuadros (`<id>[...]-frames/`); "su código" es la carpeta del video (`videos/<slug>/` o `<VE_VIDEOS_DIR>/<slug>/`, o `examples/<slug>/`): el archivo más nuevo de ahí (la fecha de una carpeta de cuadros es la de su archivo más nuevo). Lo más nuevo que el código se conserva y se lista aparte. `--seco` solo lista; `--si` borra sin preguntar (sin terminal interactiva y sin `--si`, no borra y sale con 2). Si dos videos tienen ids con el mismo comienzo (`hola` y `hola-mundo`), un archivo es del id más largo que le calza: no se borra lo del otro. Los ids se leen del texto del código (`defineVideo({ id: ... })`, `defineStory`); acepta el slug o cualquiera de esos ids. Nunca borra fuera de la carpeta de salidas: cada ruta se comprueba antes de borrar, solo se tocan hijos directos de esa carpeta y un enlace simbólico se borra como enlace, sin seguirlo. `npm run clean` (borra toda la caché y todas las salidas) sigue igual. Código en `render/salidas.ts` y `render/limpiar.ts`.

## Videos rotos, ids repetidos y compilación

Un video en construcción no tiene que dejar inservibles a los demás:

- **Error al cargar (en ejecución):** una carpeta que lanza al cargarse, o un `id` repetido, se anota por carpeta y el runtime sigue con el resto. `render <id>`, `qa`, `sheet` (todos pasan por el mismo runtime) fallan solo si `<id>` es uno de los comprometidos (id repetido: el error nombra las dos carpetas) o si no existe (y entonces el error lista las carpetas que no cargaron). Al renderizar otro video se imprime un `aviso:` con la primera línea de cada error ajeno. `render --list` lista todo lo que cargó y después los errores.
- **Error de compilación (sintaxis, import que no existe):** vite no puede compilar esa carpeta; `ensureBundle` detecta el archivo del error, lo reemplaza por un módulo que lanza ese mensaje al cargarse y vuelve a compilar (hasta 8 veces). El resultado es el caso anterior: solo falla el video afectado. No hay chequeo de tipos en el bundle (`tsc` es aparte).

## Pruebas independientes de `videos/`

Las pruebas que necesitan videos propios usan `withTempVideos` (`render/testing.ts`): una carpeta temporal bajo `out/` (con `writeVideoFiles` para escribir sus archivos) con `VE_VIDEOS_DIR` apuntando ahí. El `videos/` real queda fuera del bundle y del hash (no importa si hay un video en construcción con errores de tipos, y las carpetas temporales no se filtran a otros bundles). Los videos temporales importan el motor con ruta absoluta (`engineDir`). `stories/nuevo-sh.test.ts` arma un proyecto mínimo temporal (enlaces a `engine/`, `kit/`..., copia de `templates/`) y hace el typecheck solo de lo generado con un `tsconfig` propio. `withVideosDir` (cerrojo sobre el `videos/` real) queda para quien de verdad lo necesite; el cerrojo guarda el pid y se rompe solo si su dueño murió o tiene más de 15 minutos.

## Videos fuera del repo (`VE_VIDEOS_DIR`)

`VE_VIDEOS_DIR=/ruta/absoluta/mis-videos npm run render -- --list` (también render, `--check`, `qa`, `sheet`, `privacy` y `npm run dev`) carga los videos de esa carpeta (`<slug>/index.ts(x)` y `<slug>/<carpeta>/index.ts(x)`; se ignoran las carpetas que empiezan con punto) **además de los ejemplos**, y los muestra como `videos/<slug>`. **Las rutas `videos/<slug>/...` de los comandos se leen contra esa carpeta**: `privacy --deny videos/<slug>/prohibidos.txt --scan-source videos/<slug>` y `--assets videos/<slug>/audio` prueban primero la ruta tal cual y, si no existe, `<VE_VIDEOS_DIR>/<slug>/...` (`render/rutas.ts`); si no está en ningún lado el error nombra las rutas probadas. Los comandos de `npm run audio` (`--out`, `--cues`, `--tempo`, `--voz`...) hacen la misma traducción (`audio/rutas.ts`): una entrada se prueba tal cual y después contra esa carpeta; una salida cae en la carpeta del video si existe afuera. Sirve para dejar los videos fuera del repo y para pruebas con videos temporales. Si la ruta no existe o no es una carpeta, el CLI falla con un mensaje en español (no lista vacío). Una carpeta sin videos es válida y no da error.

Causa del listado vacío que había: `import.meta.glob` de vite con una ruta relativa que sale del proyecto (`../../../../tmp/...`) devuelve un mapa vacío, y se llevaba también los ejemplos. Ahora `vite.config.ts` saca los patrones de `videos/` y agrega imports dinámicos con ruta absoluta de lo que encuentra en la carpeta (se escanea al compilar; al agregar una carpeta nueva el hash del bundle cambia solo).

**Armar la carpeta.** `VE_VIDEOS_DIR=/ruta/mis-videos npm run nuevo -- escena <slug> <nombre>` escribe ahí (en vez de en `videos/`) con los imports por alias (`video-estudio/engine`, ...) y crea `tsconfig.json` y `env.d.ts` si faltan (`... npm run nuevo -- externo` solo prepara esos dos). Los modelos están en `templates/externo/` (`tsconfig.json` con `paths` a este clon, sin `baseUrl` porque TypeScript 7 lo rechaza; `types: []` porque `vite/client` no se resuelve desde afuera; `env.d.ts` declara `*?url`, `*?raw`, imágenes, fuentes y audio; `react` y `react-dom` se resuelven a los tipos del clon). `npm run typecheck` revisa también esa carpeta cuando `VE_VIDEOS_DIR` está definida; `npm run typecheck:videos` la exige. `templates/tema-informe.ts` lee el tema de `<VE_VIDEOS_DIR>/<slug>/theme.ts` (o de una ruta a un `.ts`) con el mismo vite del proyecto, así que resuelve el alias y tolera los imports `?url`.

**Configuración local (`.video-studio.local.json`).** En vez de exportar la variable y hacer `cd` al clon en cada comando, se puede dejar un archivo en la raíz del clon (ignorado por git):

```json
{ "videosDir": "~/mis-videos", "outDir": "~/mis-videos/out", "cacheDir": "~/mis-videos/.ve-cache" }
```

Solo `videosDir` es necesaria; `outDir` y `cacheDir` son opcionales (`VE_OUT_DIR` y `VE_CACHE_DIR`). Una ruta relativa cuelga de la carpeta del archivo y `~` es la carpeta personal. **La variable de entorno siempre gana**: el archivo solo se lee para las que no estén definidas (o vacías). Todos los comandos (`render`, `qa`, `sheet`, `privacy`, `audio`, `limpiar`, `typecheck`, `npm run dev`) pasan por `render/dirs.ts`, que completa `process.env` con el archivo antes de leer nada (`render/config-local.mjs`); las pruebas (`VITEST`) no lo leen, para que sean herméticas aunque el clon lo tenga. Un archivo mal hecho (JSON roto, clave desconocida, valor que no es texto) es un error que nombra el archivo, con código de salida 2: no se ignora, porque mandaría los videos a otra carpeta sin avisar. `npm run doctor` muestra de dónde sale la carpeta de videos (`desde VE_VIDEOS_DIR` o `desde .video-studio.local.json, clave videosDir`). `VE_CONFIG_LOCAL=<archivo>` usa otro archivo (otra configuración) y `VE_SIN_CONFIG_LOCAL=1` lo ignora.

Cómo importar el motor desde un video de afuera: con el alias `video-estudio/<carpeta>`, que apunta a la carpeta del repo.

```ts
import React from "react";                                  // un solo React: el del repo (resolve.dedupe)
import { defineVideo, useFrame } from "video-estudio/engine";
import { ThemeProvider, neutral } from "video-estudio/themes";
import { Stage } from "video-estudio/kit";
import { Typewriter } from "video-estudio/fx";               // y "video-estudio/fx/three"
```

También sirve la ruta absoluta al repo (`/clon/engine`). Los imports relativos entre archivos del propio video funcionan igual. El render no necesita el `tsconfig.json`; es para el editor y `tsc`. Los archivos de la carpeta entran en el hash del bundle como los de `videos/`.

## Extracto con sonido (`--frames` y `--seconds`)

`--frames a-b` y `--seconds a-b` entregan un mp4 con SOLO ese tramo y el audio que le corresponde: las pistas se recortan y se corren con la misma cuenta que el video completo (`atrim` al cuadro, `adelay`), así que un clic que en el video completo suena en el segundo 1,43 suena en el 0,43 del extracto, con la misma diferencia de menos de 1 ms (el AAC mueve apenas el comienzo del ataque). No hay que recodificar ni recortar a mano con ffmpeg. Las partes de video alineadas a `--segment` salen de la cache; solo se renderizan las de los bordes (alineá el tramo a `--segment`, `--segment 30`, para no renderizar nada). El mp4 del extracto empieza en el segundo 0 y dura exactamente `cuadros / fps`. Prueba: `render/audio.e2e.test.ts`.

## Scripts de afuera del repo (`npm run exec`)

Un script suelto que importa `video-estudio/engine`, `video-estudio/audio/medidas`, `video-estudio/qa/...`, etc. necesita el alias `video-estudio/*` y un solo React. En vez de armar un `tsconfig` con `paths` a mano:

```bash
npm run exec -- /ruta/al/script.ts [argumentos...]    # o una ruta relativa al directorio desde donde llamás
```

Corre `tsx` con `tsconfig.exec.json` (alias `video-estudio/*` al clon, y `react`/`react-dom` del clon), con el directorio de trabajo y las rutas relativas de donde se llamó (se vuelve a él con `INIT_CWD`). El script no necesita carpeta, `package.json` ni `node_modules` propios. Para escribir el script con tipos en el editor, la carpeta externa usa `templates/externo/tsconfig.json` (ver "Armar la carpeta"); este comando es solo para correrlo. Prueba: `render/exec.test.ts`.

## Archivos del video (fuentes, logos, audio): dos maneras

1. **`asset("ruta")`** resuelve una URL que sirve el servidor del render, buscando en este orden: `--assets <dir>` / `VE_ASSETS`, la carpeta del propio video (`videos/<slug>/assets` y `videos/<slug>/audio`), `<VE_VIDEOS_DIR>/assets`, el bundle y `public/`. Sin pasar nada, una carpeta `assets/` al lado de los videos externos o dentro de `videos/<slug>/` se sirve sola en `render`, `qa`, `sheet`, `privacy` y `npm run dev` (en el servidor de desarrollo, con las de todos los videos). Es lo que usan `Audio`, imágenes y `theme.font.files`.

   ```ts
   // fuente de marca en <VE_VIDEOS_DIR>/assets/fonts/Marca-Bold.otf
   font: { ...neutral.font, family: '"Marca", sans-serif', files: [{ weight: 700, src: asset("fonts/Marca-Bold.otf") }] }
   // logo en <VE_VIDEOS_DIR>/assets/brand/logo.png
   <img src={asset("brand/logo.png")} alt="" />
   ```

2. **`import url from "./x.otf?url"`** (o `"../assets/brand/logo.png"` a secas) lo resuelve vite: copia el archivo al bundle con un nombre con hash y devuelve su URL. Funciona igual en `render`, `qa`, `sheet`, `privacy` y `dev`, sin carpeta extra ni flag; el hash del bundle incluye el archivo. Con TypeScript hace falta la declaración de `*?url` (en el repo, `vite/client`; en una carpeta de afuera, el `env.d.ts` de `templates/externo/`).

   ```ts
   import marcaBold from "../assets/fonts/Marca-Bold.otf?url";
   import logo from "../assets/brand/logo.png?url";
   const tema = { ...neutral, font: { ...neutral.font, family: '"Marca", sans-serif', files: [{ weight: 700, src: marcaBold }] } };
   ```

Con `import` el archivo viaja con el código (no hay nada que olvidarse de pasar); con `asset()` el archivo queda fuera del bundle (conviene para audio pesado y para lo que se cambia sin recompilar). La clave de la cache de partes incluye el resumen (ruta, tamaño, mtime) de **todas** las carpetas de estáticos que se sirven, las pasadas y las automáticas.

## Fuentes que no cargan

Una fuente que falla (404, archivo dañado, familia sin `@font-face`) no rompe nada a la vista: el navegador cae a la siguiente de la pila y el video sale con otra tipografía, sin aviso. Por eso `ThemeScope` verifica cada archivo de `theme.font.files` después de `document.fonts.load` (el resultado no vacío y `document.fonts.check`) e informa la falla al motor (`reportFontFailure`, `engine/fontCheck.ts`); el runtime, al terminar de esperar los recursos de cada cuadro, revisa también `document.fonts` (cualquier `@font-face` en estado `error`). **El render falla** con un mensaje que nombra la familia, el peso y la URL:

```
No cargó una fuente; el video saldría con otra tipografía:
  - "Marca" (peso 700) desde http://127.0.0.1:41233/fonts/Marca-Bold.otf: no se pudo descargar o leer el archivo (...; ¿404 o archivo dañado?)
```

### Fuentes del sistema que faltan

Lo de arriba vigila las fuentes **con archivo** (`theme.font.files`). Una familia que el tema nombra **sin archivo** (una fuente instalada en la máquina, como `"Inter", sans-serif`) no se carga desde ningún lado: si no está instalada, el navegador usa la siguiente de la pila y el video sale con otra letra, distinta según la máquina. `render` lo detecta (`render/fuentesSistema.ts`): en el primer cuadro, el del medio y el último mira la primera familia de cada elemento con texto y, si no es genérica (`sans-serif`, `system-ui`...) ni viene de un `@font-face`, comprueba que esté instalada midiendo texto contra tres familias base. Si falta, imprime `aviso: La fuente "X" no está instalada en esta máquina...`; con `--strict-fonts` (o `VE_STRICT_FONTS=1`) lanza un error con ese mensaje. No cambia ni un píxel del render. `qa`, `sheet` y `privacy` todavía no hacen esta comprobación (solo `render`; `qa/session.ts` puede llamar a `comprobarFuentesDelSistema`). La solución de fondo es declarar la fuente con archivo (`theme.font.files` y `asset()` o `?url`), para que el resultado no dependa de la máquina. Prueba: `render/fuentesSistema.test.ts`.

Lo mismo (fuentes con archivo) en `qa`, `sheet` y `privacy` (todos dibujan con el mismo runtime). Para un borrador: `--allow-missing-fonts` (o `VE_ALLOW_MISSING_FONTS=1`), que solo avisa por consola. La prueba usa un video temporal con una URL que da 404 (`render/fuentes.test.ts`, con `withTempVideos`/`writeVideoFiles` de `render/testing.ts`).

## Velocidad de render: dónde se va el tiempo

El costo es de CPU en Chromium, no de codificación ni de disco. `render` imprime, además del total, `tiempo por etapa`: dibujar el cuadro (React + esperas: segundos), captura de pantalla (la rasterización y composición del cuadro ocurren acá, es casi todo) y escritura del PNG; x264 se solapa con la captura y pesa ~10 %. Medido en este entorno (4 núcleos compartidos, 1920x1080, `--no-cache --no-audio`, 60 cuadros por muestra):

| Muestra | CPU por cuadro | Notas |
|---|---|---|
| `hello` (escena sencilla) | ~0.07 s | |
| `story-demo`, apertura / temas | 0.18 a 0.24 s | 3D, desenfoques, mucho DOM |
| `story-demo --scale 0.5` | ~0.09 s | la rasterización crece con los píxeles (en una máquina con la CPU libre; ver la medición con carga más abajo: no es una ganancia confiable) |
| `--frame-format jpeg` | casi igual | cambia la codificación, no la rasterización |
| `--disable-gpu`, `--disable-gpu-compositing`, `--num-raster-threads`, GPU raster | sin mejora (mismo CPU) | además cambiarían la clave de cache |

Render completo de `story-demo` (1590 cuadros, 53 s, 1920x1080, con 3D y desenfoques, `--no-cache`) medido mientras la máquina estaba ocupada por otras tareas (promedio de carga 8 sobre 4 núcleos): **7.6 min de reloj, 4 min de CPU** (5.4 fps al principio, 4 fps al final), con 4 páginas: dibujar los cuadros 233 s, captura 1390 s, escritura 24 s (sumas entre las 4 páginas). Con la máquina libre, esos 4 min de CPU son ~1 a 1.5 min de reloj.

**Medición con la máquina cargada (4 núcleos, carga de 10 a 17 por otros procesos; `kit-demo`, 1920x1080, 300 cuadros, 2 partes, `--no-audio`):** render completo a tamaño entero 82 s (unos 3,7 cuadros por segundo, con la compilación del bundle); a `--scale 0.5 --crf 23`, 95 s con la carga más alta; 90 cuadros sin caché a tamaño entero 28 a 29 s (3,1 cuadros por segundo) y a mitad de tamaño 32 a 35 s: **con la máquina ocupada el borrador a mitad de tamaño no es más rápido que el final**. En un render de un video real (medido por otra persona con carga 20) 4 cuadros por segundo a tamaño entero: 49 s son unos 6,7 min en horizontal. Contá 3 a 4 cuadros por segundo en una máquina compartida de 4 núcleos; con la CPU libre es bastante más (no se pudo medir en esta tanda).

**Caché y borradores.** La clave de cada parte (150 cuadros) incluye el video, el código, las props, el rango, la escala (`--scale`), el `--crf`, las carpetas de estáticos y el entorno (versiones de ffmpeg y Chromium, formato y tamaño): **no incluye el audio** (se mezcla al final sobre las partes ya hechas). Entonces: (a) un render mudo a tamaño entero (`--no-audio`) y el final con sonido **comparten todas las partes** (medido: la segunda corrida da `2 en cache, 0 por renderizar` y tarda 3 s); (b) un borrador a mitad de tamaño o con otro `--crf` es otro píxel y no comparte nada con el final: es trabajo duplicado, no un adelanto. Por eso para aprobar el video mudo conviene mostrar la hoja y los tramos que importan (`--seconds`, `--scene`), o renderizar una vez a tamaño entero, y no hacer un borrador completo a otra escala.

**Regla práctica:** tiempo de un render completo ≈ `cuadros × (0.07 a 0.25 s de CPU) / núcleos libres` más ~15 s fijos (compilar el bundle la primera vez, abrir las páginas, concatenar). `--concurrency` solo ayuda hasta la cantidad de núcleos libres: con más páginas que núcleos todo se enlentece. Un video de 60 s (1800 cuadros) con 3D y desenfoques son ~4 a 6 min de CPU: ~1.5 a 2 min con 4 núcleos libres, 5 a 8 min si la máquina está ocupada o tiene 1 o 2 núcleos (ahí se ven 4 a 6 cuadros por segundo, que es lo que se reportó con 5.5 min). El `--scale 0.5` para borradores es el atajo que más rinde (~2x). No se encontró un ajuste seguro que acelere más sin cambiar píxeles.

## Cache y salidas con videos privados

Con `VE_VIDEOS_DIR` (videos en una carpeta fuera del clon) la cache de compilación (bundle con fuentes, logos y código de las escenas, segmentos, cuadros) y las salidas por defecto (mp4, hojas) **no se escriben en el clon público**: van a `<VE_VIDEOS_DIR>/.ve-cache/` y `<VE_VIDEOS_DIR>/out/`. Sin la variable siguen en `.ve-cache/` y `out/` del clon (ignoradas por git). Se pueden forzar con `VE_CACHE_DIR` y `VE_OUT_DIR` (rutas absolutas o relativas al directorio actual); `--out` sigue mandando sobre todo (ver la regla de abajo). La carpeta `out/` de la carpeta externa no cuenta como código del video ni entra en el hash.

**Regla de `--out` (y `--json` de `qa`/`privacy`, `--out` de `sheet`, y `--out`/`--junto-a` de `audio` cuando empiezan con `out/`)**, función `resolverSalida` de `render/dirs.ts`:

1. Una ruta absoluta no cambia.
2. Sin `VE_VIDEOS_DIR` ni `VE_OUT_DIR`, una relativa cuenta desde el directorio actual (`out/x.mp4` queda en `out/` de donde corras el comando).
3. Con alguna de las dos, una relativa que empieza con `out/` (o `./out/`) usa la carpeta de salidas como si fuera ese `out`: `VE_OUT_DIR` si está definida, si no `<VE_VIDEOS_DIR>/out` (`--out out/x.mp4` da `<VE_VIDEOS_DIR>/out/x.mp4`; `--out out/a/x.mp4`, `<VE_VIDEOS_DIR>/out/a/x.mp4`).
4. Con alguna de las dos, cualquier otra relativa cuelga de `VE_VIDEOS_DIR` (o, si solo hay `VE_OUT_DIR`, de esa carpeta): `--out x.mp4` da `<VE_VIDEOS_DIR>/x.mp4`.

Así una ruta relativa nunca cae dentro del clon cuando hay carpeta externa. Los comandos imprimen la ruta final absoluta (`listo: ...`, `hoja: ...`, `informe: ...`).

`npm run render -- --list` con `VE_VIDEOS_DIR` agrega arriba una línea que dice que las carpetas `videos/<slug>` de la lista están en `<VE_VIDEOS_DIR>/<slug>` (la lista las sigue mostrando con el prefijo `videos/`).

`npm run clean` borra `.ve-cache/` y `out/` del clon y, si está definida, de la carpeta externa (o las de `VE_CACHE_DIR`/`VE_OUT_DIR`); no toca los videos.

## Cache de hashes de archivos

El hash de contenido de los fuentes y de `public/` se calcula en cada render, pero no se relee todo: `.ve-cache/filehash.json` guarda, por archivo, el hash junto con (tamaño, mtime y ctime en nanosegundos, inodo). Solo se leen los archivos cuya firma cambió. Se eligió esto y no "tamaño + mtime como clave" porque esa clave no es correcta (un editor, `cp -p` o `git checkout` pueden dejar el mismo mtime con otro contenido); con el ctime incluido, una escritura que conserve tamaño y mtime igual cambia la firma. Límite: un sistema de archivos que no actualice ni mtime ni ctime (algunos montajes de red); ahí borrá `.ve-cache/filehash.json`.

## Formatos y tamaños

Los lados de todo tamaño de salida tienen que ser pares (x264 yuv420p). `defineVideo` rechaza un tamaño base o explícito impar (propone los pares cercanos) y un objeto `formats` que liste el formato base con otro tamaño. Con `--scale`, si el resultado es impar (p. ej. 563 x 0.5) el render avisa y ffmpeg agrega una fila/columna negra (aviso `lado impar`); elegí otra escala si no lo querés.

## `--check` falla: qué imprime

- `checkDeterminism FALLA en cuadros ...`: por cada cuadro, los elementos que cambian entre los dos renders (ruta DOM, texto, atributo, valor en cada render).
- `PNG distintos ...`: por cada cuadro con diferencias fuera de tolerancia, además del bbox, los elementos (etiqueta, texto corto, ruta DOM, `data-*`/`name`) que hay en el centro y las esquinas del bbox en ese cuadro, y las escenas con nombre activas (un `<Sequence name>` no crea un elemento DOM, por eso se informa aparte).
- Siempre una línea `pista:` que remite a la sección "Qué hacer cuando --check falla" de `docs/reglas.md`.

### Límite conocido: escalas pesadas anidadas

Una sonda (un `div` de layout entero bajo un `scale(1.15 + 0.0173·f)` sobre una cámara con `scale(1.8)`) que el agente de `fx/` vio fallar con `--check` **no se pudo reproducir** con Chromium headless de este entorno (render por software): se probaron 1920x1080 hasta 1600 cuadros (escala acumulada > 40), `--scale 1` y `2`, traslados fraccionarios en la cámara, texto, sombra, borde y rotación, con `--check` y `--check-strict`; todo pasó, salvo el ruido de 1 nivel ya conocido con `blur`. No hay evidencia de un defecto del capturador (esperas de dos `requestAnimationFrame`, `--disable-partial-raster`), así que no se cambió. Si aparece en otra máquina (GPU, otra versión de Chromium), la causa más probable es que Chromium elige la escala de rasterizado de una capa según su historial de escalas y la recorta por tamaño máximo de textura; la receta de `docs/reglas.md` ("Escalas pesadas anidadas": zoom con la cámara, no escalar además el contenedor) es la salida segura.

## Requisitos

- Node >= 22, `ffmpeg`/`ffprobe` en el PATH.
- Playwright con Chromium (peerDependency opcional, no se instala solo). Para otro ejecutable: `VE_CHROMIUM=/ruta/a/chrome`.
- Los `src` de `Audio` se buscan en `--assets`, el bundle y `public/`.

## Problemas comunes

- `No se pudo cargar "playwright"`: instalalo o exporta `NODE_PATH` hacia una instalacion global.
- `No se pudo lanzar Chromium`: revisa `VE_CHROMIUM` o `playwright install chromium`.
- `Audio file ... not found`: poner el archivo en `public/`, en `videos/<slug>/audio` (se sirve solo) o pasar `--assets`.
- `No cargó una fuente ...`: la URL o el archivo de la fuente no se pudo leer (ver "Fuentes que no cargan").
- `setFrame(n) fallo: ... holds pendientes`: un recurso (fuente/imagen) no cargo en 30 s.
- `--check` falla: la escena depende del historial de cuadros (ver regla de determinismo en `engine/README.md`).
