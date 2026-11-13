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
```

Tambien `npx ve-render <id> ...`. **La herramienta se ejecuta desde un clon de este repositorio**: el bin carga el TypeScript con `tsx` y compila el runtime con `vite`, ambos devDependencies (instalados con `npm install` en el clon). No esta pensada para instalarse como paquete suelto; se eligio esto para no ensanchar las dependencias de ejecucion del motor (solo React).

## Opciones

| Opcion | Descripcion |
|---|---|
| `--out` | Archivo de salida (por defecto `out/<id>.mp4`) |
| `--props '<json>'` | Objeto JSON mezclado con `defaultProps` |
| `--frames a-b` | Solo ese rango (inclusive); el audio se recorta igual |
| `--format f` | `horizontal`, `vertical` o `cuadrado`. El video tiene que habilitarlo (`formats` en `defineVideo`); si no, error que dice cuáles admite. La salida por defecto pasa a `out/<id>-<formato>.mp4` |
| `--scene id\|n` | Solo esa escena (id o nombre; o el índice desde 0 que muestra `--list-scenes`). Fija el rango de cuadros: no se combina con `--frames`. Salida por defecto `out/<id>-<escena>.mp4`. También en `--check` |
| `--list` | Lista los videos que descubrió el runtime con su tamaño, duración, formatos y carpeta (no lleva `<videoId>`). Si alguna carpeta no cargó (archivo roto, `id` repetido) lo informa después de la lista, sin dejar de listar los demás |
| `--list-scenes` | Lista las escenas con nombre del video (id, cuadros, duración) |
| `--concurrency N` | Paginas en paralelo (por defecto `min(cpus, 6)`) |
| `--scale N` | Escala de salida (`0.5`, `2`...); dimensiones pares garantizadas |
| `--crf N` | Calidad H.264 (por defecto 18) |
| `--segment N` | Cuadros por parte (por defecto 150) |
| `--no-audio` | Sin audio |
| `--no-cache` | Vuelve a renderizar todas las partes |
| `--keep-frames` | Deja los cuadros en `<carpeta de salida>/<id>[-formato][-escena]-frames/` (el mismo sufijo que el nombre de salida por defecto, así formatos y escenas distintos no se pisan) |
| `--frame-format png\|jpeg` | Captura sin perdida (por defecto) o JPEG (algo mas rapido, con perdida) |
| `--jpeg-quality N` | Calidad JPEG (por defecto 95) |
| `--assets <dir>` | Directorio extra de estaticos/audio (repetible, se busca primero; también `VE_ASSETS`, rutas separadas por `:`). Lo aceptan `render`, `qa`, `sheet`, `privacy` y el servidor de desarrollo (por `VE_ASSETS`). Además se sirven solas, sin pasar nada, `videos/<slug>/assets`, `videos/<slug>/audio` y `<VE_VIDEOS_DIR>/assets` (ver "Archivos del video") |
| `--allow-missing-fonts` | Borrador: una fuente que no carga avisa en vez de fallar el render (también `VE_ALLOW_MISSING_FONTS=1`; en `qa`, `sheet` y `privacy` también). Ver "Fuentes que no cargan" |
| `--check` | No codifica: verifica determinismo (sale con codigo 1 si falla). Tolerante por defecto |
| `--check-count N` | Con `--check`: cuadros repartidos parejos en el rango (por defecto 12) |
| `--check-per-scene N` | Con `--check`: cuadros por escena con nombre, varios cerca del inicio (por defecto 6) |
| `--check-all` | Con `--check`: todos los cuadros del rango (lento; se compara de a 48 cuadros para no llenar la memoria) |
| `--check-max-delta N` | Maxima diferencia por canal tolerada; ningun pixel puede pasarla (por defecto 2) |
| `--check-max-ratio R` | Fraccion maxima de pixeles con delta mayor que 1 (por defecto 0.001 = 0.1 %); los de delta 1 tienen su propia cota de 20 % |
| `--check-strict` | Comparacion de PNG byte a byte (implica `--check`) |

API: `renderVideo(options)` (con `format`, `scene`, `assets` y `allowMissingFonts`) devuelve `{out, frames, seconds, renderedSegments, cachedSegments}`; `checkVideo(options)` devuelve `{ok, ...}`, `listScenes(options)` y `listVideos()` (todos en `render/render.ts`).

## Como funciona

1. Compila el runtime con vite en `.ve-cache/bundles/<hash de las fuentes>/` (se reutiliza si nada cambio; el hash incluye `package-lock.json`, `tsconfig.json`, `vite.config.ts` y todo el proyecto salvo `node_modules`, `dist`, `out`, `render`, `docs`, `*.md` y lo que empieza con punto; **incluye `videos/`**, aunque no esté en git; con `VE_VIDEOS_DIR` el `videos/` real ni se compila ni entra en el hash y en su lugar va esa carpeta). El directorio nunca se modifica una vez creado, asi que dos renders simultaneos (o `npm run build`) no se pisan. Lo sirve en un puerto libre.
2. Una pagina dedicada llama `__ve.scanAudio()` una sola vez, y todos los archivos de audio se resuelven ANTES de renderizar (si falta uno, falla de inmediato).
3. Los cuadros pendientes se reparten en tramos contiguos entre N paginas; cada una espera `__ve.ready` y por cuadro hace `await __ve.setFrame(n)` + captura de `#stage` (CDP `Page.captureScreenshot`). Un rechazo de `setFrame` o un error de pagina aborta con el mensaje.
4. En cuanto una parte tiene todos sus cuadros se codifica a `.ve-cache/seg-<clave>.mp4` (H.264, yuv420p, fps constante) y se borran sus cuadros (uso de disco acotado; la codificacion se solapa con la captura). Al final se concatenan sin recodificar y en la misma pasada se mezcla el audio (`atrim`, `adelay`, `volume`, `amix`) con `+faststart`.
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

Clave de cada parte = hash de: huella del código **de ese video** (ver abajo; si no se puede calcular, el hash de todo el bundle), id, props, rango de cuadros, escala, crf, version de ffmpeg, version de Chromium, `VE_CHROMIUM`/`VE_CHROMIUM_ARGS`, fps, dimensiones y formato del video, ajustes del codificador (preset, bframes, pix_fmt), formato de captura y un resumen (ruta+tamano+mtime) de cada directorio `--assets`. Una segunda corrida sin cambios no renderiza nada. Las carpetas de estáticos (las de `--assets` y las que se sirven solas) entran por el resumen de sus archivos.

Las partes se alinean a multiplos de `--segment`. Con `--frames a-b` solo se comparten con un render completo las partes que quedan **enteras** dentro del rango; las de los bordes son parciales (su rango es distinto) y tienen su propia clave.

**Huella por video.** vite.config.ts emite `ve-deps.json` en el bundle: los fuentes que usa el runtime y los que alcanza cada carpeta de video siguiendo imports estáticos, imports dinámicos con literal, `import.meta.glob` y los recursos `new URL('./x.png', import.meta.url)` con literal, estén o no dentro de la carpeta del video. Si un video (o el runtime) usa algo que no se puede seguir (`new URL(variable, import.meta.url)`, `import(variable)`), el video queda en `opaque` y su huella pasa a ser el hash de todo el bundle: ante la duda, se invalida todo, nunca se reutiliza una parte vieja. La huella de un video (`videoCodeHash`) mezcla esos fuentes, todos los archivos de la carpeta del video, `public/` entero, `package-lock.json`, `tsconfig.json`, `vite.config.ts` y `engine/runtime/index.html`. Editar `videos/a/` ya no invalida las partes de `videos/b/` ni las de los ejemplos; tocar el motor, el kit, el tema o `public/` sí invalida las de los videos que los usan (los barriles `engine/index.ts` y `kit/index.ts` arrastran todo su contenido, así que en la práctica es casi todo). Supuesto: un video no depende del código de otro video; los módulos de los otros videos se cargan en la página pero solo registran su `defineVideo`.

**Por escena: no se hace.** Una escena es una función de React: el motor no sabe de qué archivos depende ni en qué carpeta vive, y los segmentos cruzan los límites entre escenas (una vuelta al listado depende de todas las anteriores y de la línea de tiempo). Una clave por carpeta de escena daría cachés viejas sin avisar cuando la escena usa código compartido; por eso la granularidad es el video. Para iterar sobre una escena se renderiza sola con `--scene`, que solo toca sus partes. `.ve-cache/` (partes y bundles) no se limpia solo: borrarlo a mano si crece.

## Videos rotos, ids repetidos y compilación

Un video en construcción no tiene que dejar inservibles a los demás:

- **Error al cargar (en ejecución):** una carpeta que lanza al cargarse, o un `id` repetido, se anota por carpeta y el runtime sigue con el resto. `render <id>`, `qa`, `sheet` (todos pasan por el mismo runtime) fallan solo si `<id>` es uno de los comprometidos (id repetido: el error nombra las dos carpetas) o si no existe (y entonces el error lista las carpetas que no cargaron). Al renderizar otro video se imprime un `aviso:` con la primera línea de cada error ajeno. `render --list` lista todo lo que cargó y después los errores.
- **Error de compilación (sintaxis, import que no existe):** vite no puede compilar esa carpeta; `ensureBundle` detecta el archivo del error, lo reemplaza por un módulo que lanza ese mensaje al cargarse y vuelve a compilar (hasta 8 veces). El resultado es el caso anterior: solo falla el video afectado. No hay chequeo de tipos en el bundle (`tsc` es aparte).

## Pruebas independientes de `videos/`

Las pruebas que necesitan videos propios usan `withTempVideos` (`render/testing.ts`): una carpeta temporal bajo `out/` (con `writeVideoFiles` para escribir sus archivos) con `VE_VIDEOS_DIR` apuntando ahí. El `videos/` real queda fuera del bundle y del hash (no importa si hay un video en construcción con errores de tipos, y las carpetas temporales no se filtran a otros bundles). Los videos temporales importan el motor con ruta absoluta (`engineDir`). `stories/nuevo-sh.test.ts` arma un proyecto mínimo temporal (enlaces a `engine/`, `kit/`..., copia de `templates/`) y hace el typecheck solo de lo generado con un `tsconfig` propio. `withVideosDir` (cerrojo sobre el `videos/` real) queda para quien de verdad lo necesite; el cerrojo guarda el pid y se rompe solo si su dueño murió o tiene más de 15 minutos.

## Videos fuera del repo (`VE_VIDEOS_DIR`)

`VE_VIDEOS_DIR=/ruta/absoluta/mis-videos npm run render -- --list` (también render, `--check`, `qa`, `sheet`, `privacy` y `npm run dev`) carga los videos de esa carpeta (`<slug>/index.ts(x)` y `<slug>/<carpeta>/index.ts(x)`; se ignoran las carpetas que empiezan con punto) **además de los ejemplos**, y los muestra como `videos/<slug>`. Sirve para dejar los videos fuera del repo y para pruebas con videos temporales. Si la ruta no existe o no es una carpeta, el CLI falla con un mensaje en español (no lista vacío). Una carpeta sin videos es válida y no da error.

Causa del listado vacío que había: `import.meta.glob` de vite con una ruta relativa que sale del proyecto (`../../../../tmp/...`) devuelve un mapa vacío, y se llevaba también los ejemplos. Ahora `vite.config.ts` saca los patrones de `videos/` y agrega imports dinámicos con ruta absoluta de lo que encuentra en la carpeta (se escanea al compilar; al agregar una carpeta nueva el hash del bundle cambia solo).

**Armar la carpeta.** `VE_VIDEOS_DIR=/ruta/mis-videos bash templates/nuevo.sh escena <slug> <nombre>` escribe ahí (en vez de en `videos/`) con los imports por alias (`video-estudio/engine`, ...) y crea `tsconfig.json` y `env.d.ts` si faltan (`... nuevo.sh externo` solo prepara esos dos). Los modelos están en `templates/externo/` (`tsconfig.json` con `paths` a este clon, sin `baseUrl` porque TypeScript 7 lo rechaza; `types: []` porque `vite/client` no se resuelve desde afuera; `env.d.ts` declara `*?url`, `*?raw`, imágenes, fuentes y audio; `react` y `react-dom` se resuelven a los tipos del clon). `npm run typecheck` revisa también esa carpeta cuando `VE_VIDEOS_DIR` está definida; `npm run typecheck:videos` la exige. `templates/tema-informe.ts` lee el tema de `<VE_VIDEOS_DIR>/<slug>/theme.ts` (o de una ruta a un `.ts`) con el mismo vite del proyecto, así que resuelve el alias y tolera los imports `?url`.

Cómo importar el motor desde un video de afuera: con el alias `video-estudio/<carpeta>`, que apunta a la carpeta del repo.

```ts
import React from "react";                                  // un solo React: el del repo (resolve.dedupe)
import { defineVideo, useFrame } from "video-estudio/engine";
import { ThemeProvider, neutral } from "video-estudio/themes";
import { Stage } from "video-estudio/kit";
import { Typewriter } from "video-estudio/fx";               // y "video-estudio/fx/three"
```

También sirve la ruta absoluta al repo (`/clon/engine`). Los imports relativos entre archivos del propio video funcionan igual. El render no necesita el `tsconfig.json`; es para el editor y `tsc`. Los archivos de la carpeta entran en el hash del bundle como los de `videos/`.

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

Lo mismo en `qa`, `sheet` y `privacy` (todos dibujan con el mismo runtime). Para un borrador: `--allow-missing-fonts` (o `VE_ALLOW_MISSING_FONTS=1`), que solo avisa por consola. La prueba usa un video temporal con una URL que da 404 (`render/fuentes.test.ts`, con `withTempVideos`/`writeVideoFiles` de `render/testing.ts`).

## Velocidad de render: dónde se va el tiempo

El costo es de CPU en Chromium, no de codificación ni de disco. `render` imprime, además del total, `tiempo por etapa`: dibujar el cuadro (React + esperas: segundos), captura de pantalla (la rasterización y composición del cuadro ocurren acá, es casi todo) y escritura del PNG; x264 se solapa con la captura y pesa ~10 %. Medido en este entorno (4 núcleos compartidos, 1920x1080, `--no-cache --no-audio`, 60 cuadros por muestra):

| Muestra | CPU por cuadro | Notas |
|---|---|---|
| `hello` (escena sencilla) | ~0.07 s | |
| `story-demo`, apertura / temas | 0.18 a 0.24 s | 3D, desenfoques, mucho DOM |
| `story-demo --scale 0.5` | ~0.09 s | la rasterización crece con los píxeles |
| `--frame-format jpeg` | casi igual | cambia la codificación, no la rasterización |
| `--disable-gpu`, `--disable-gpu-compositing`, `--num-raster-threads`, GPU raster | sin mejora (mismo CPU) | además cambiarían la clave de cache |

Render completo de `story-demo` (1590 cuadros, 53 s, 1920x1080, con 3D y desenfoques, `--no-cache`) medido mientras la máquina estaba ocupada por otras tareas (promedio de carga 8 sobre 4 núcleos): **7.6 min de reloj, 4 min de CPU** (5.4 fps al principio, 4 fps al final), con 4 páginas: dibujar los cuadros 233 s, captura 1390 s, escritura 24 s (sumas entre las 4 páginas). Con la máquina libre, esos 4 min de CPU son ~1 a 1.5 min de reloj.

**Regla práctica:** tiempo de un render completo ≈ `cuadros × (0.07 a 0.25 s de CPU) / núcleos libres` más ~15 s fijos (compilar el bundle la primera vez, abrir las páginas, concatenar). `--concurrency` solo ayuda hasta la cantidad de núcleos libres: con más páginas que núcleos todo se enlentece. Un video de 60 s (1800 cuadros) con 3D y desenfoques son ~4 a 6 min de CPU: ~1.5 a 2 min con 4 núcleos libres, 5 a 8 min si la máquina está ocupada o tiene 1 o 2 núcleos (ahí se ven 4 a 6 cuadros por segundo, que es lo que se reportó con 5.5 min). El `--scale 0.5` para borradores es el atajo que más rinde (~2x). No se encontró un ajuste seguro que acelere más sin cambiar píxeles.

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
