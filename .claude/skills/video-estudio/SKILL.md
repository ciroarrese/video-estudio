---
name: video-estudio
description: "Produce videos animados (presentación, demo, explicador, recorrido de herramientas) con el motor de este repo, paso a paso y con aprobación de la persona en cada etapa. Usar cuando piden crear, armar, producir o animar un video, un video de presentación o de demo, o agregar, editar o corregir una escena de un video. Frases típicas: haceme un video, quiero un video de, agregá una escena, cambiá la escena 3."
---

# video-estudio

Producís videos animados con el motor de este repo (cada video es una función pura del número de cuadro; Chromium captura, ffmpeg arma el MP4). **Nunca lo hacés de una sola pasada**: trabajás por etapas y, al final de cada una, te detenés y esperás la respuesta de la persona. Sin "aprobado" explícito no pasás a la siguiente.

Antes de empezar leé `CLAUDE.md`, `docs/reglas.md`, `docs/guia-escenas.md` (con su sección "Para que no parezca un borrador"), `docs/audio.md` si el video lleva sonido, y mirá el catálogo de efectos `docs/animaciones.md`. Todo lo que escribas para la persona va en español rioplatense (voseo, sin emojis). El repo es público: nada de nombres de empresas, clientes o personas reales en lo que quede versionado.

## Orden de las etapas (no se saltea)

Cada etapa empieza con una lista de lo que **tiene que existir** antes de arrancarla. Si falta algo, volvé a la etapa que lo produce; no lo escribas "después".

| Etapa | Tiene que existir antes de empezar |
|---|---|
| 1 fichas | respuestas del cuestionario confirmadas, `videos/<slug>/` y `prohibidos.txt` |
| 2 tema | fichas aprobadas |
| 3 guion | tema aprobado |
| 4 escenas | `guion.md` **aprobado** con la columna de cuadros y la línea de presupuesto |
| 5 armado | todas las escenas aprobadas una por una |

## Dónde va cada cosa

```
videos/<slug>/
  fichas/<tema>.md      etapa 1
  theme.ts              etapa 2 (exporta `theme` y `report`)
  guion.md              etapa 3
  prohibidos.txt        lista de términos que no pueden aparecer (etapa 0)
  <escena>/Scene.tsx    etapa 4, una carpeta por escena (index.ts la registra como video propio)
  historia/             etapa 5 (spec.ts + index.ts con defineStory)
  tempo.json, cues.json, audio/   etapa 5, solo si lleva sonido (docs/audio.md)
public/                 imágenes, logos, fuentes y música con licencia (se referencian con asset())
out/                    MP4, hojas de cuadros e informes (no se versiona)
```

`<slug>`: minúsculas, números y guiones. `videos/` **no existe en un clon nuevo**: la crea el script de plantillas (`templates/nuevo.sh`) o la etapa 0 con `mkdir -p`. Si la persona pide cosas que no puede mostrar un repo público (datos reales, marcas, capturas), `videos/` no se sube: avisale y no hagas commit de esa carpeta.

**Registrar un video**: no hay que registrar nada. El runtime descubre solo toda carpeta `videos/<slug>/index.ts(x)` y `videos/<slug>/<carpeta>/index.ts(x)` (y `examples/*`); el render, la hoja de cuadros y el QA buscan el video por `id`. `npm run render -- --list` muestra lo que ve (con tamaños, formatos y carpeta). No se edita `engine/runtime/videos.ts`. Un `id` repetido entre dos carpetas falla con un error que nombra las dos: cambiá uno.

Plantillas: `bash templates/nuevo.sh escena <slug> <nombre>` y `bash templates/nuevo.sh historia <slug> <escena>` crean los archivos con los imports ya corregidos (y `videos/<slug>/theme.ts` si falta); ya quedan descubiertos.

**Formatos y escenas sueltas**: el formato base (16:9) siempre existe; cada formato extra que pida la persona se habilita con `formats: ["vertical"]` (o `"cuadrado"`) en el `defineVideo` o en el `defineStory` (ver `stories/README.md` para el valor por defecto) y **hay que diseñar la disposición de cada escena para ese formato** con `useFormat()` (`pick({ horizontal, vertical, cuadrado })`, ver `docs/guia-escenas.md` sección 11 y `templates/scene/Scene.tsx`). Se mira con `--format vertical|cuadrado` en `render`, `qa` y `sheet` (la hoja de un formato distinto del base se llama `out/<id>-vertical-sheet.png`), y `--check` y `qa` se corren en cada formato. Para revisar o renderizar una escena sola: `--list-scenes` y `--scene <id|índice>` (en una historia, cada tema es una escena).

## Comandos

Todos corren desde la raíz del repo. Los `<id>` son ids de video registrados.

| Para qué | Comando |
|---|---|
| Tipos | `npm run typecheck` |
| Pruebas del repo | `npm test` |
| Determinismo | `npm run render -- <id> --check` |
| Control de calidad | `npm run qa -- <id> --count 40` (`--frames 0,60,120`, `--every N`, `--fail-on warn`, `--json out/qa.json`) |
| Privacidad | `npm run privacy -- <id> --deny videos/<slug>/prohibidos.txt --scan-source videos/<slug>` (`--allow permitidos.txt`) |
| Hoja de cuadros | `npm run sheet -- <id> --count 12` (genera `out/<id>-sheet.png`; con `--format vertical`, `out/<id>-vertical-sheet.png`; `--frames`, `--cols`, `--scale`) |
| Tempo de una pista | `npm run audio -- tempo <pista> --fps 30 --out videos/<slug>/tempo.json` |
| Pista al compás | `npm run audio -- empalme <pista> --frames N --fps 30 --inicio percusion --tempo videos/<slug>/tempo.json --out videos/<slug>/audio/musica.wav` |
| Efectos de sonido | `npm run audio -- efectos --out videos/<slug>/audio/sfx` |
| Mezcla de sonido | `npm run audio -- mezcla --cues videos/<slug>/cues.json --sfx videos/<slug>/audio/sfx --fps 30 --frames N --out videos/<slug>/audio/audio-<slug>.wav` |
| Informe del tema | `npx tsx templates/tema-informe.ts <slug>` |
| MP4 de borrador | `npm run render -- <id> --scale 0.5 --crf 23` (`out/<id>.mp4`) |
| MP4 final | `npm run render -- <id> --out out/<slug>.mp4` |
| Otros ajustes | `--frames a-b`, `--props '<json>'`, `--no-audio`, `--assets videos/<slug>/audio` (audio y estáticos fuera de `public/`; obligatorio si la mezcla vive ahí), `--no-cache`, `--concurrency N` |
| Vista en navegador | `npm run dev` y abrir `/?video=<id>` |

Requisitos: Node 22, ffmpeg y ffprobe en el PATH, Playwright con Chromium (`npx playwright install chromium`; otro ejecutable con `VE_CHROMIUM=/ruta`). Si falta algo, decile a la persona qué instalar; no inventes alternativas.

## Etapa 0: cuestionario

Hacé **todas las preguntas en un solo mensaje**, numeradas, con el valor por defecto de cada punto a la vista para que la persona pueda contestar "todo por defecto". Si algo ya está dicho en el pedido, no lo repitas: confirmalo.

1. Objetivo y público: ¿para qué es el video y quién lo mira? (sin default: es lo único obligatorio)
2. Duración y formato(s): horizontal 16:9, vertical 9:16, cuadrado, o varios. Por defecto: 60 a 90 s, solo 16:9, 1920×1080, 30 fps. Avisá que cada formato extra implica diseñar la disposición de cada escena para ese formato (`useFormat().pick`) y revisar una hoja por formato: suma trabajo en cada escena.
3. Temas o proyectos que entran (2 a 6 en una historia) y de dónde sale la información de cada uno (documentos, repos, notas, lo que cuente la persona).
4. Material visual disponible: capturas, código, accesos, design system o tokens (archivo CSS/JSON). Por defecto: tema neutro y herramientas recreadas con primitivas del tema, sin capturas.
5. Cifras: ¿reales o emuladas? ¿Qué no puede aparecer nunca (nombres, clientes, correos, dominios, montos)? Por defecto: cifras emuladas, nombres ficticios.
6. Texto en pantalla: solo titulares / titulares y rótulos / subtítulos / nada. Por defecto: titulares y rótulos, sin subtítulos.
7. Música y efectos de sonido: ¿con música, con efectos (clic, tilde, aviso, barrido...), con ambos o mudo? Si hay música, ¿de quién es y qué licencia tiene? Por defecto: efectos propios sintetizados (`docs/audio.md`), sin música, y se agregan cuando se aprueba el video mudo.
8. Dónde se va a mostrar (reunión interna, web pública, redes, evento): define licencias de fuentes, música y marcas, y el peso del archivo. Por defecto: reunión interna.

Con las respuestas:
- Elegí el `<slug>` y creá `videos/<slug>/` (`mkdir -p`: en un clon nuevo `videos/` no existe).
- Armá `videos/<slug>/prohibidos.txt` con todo lo que la persona dijo que no puede salir (un término o `/regex/flags` por línea, `#` comenta; ignora mayúsculas y acentos). Agregá siempre los nombres reales de los clientes, personas y sistemas que mencionó.
- Resumí las decisiones en 5 líneas y pedí confirmación.

**Alto: esperá la respuesta de la persona.**

## Etapa 1: fichas

Antes de empezar: cuestionario respondido, `videos/<slug>/` y `prohibidos.txt`.

Una ficha por tema en `videos/<slug>/fichas/<tema>.md`, corta (máximo 15 líneas):

```md
# <Nombre del tema>
- Qué es: una frase.
- Qué permite hacer: una o dos frases, en términos de lo que cambia para quien lo usa.
- Mensaje en una línea: lo que tiene que quedar en la cabeza (es el `line` del tema en la historia).
- Fuente: de dónde sale la información.
- Ideas visuales: 2 o 3 (qué interfaz se recrea, qué acción se muestra, qué cifra emulada).
- Cuidado: lo que no puede aparecer.
```

Si la información de un tema no alcanza para una ficha, preguntá en vez de inventar. Mostrá las fichas (resumidas) en el chat.

**Alto: esperá aprobación o correcciones.**

## Etapa 2: tema

Antes de empezar: fichas aprobadas.

1. Con los tokens de la persona (archivo CSS con variables o JSON), escribí `videos/<slug>/theme.ts` con `themeFromTokensWithReport` (ver `themes/README.md`). Debe exportar `theme` y `report`:

   ```ts
   import { themeFromTokensWithReport } from "../../themes";
   // Los tokens van copiados como texto CSS (o un objeto JSON) dentro del archivo: así lo leen vite y tsx.
   const tokens = `:root { --color-primary: #e11d48; --color-background: #ffffff; --color-foreground: #111111; }`;
   const r = themeFromTokensWithReport(tokens);
   export const theme = r.theme;
   export const report = r.report;
   ```

   Si no hay tokens, usá `neutral` (o `dark` si la herramienta que se recrea es oscura) y decilo. No inventes marcas ni colores corporativos.
2. Corré `npx tsx templates/tema-informe.ts <slug>` y mostrá: roles tomados de los tokens, roles que quedaron con el valor base (`fallback`), avisos y fallas de contraste. Para cada falla proponé el arreglo (oscurecer el color de texto, cambiar el acento) y no lo apliques sin que la persona lo apruebe.
3. Fuentes: si la persona trae archivos, van en `public/` y se declaran en `theme.font.files`; confirmá su licencia para el lugar de exhibición (etapa 0, punto 8).

**Alto: esperá aprobación del tema.**

## Etapa 3: guion

Antes de empezar: tema aprobado. **El guion se escribe y se aprueba antes de construir cualquier escena**; si ya hay escenas sin guion, parás y lo escribís primero.

Escribí `videos/<slug>/guion.md`: una tabla por escena (apertura y cierre incluidos si usa historia). Cuadros a 30 fps; la columna de tiempo lleva segundos y cuadros, y hay una columna de duración en cuadros por escena.

**Presupuesto de cuadros.** Una historia con `n` temas dura `apertura + Σ temas + n × vuelta al listado + cierre`. Los valores por defecto (apertura 300, vuelta 120, cierre 480) ya suman 780 + 120n cuadros antes de contar los temas: un video corto es imposible sin `timing: { opening, interlude, closing }` en el `spec` (mínimo 60 cuadros cada uno; ver `stories/README.md`). Ejemplo de 25 s (750 cuadros) con 3 temas: apertura 75 + 3 × (tema 135 + vuelta 60) + cierre 90 = 750. Despejá los temas de la fórmula y poné la cuenta en la primera línea del guion. Con el código a mano: `storyBudget(spec, scenes)` y `formatStoryBudget(...)` de `stories/` devuelven el total y el mínimo posible. La apertura tiene que durar al menos unos 4 s (120 cuadros) para que el título se lea: si el total no alcanza, sacá un tema o agrandá el video; no comprimas la apertura.

```md
# <Video>: guion (<N> cuadros a 30 fps; <formatos>)
Presupuesto: apertura 120 + 3 x (tema 150 + vuelta al listado 60) + cierre 120 = 870.

## Escena 2: <tema>
| Duración en cuadros | Tiempo | Qué se ve | Efecto | Texto en pantalla | Fuente |
|---|---|---|---|---|---|
| 30 | 0:00-0:01 (0-30) | Vista general del panel, tarjetas que entran | Entrada escalonada | Titular "<tema>" | Ficha |
| 30 | 0:01-0:02 (30-60) | Acercamiento a la tarjeta 2 | Zoom rápido, titular se aparta | - | Ficha |
| 30 | 0:02-0:03 (60-90) | Clic y garabato sobre la tarjeta | Cursor, onda de clic, círculo | - | Ficha |
| 38 | 0:04-0:05 (112-150) | Atraviesa el panel hacia la escena siguiente | zoomThrough + velo | - | - |
Total de la escena: 150 cuadros (5 s).
```

En la columna "Efecto" nombrá el efecto del catálogo (`docs/animaciones.md`, por ejemplo `MaskedRise`, `BarsGrow`, `DotWipe`) o el recurso del kit (`zoomThrough`, `Cursor`) de cada momento; solo si ninguno sirve, escribí "a medida". Aplicá las reglas de `docs/reglas.md` desde el guion (acción clave con zoom rápido, flujos con dirección, cada escena termina atravesando un elemento, entre temas vuelta al listado). Sumá los cuadros y comprobá que la duración total cuadre con lo pedido. Agregá al final una línea con las cifras emuladas elegidas.

Si usa sonido, sumá una tabla de momentos (cuadro, efecto: `clic`, `tilde`, `aviso`, `barrido`, `campanita`, `golpe`) que después se vuelve `cues.json`. Si hay varios formatos, anotá qué cambia de disposición en cada uno.

**Alto: sin guion aprobado no se construye ninguna escena.**

## Etapa 4: escenas, de a una

Antes de empezar: `guion.md` aprobado (con presupuesto de cuadros) y el tema aprobado. Cada escena nueva empieza cuando la anterior está aprobada.

Para cada escena del guion, en orden:

1. **Elegí efectos del catálogo antes de escribir desde cero:** abrí `docs/animaciones.md` (sección "Cómo elegir") y usá los efectos de `fx/` que ya existen para cada momento del guion; combinalos con cámara, cursor y garabatos del kit (`docs/guia-escenas.md`, sección 9). Podés ver cualquiera con `npm run dev` y `/?video=fx-text`, `fx-3d` o `fx-data-ui-art`.
2. `bash templates/nuevo.sh escena <slug> <escena>` (no hay que registrarla). Construí la escena con piezas del kit siguiendo `docs/guia-escenas.md`: coordenadas del mundo, cámara con cuadros clave, todo del tema, interfaces recreadas con su estructura y rótulos, nunca capturas. La plantilla ya trae una disposición horizontal y otra vertical con `useFormat().pick`; para cada formato extra del guion, diseñá la disposición (no achiques la horizontal). Si va en una historia, el contenido es `SceneBody` (sin `Stage`) y el titular va con `DockedHeadline` y una prop `title` (como en la plantilla), que funciona tanto sola como dentro de la historia; `TopicHeadline` lee el tema de la historia y lanza un error si la escena se renderiza sola. La escena exporta su `DURACION` y se prueba sola antes de entrar a la historia.
3. **Antes de mostrar nada**, corré en este orden y corregí lo que salga hasta que quede limpio:
   ```bash
   npm run typecheck
   npm run render -- <slug>-<escena> --check
   npm run qa -- <slug>-<escena> --count 40
   npm run privacy -- <slug>-<escena> --deny videos/<slug>/prohibidos.txt --scan-source videos/<slug>
   ```
   Los avisos de `qa` que sean a propósito (transiciones) se explican; solo se silencian con `data-qa-ignore="regla"` si lo decidiste a propósito y lo decís.
4. Hoja de cuadros: `npm run sheet -- <slug>-<escena> --count 12` (una por formato: `--format vertical` escribe `out/<slug>-<escena>-vertical-sheet.png`). **Mirala como un espectador** (abrí la imagen con Read) y corregí lo que veas mal: titular tapando contenido, vacío arriba en la vista general, cosas fuera de cuadro, interfaces vacías o cargando, el sujeto chico en el cuadro vertical. Repasá `docs/guia-escenas.md`, sección "Para que no parezca un borrador".
5. MP4 de esa escena sola: `npm run render -- <slug>-<escena> --scale 0.5 --crf 23`. Entregá a la persona la ruta del MP4 y de la hoja, más un resumen de lo que hace cada tramo y de lo que QA y privacidad dijeron (aunque sea "limpio").

**Alto: esperá aprobación de la escena.** Aplicá las correcciones, repetí el punto 3 y mostrá de nuevo (solo lo que cambió). Recién con "aprobada" pasás a la escena siguiente.

## Etapa 5: armado

Antes de empezar: todas las escenas aprobadas, cada una con `--check`, `qa` y `privacy` en limpio.

1. Si hay varios temas: completá `bash templates/nuevo.sh historia <slug> <escena>`, reemplazá las escenas de ejemplo por las reales (en el mismo orden que `spec.topics`) y completá `spec.ts` con lo de las fichas (de 2 a 6 temas). `defineStory` agrega apertura, vueltas al listado y cierre. Con un solo tema o escena suelta, el video final es esa escena.
2. Sonido (solo si se pidió; detalle en `docs/audio.md`), con el video mudo ya aprobado:
   - **Efectos**: `npm run audio -- efectos --out videos/<slug>/audio/sfx`.
   - **Cues**: `videos/<slug>/cues.json` con `[{"frame": 45, "sfx": "clic"}, ...]`; cada cuadro sale del guion (clic = cuadro del clic, tilde cuando se tilda, barrido en el atravesado). Los cuadros se miden en el tiempo del video, sumando el desplazamiento de cada escena en la historia (`timeline` de `composeStory`).
   - **Música** (opcional): `tempo` y `empalme` para que arranque en la percusión y caiga en el compás; confirmá su licencia para el lugar de exhibición. Nunca va al repo.
   - **Mezcla**: `npm run audio -- mezcla --cues videos/<slug>/cues.json --sfx videos/<slug>/audio/sfx --fps 30 --frames <total> --out videos/<slug>/audio/audio-<slug>.wav` (más `--musica` si hay). La salida va a `videos/<slug>/audio/`, nunca a `public/`.
   - **En el video**: `defineStory({ ..., audio: { src: "audio-<slug>.wav" } })` (o `<Audio src={asset("audio-<slug>.wav")} />` en una escena suelta) y se renderiza con `--assets videos/<slug>/audio`. La vista del navegador no reproduce audio: se oye en el MP4.
3. Verificación completa sobre el video final, sin saltear nada:
   ```bash
   npm run typecheck && npm test
   npm run render -- <slug> --check          # y con --format vertical (o cuadrado) si el video los admite
   npm run qa -- <slug> --count 60
   npm run privacy -- <slug> --deny videos/<slug>/prohibidos.txt --scan-source videos/<slug> --every 15
   npm run sheet -- <slug> --count 16        # una hoja por formato
   ```
4. Render final: `npm run render -- <slug> --out out/<slug>.mp4` (con `--assets videos/<slug>/audio` si hay sonido; con `--format vertical --out out/<slug>-vertical.mp4` para cada formato extra). Mostrá las rutas, la duración y el peso de cada archivo.
5. Actualizá `videos/<slug>/guion.md` para que coincida con lo producido (tiempos reales, textos finales, cifras emuladas usadas).
6. Cerrá con: ruta del MP4, ruta del guion, pendientes de licencia (fuentes, música, marcas) y qué hacer para volver a renderizar.

**Alto: esperá la aprobación final** o los pedidos de cambio (vuelven a la etapa que corresponda).

## Cambios sobre un video existente

Si piden agregar, editar o corregir una escena: leé su carpeta y el guion, proponé el cambio en una línea, hacelo, corré el punto 3 de la etapa 4, mostrá hoja y MP4 de esa escena, y actualizá `guion.md`. El render por partes reutiliza lo que no cambió.

## Si algo falla

- `useTopic: solo se puede usar dentro de una escena armada con composeStory` (o `TopicHeadline` que lanza al renderizar una escena sola): usá `DockedHeadline` con `title` por prop, como en `templates/scene/Scene.tsx`.
- `privacy` imprime resultados de más o falla leyendo la lista: el comando documentado (`--deny videos/<slug>/prohibidos.txt --scan-source videos/<slug>`) ya omite los archivos de `--deny` y `--allow` del escaneo; `prohibidos.txt` vive en `videos/<slug>/`.

- `setFrame(n) fallo: ... holds pendientes` (timeout de 30 s): una fuente o imagen no carga. Revisá que el archivo exista en `public/` y que `theme.font.files`/`asset()` apunten bien.
- `--check` falla: seguí `docs/reglas.md`, sección **"Qué hacer cuando --check falla"** (leer el bbox y los elementos que imprime, bisecar sacando piezas, causas habituales y arreglos). Si además `checkDeterminism` da `ok: false`, la escena depende del historial. Buscá `useState`/`useRef` que acumulan, `Date.now()`, `Math.random()` (usá `random(seed)`), animaciones CSS, `setTimeout`. `--check` es tolerante con el ruido chico (ningún píxel con diferencia mayor que 2, hasta 0,1 % de píxeles con diferencia 2 y hasta 20 % con diferencia 1, o sea desenfoque y sombras); un cambio real no pasa (`--check-strict` compara byte a byte). Revisá también `useId`, `scale()` sobre texto, `perspective`/`preserve-3d` en un ancestro y posiciones fraccionarias (riesgos conocidos, no prohibiciones: valen si `--check` da limpio): la lista completa está en `docs/reglas.md`.
- `No se pudo cargar "playwright"` / `No se pudo lanzar Chromium`: `npm i -D playwright` y `npx playwright install chromium`, o `VE_CHROMIUM=/ruta/a/chrome`.
- ffmpeg o ffprobe no encontrado: instalalo y comprobá con `ffmpeg -version`.
- `Audio file ... not found`: poné el archivo en `public/` o pasá `--assets <dir>`.
- No encuentra el video (`id` desconocido): corré `npm run render -- --list` y fijate si aparece; la carpeta tiene que tener `index.ts(x)` con un `defineVideo` y estar en `videos/<slug>/` o `videos/<slug>/<carpeta>/`. Dos videos con el mismo `id` fallan con un error que nombra las dos carpetas.
- Salió algo viejo: `--no-cache` o borrá `.ve-cache/`.
- `cameraAt`/`kf`/`interpolate` lanzan error: los cuadros clave tienen que ser estrictamente crecientes.
- El caché de partes es por video: editar tu video re-renderiza sus partes (y las de los videos que comparten el código que tocaste), no las de los demás. Un render completo después de editar es normal.
