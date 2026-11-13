# render

Convierte un video registrado en un MP4: Chromium captura cada cuadro con `__ve.setFrame(n)` y ffmpeg codifica y mezcla el audio.

## Uso

```bash
npm run render -- hello                       # out/hello.mp4
npm run render -- hello --out out/a.mp4 --props '{"title":"Hola"}'
npm run render -- hello --frames 30-59 --scale 0.5 --crf 23
npm run render -- audio-check --assets ./mis-audios
npm run render -- hello --check               # verifica determinismo
```

Tambien `npx ve-render <id> ...`. **La herramienta se ejecuta desde un clon de este repositorio**: el bin carga el TypeScript con `tsx` y compila el runtime con `vite`, ambos devDependencies (instalados con `npm install` en el clon). No esta pensada para instalarse como paquete suelto; se eligio esto para no ensanchar las dependencias de ejecucion del motor (solo React).

## Opciones

| Opcion | Descripcion |
|---|---|
| `--out` | Archivo de salida (por defecto `out/<id>.mp4`) |
| `--props '<json>'` | Objeto JSON mezclado con `defaultProps` |
| `--frames a-b` | Solo ese rango (inclusive); el audio se recorta igual |
| `--concurrency N` | Paginas en paralelo (por defecto `min(cpus, 6)`) |
| `--scale N` | Escala de salida (`0.5`, `2`...); dimensiones pares garantizadas |
| `--crf N` | Calidad H.264 (por defecto 18) |
| `--segment N` | Cuadros por parte (por defecto 150) |
| `--no-audio` | Sin audio |
| `--no-cache` | Vuelve a renderizar todas las partes |
| `--keep-frames` | Deja los cuadros en `<carpeta de salida>/<id>-frames/` |
| `--frame-format png\|jpeg` | Captura sin perdida (por defecto) o JPEG (algo mas rapido, con perdida) |
| `--jpeg-quality N` | Calidad JPEG (por defecto 95) |
| `--assets <dir>` | Directorio extra de estaticos/audio (repetible, se busca primero) |
| `--check` | No codifica: verifica determinismo (sale con codigo 1 si falla). Tolerante por defecto |
| `--check-max-delta N` | Maxima diferencia por canal tolerada (por defecto 2) |
| `--check-max-ratio R` | Fraccion maxima de pixeles distintos (por defecto 0.001 = 0.1 %) |
| `--check-strict` | Comparacion de PNG byte a byte (implica `--check`) |

API: `renderVideo(options)` devuelve `{out, frames, seconds, renderedSegments, cachedSegments}`; `checkVideo(options)` devuelve `{ok, ...}` (ambos en `render/render.ts`).

## Como funciona

1. Compila el runtime con vite en `.ve-cache/bundles/<hash de las fuentes>/` (se reutiliza si nada cambio; el hash incluye `package-lock.json`, `tsconfig.json`, `vite.config.ts` y todo el proyecto salvo `node_modules`, `dist`, `out`, `render`, `docs` y `*.md`). El directorio nunca se modifica una vez creado, asi que dos renders simultaneos (o `npm run build`) no se pisan. Lo sirve en un puerto libre.
2. Una pagina dedicada llama `__ve.scanAudio()` una sola vez, y todos los archivos de audio se resuelven ANTES de renderizar (si falta uno, falla de inmediato).
3. Los cuadros pendientes se reparten en tramos contiguos entre N paginas; cada una espera `__ve.ready` y por cuadro hace `await __ve.setFrame(n)` + captura de `#stage` (CDP `Page.captureScreenshot`). Un rechazo de `setFrame` o un error de pagina aborta con el mensaje.
4. En cuanto una parte tiene todos sus cuadros se codifica a `.ve-cache/seg-<clave>.mp4` (H.264, yuv420p, fps constante) y se borran sus cuadros (uso de disco acotado; la codificacion se solapa con la captura). Al final se concatenan sin recodificar y en la misma pasada se mezcla el audio (`atrim`, `adelay`, `volume`, `amix`) con `+faststart`.
5. Todo lo temporal vive en `.ve-cache/tmp-<pid>-<id>/` y se borra al terminar, al fallar y con Ctrl-C / SIGTERM (el CLI cierra Chromium y limpia antes de salir con 130 / 143).

Chromium se lanza con `--disable-partial-raster` (entre otras banderas): sin ella, el rasterizado parcial reutiliza teselas del cuadro anterior y algunos cuadros salen con diferencias de 1 nivel segun el historial. Se puede agregar mas banderas con `VE_CHROMIUM_ARGS`.

## `--check`: que compara y por que es tolerante

Dos pruebas: (1) `__ve.checkDeterminism` sobre ~12 cuadros, **siempre estricto** (compara el DOM: si falla, la escena depende del historial); (2) esos cuadros se capturan dos veces en layouts de paginas distintos y se comparan los PNG.

La comparacion de PNG es tolerante por defecto porque Chromium rasteriza desenfoques, sombras e inclinaciones 3D con diferencias de ~1 nivel en unos pocos pixeles segun el historial de cuadros de la pagina; ese ruido es imperceptible y exigir igualdad byte a byte empujaba a quitar esos efectos. Un cuadro pasa si **delta maximo por canal <= 2** (de 0 a 255) **y pixeles distintos <= 0.1 %** del cuadro. Para cada cuadro con diferencias se imprime el delta maximo, la cantidad y proporcion de pixeles distintos y el rectangulo (bbox) que los contiene; los toleradas se marcan como "ruido tolerado". Un cambio real (un bloque de 40x40 con +30 niveles, o delta 3 en unos pocos pixeles) falla: ver `render/compare.test.ts`. `--check-strict` exige igualdad exacta. Los PNG se decodifican con un decodificador propio minimo (`render/png.ts`), sin dependencias.

`--disable-partial-raster` (ver arriba) ya elimina la mayor parte de ese ruido.

## Uso desde otras herramientas

`render/index.ts` exporta `renderVideo`, `checkVideo`, `ensureBundle(root, cacheDir, runId, log)` (bundle de vite en `<cacheDir>/bundles/<hash>`; devuelve el directorio), `newRunId()`, `defaultRoot`, `hashDir`, `serveStatic(roots, pageRoot)`, `launchChromium()`.

## Cache por partes

Clave de cada parte = hash de: hash del contenido del bundle, id, props, rango de cuadros, escala, crf, version de ffmpeg, version de Chromium, `VE_CHROMIUM`/`VE_CHROMIUM_ARGS`, fps y dimensiones del video, ajustes del codificador (preset, bframes, pix_fmt), formato de captura y un resumen (ruta+tamano+mtime) de cada directorio `--assets`. Una segunda corrida sin cambios no renderiza nada.

Las partes se alinean a multiplos de `--segment`. Con `--frames a-b` solo se comparten con un render completo las partes que quedan **enteras** dentro del rango; las de los bordes son parciales (su rango es distinto) y tienen su propia clave.

**Limitacion:** cualquier cambio en el bundle (cualquier archivo de `engine/`, `examples/`, `public/`...) invalida todas las partes. El hash por escena queda como trabajo futuro. `.ve-cache/` (partes y bundles) no se limpia solo: borrarlo a mano si crece.

## Requisitos

- Node >= 22, `ffmpeg`/`ffprobe` en el PATH.
- Playwright con Chromium (peerDependency opcional, no se instala solo). Para otro ejecutable: `VE_CHROMIUM=/ruta/a/chrome`.
- Los `src` de `Audio` se buscan en `--assets`, el bundle y `public/`.

## Problemas comunes

- `No se pudo cargar "playwright"`: instalalo o exporta `NODE_PATH` hacia una instalacion global.
- `No se pudo lanzar Chromium`: revisa `VE_CHROMIUM` o `playwright install chromium`.
- `Audio file ... not found`: poner el archivo en `public/` o pasar `--assets`.
- `setFrame(n) fallo: ... holds pendientes`: un recurso (fuente/imagen) no cargo en 30 s.
- `--check` falla: la escena depende del historial de cuadros (ver regla de determinismo en `engine/README.md`).
