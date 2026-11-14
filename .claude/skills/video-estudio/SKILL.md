---
name: video-estudio
description: "Produce videos animados (presentación, demo, explicador, recorrido de herramientas) con el motor de este repo, paso a paso y con aprobación de la persona en cada etapa. Usar cuando piden crear, armar, producir o animar un video, un video de presentación o de demo, o agregar, editar o corregir una escena de un video. Frases típicas: haceme un video, quiero un video de, agregá una escena, cambiá la escena 3."
---

# video-estudio

Producís videos animados con el motor de este repo (cada video es una función pura del número de cuadro; Chromium captura, ffmpeg arma el MP4). **Nunca lo hacés de una sola pasada**: trabajás por etapas y, al final de cada una, te detenés y esperás la respuesta de la persona. Sin "aprobado" explícito no pasás a la siguiente.

Antes de empezar leé `CLAUDE.md`, `docs/reglas.md`, `docs/guia-escenas.md` (con "Para que no parezca un borrador" y la sección 13, "Composición", con medidas por formato, el zoom máximo y una escena de datos completa), `docs/audio.md` si el video lleva sonido, y mirá el catálogo de efectos `docs/animaciones.md`. Las props exactas de las piezas del kit (`DockedHeadline` con `layout`, `FlyingCard`, `Cursor`, `DoodleCircle`, `DoodleArrow`, `Wash`, `ThemeScope`, `Vignette` con `color` y `strength`, `GradientText` con `loop`, `Stage` con `cloud`) y `flyInZ` están en la tabla de `kit/README.md`: no hace falta leer el código fuente. Todo lo que escribas para la persona va en español rioplatense (voseo, sin emojis). El repo es público: nada de nombres de empresas, clientes o personas reales en lo que quede versionado.

## Orden de las etapas (no se saltea)

Cada etapa empieza con una lista de lo que **tiene que existir** antes de arrancarla. Si falta algo, volvé a la etapa que lo produce; no lo escribas "después".

| Etapa | Tiene que existir antes de empezar |
|---|---|
| 1 fichas | respuestas del cuestionario confirmadas, `videos/<slug>/` y `prohibidos.txt` |
| 2 tema (design system) | fichas aprobadas |
| 3 guion | tema aprobado |
| 4 escenas | `guion.md` **aprobado** con la columna de cuadros y la línea de presupuesto |
| 5 armado | todas las escenas aprobadas una por una |

## Dónde va cada cosa

```
videos/<slug>/
  fichas/<tema>.md      etapa 1
  theme.ts              etapa 2 (exporta `theme`; `report` solo si salió de tokens)
  guion.md              etapa 3
  prohibidos.txt        lista de términos que no pueden aparecer (etapa 0)
  <escena>/Scene.tsx    etapa 4, una carpeta por escena (index.ts la registra como video propio)
  historia/             etapa 5 (spec.ts + index.ts con defineStory)
  assets/               fuentes, logos e imágenes propias del video (se sirven solas; `asset("ruta")` o `import ... ?url`)
  tempo.json, cues.json, audio/   etapa 5, solo si lleva sonido (docs/audio.md); `audio/` también se sirve sola
public/                 imágenes, logos y fuentes con licencia que usan varios videos (se referencian con asset())
out/                    MP4, hojas de cuadros e informes (no se versiona)
```

`<slug>`: minúsculas, números y guiones. `videos/` **puede existir o no**: en un clon nuevo no está, y la crea el script de plantillas (`templates/nuevo.sh`) o la etapa 0 con `mkdir -p`; no asumas que está ni que está vacía (`ls videos` antes de elegir el `<slug>`). Si la persona pide cosas que no puede mostrar un repo público (datos reales, marcas, capturas), `videos/` no se sube (está en `.gitignore`): avisale y no hagas commit de esa carpeta. **Material privado**: lo más seguro es dejarlo en una carpeta fuera del repo con `VE_VIDEOS_DIR=<carpeta>` (ver "Videos en una carpeta fuera del repo" más abajo); nunca en `examples/`, `public/` ni en otra carpeta versionada.

**Registrar un video**: no hay que registrar nada. El runtime descubre solo toda carpeta `videos/<slug>/index.ts(x)` y `videos/<slug>/<carpeta>/index.ts(x)` (y `examples/*`); el render, la hoja de cuadros y el QA buscan el video por `id`. `npm run render -- --list` muestra lo que ve (con tamaños, formatos y carpeta). No se edita `engine/runtime/videos.ts`. Un `id` repetido entre dos carpetas falla con un error que nombra las dos: cambiá uno. Un video roto (no compila, lanza al cargarse) no deja inservibles a los demás: solo falla el que tiene el problema, `--list` lo muestra al final y al renderizar otro sale un `aviso:` con la primera línea del error.

Plantillas: `bash templates/nuevo.sh escena <slug> <nombre>` y `bash templates/nuevo.sh historia <slug> <escena>` crean los archivos con los imports ya corregidos (y `videos/<slug>/theme.ts` si falta); ya quedan descubiertos.

**Formatos y escenas sueltas**: el formato base (16:9) siempre existe; cada formato extra que pida la persona se habilita a propósito con `formats: ["vertical"]` (o `"cuadrado"`) en el `defineVideo` o en el `defineStory` (sin `formats`, los dos publican solo el formato base; las plantillas ya traen `formats: ["vertical"]`: sacalo si el video es solo horizontal) y **hay que diseñar la disposición de cada escena para ese formato** con `useFormat()` (`pick({ horizontal, vertical, cuadrado })`, ver `docs/guia-escenas.md` sección 11 y `templates/scene/Scene.tsx`). Se mira con `--format vertical|cuadrado` en `render`, `qa` y `sheet` (la hoja de un formato distinto del base se llama `out/<id>-vertical-sheet.png`; ver "Salidas" más abajo), y `--check` y `qa` se corren en cada formato. Para revisar o renderizar una escena sola: `--list-scenes` y `--scene <id|índice>` (en una historia, cada tema es una escena). Los tamaños tienen que ser pares (H.264): `defineVideo` rechaza uno impar; con `--scale` que da impar, el render avisa y agrega una fila o columna negra.

## Comandos

Todos corren desde la raíz del repo. Los `<id>` son ids de video registrados.

| Para qué | Comando |
|---|---|
| Tipos | `npm run typecheck` (con `VE_VIDEOS_DIR` definida revisa también esa carpeta de afuera con su `tsconfig.json`; `npm run typecheck:videos` solo esa) |
| Pruebas del repo (solo si cambiás el toolkit, no para hacer un video) | `npm test` (rápidas, ~1 a 2 min); `npm run test:e2e` (lentas, ~10 min: `--check` por escena de varias historias) |
| Determinismo | `npm run render -- <id> --check` (con escenas con nombre mira 12 cuadros repartidos + 6 por escena, 3 cerca del inicio de cada una; `--frames a-b` lo limita al rango, `--check-count N`, `--check-per-scene N`, `--check-all`). En una historia, además, `--check --scene opening`, `--scene interlude-1` y `--scene closing` |
| Control de calidad | `npm run qa -- <id> --count 40` (`--frames 0,60,120`, `--every N`, `--fail-on warn`, `--json out/qa.json`; `--themes all` bajo los cinco design systems, `--font-fallback wide` y `--font-scale 1.25` de estrés, `--repeat 2` para comprobar que el control es reproducible; leé siempre la línea `juzgados`) |
| Privacidad | `npm run privacy -- <id> --deny videos/<slug>/prohibidos.txt --scan-source videos/<slug>` (`--allow permitidos.txt`) |
| Hoja de cuadros | `npm run sheet -- <id> --count 12` (sin `--format`: `out/<id>-sheet.png`; con `--format vertical`: `out/<id>-vertical-sheet.png`; `--frames`, `--cols`, `--scale`, `--out`) |
| Tempo de una pista | `npm run audio -- tempo <pista.wav> --fps 30 --out videos/<slug>/tempo.json` (`--fase medio` si los golpes caen a contratiempo; `--bpm`/`--offset` para forzarlo) |
| Pista al compás | `npm run audio -- empalme <pista.wav> --frames N --fps 30 --inicio percusion --tempo videos/<slug>/tempo.json --out videos/<slug>/audio/musica.wav --json videos/<slug>/audio/musica.json` (opciones: `--inicio seccion:<n>`, `--lazo-inicio`, `--lazo-fin`, `--corte-en 12.5,f450`, `--fade-in`, `--final real`, `--compas`; ver el audio más abajo) |
| Efectos de sonido | `npm run audio -- efectos --out videos/<slug>/audio/sfx` |
| Mezcla de sonido | `npm run audio -- mezcla --cues videos/<slug>/cues.json --sfx videos/<slug>/audio/sfx --fps 30 --frames N --out videos/<slug>/audio/audio-<slug>.wav` (con música: `--musica videos/<slug>/audio/musica.wav --musica-gain 0.5 --duck-db 5 --lufs -16 --techo -1`) |
| Informe del tema | `npx tsx templates/tema-informe.ts <slug>` |
| MP4 de borrador | `npm run render -- <id> --scale 0.5 --crf 23` (`out/<id>.mp4`) |
| MP4 final | `npm run render -- <id> --out out/<slug>.mp4` |
| Videos y escenas | `npm run render -- --list` (videos descubiertos y, al final, las carpetas que no cargaron), `npm run qa -- <id> --list-scenes` (escenas y, en una historia, el presupuesto de cuadros por bloque; también `sheet`; `render -- <id> --list-scenes` lista las escenas pero no el presupuesto) |
| Otros ajustes | `--frames a-b`, `--props '<json>'`, `--no-audio`, `--assets videos/<slug>/audio` (carpeta extra de estáticos; `videos/<slug>/assets`, `videos/<slug>/audio` y `<VE_VIDEOS_DIR>/assets` ya se sirven solas en `render`, `qa`, `sheet` y `privacy`), `--allow-missing-fonts` (borrador: una fuente que no carga avisa en vez de fallar), `--no-cache`, `--concurrency N`, `--keep-frames` (deja los cuadros en `out/<id>[-formato][-escena]-frames/`) |
| Vista en navegador | `npm run dev` y abrir `/?video=<id>` |

**Archivos del video (fuentes, logos, imágenes, audio).** Dos maneras, las dos válidas en `render`, `qa`, `sheet`, `privacy` y `npm run dev`: (1) `asset("fonts/Marca.otf")` busca en `--assets`, en `videos/<slug>/assets`, `videos/<slug>/audio`, `<VE_VIDEOS_DIR>/assets`, el bundle y `public/` (esas carpetas se sirven solas, sin pasar nada) y conviene para audio pesado; (2) `import f from "../assets/Marca.otf?url"` lo resuelve vite y el archivo viaja con el código. Una **fuente que no carga hace fallar el render** con un mensaje que nombra la familia, el peso y la URL (antes salía con otra tipografía sin avisar); solo para un borrador, `--allow-missing-fonts`.

**Salidas.** Cada comando escribe en `out/` (que no se versiona) con un nombre armado con el id, el formato y la escena: el MP4 es `out/<id>[-formato][-escena].mp4` y la hoja `out/<id>[-formato][-escena]-sheet.png`. Sin `--format` no hay sufijo de formato (`out/<id>-sheet.png`); con `--format vertical` sale `out/<id>-vertical-sheet.png`; con `--format horizontal` explícito también agrega el sufijo (`-horizontal-`), así que no lo mezcles con el otro. Para mandar el resultado a otra carpeta o nombre: `--out <ruta>` en `render` (MP4), en `sheet` (PNG) y en `audio` (los WAV y JSON); `qa` y `privacy` usan `--json <ruta>` para el informe. Con `--out` el nombre es el que escribís (no se agrega el sufijo de formato): si hacés dos formatos, ponele el sufijo vos.

**Comandos largos.** Un render completo tarda lo que cuestan los cuadros en CPU: unos 0.07 s por cuadro en una escena sencilla y 0.2 s o más con 3D, desenfoques y mucho DOM (a 1080p), repartidos entre los núcleos libres. Un video de 60 s (1800 cuadros) pesado son ~4 a 6 min de CPU: ~2 min con 4 núcleos libres y 5 a 8 min en una máquina ocupada o chica (medido: 53 s de `story-demo` en 7.6 min con la máquina cargada) (`render` imprime el `tiempo por etapa`; detalle en `render/README.md`, "Velocidad de render"). Lanzalos en segundo plano (`run_in_background`) o con un timeout de 10 minutos, y no los des por colgados antes: mientras tanto seguí con otra cosa (la hoja, el guion). El `--check`, el `qa` y la hoja de una escena sola, en cambio, tardan segundos. **Regla práctica**: tiempo ≈ `cuadros × (0.07 a 0.25 s de CPU) / núcleos libres` + ~15 s fijos; avisale a la persona de cuánto va a tardar antes de lanzar el render final. Los borradores salen en la mitad del tiempo con `--scale 0.5 --crf 23` (la rasterización crece con los píxeles): usalos para las escenas sueltas y dejá el tamaño completo para el final. `npm test` corre las pruebas rápidas del repo (1 a 2 minutos); las lentas (`npm run test:e2e`, ~10 minutos) solo importan si cambiás el toolkit.

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

## Etapa 2: tema (el design system va primero)

Antes de empezar: fichas aprobadas. **El design system se decide antes de escribir una sola escena**: una escena no decide forma, superficie, tipografía ni movimiento; lo decide el tema y la escena lo lee con las ayudas. El orden es: tokens, informe del adaptador, estilo, prueba con la plantilla y hoja, y recién después fuentes.

1. **Tokens.** Con los tokens de la persona (archivo CSS con variables o JSON), escribí `videos/<slug>/theme.ts` con `themeFromTokensWithReport` (ver `themes/README.md`). Debe exportar `theme` y, cuando sale de tokens, `report`:

   ```ts
   import { themeFromTokensWithReport } from "../../themes";
   // Los tokens van copiados como texto CSS (o un objeto JSON) dentro del archivo: así lo leen vite y tsx.
   const tokens = `:root { --color-primary: #e11d48; --color-background: #ffffff; --color-foreground: #111111; }`;
   const r = themeFromTokensWithReport(tokens);
   export const theme = r.theme;
   export const report = r.report;
   ```

   **Colores propios de las interfaces recreadas** (estados, severidades, fondos de ficha) no se escriben como `#hex` en las escenas ni en una tabla aparte: se declaran en el tema como `theme.data` y la escena los lee con `useTheme().data.<nombre>`. Pasá `{ data: { estadoOk: "data-estado-ok", estadoBajo: { token: "severity-1", on: ["bg", "surface"], min: 4.5 } } }` como tercer argumento (`themeFromTokensWithReport(tokens, base, opciones)`): cada nombre sale de un token, o de un valor propio con `{ color, on, min }`; `on` son las superficies donde se dibuja y `min` el contraste pedido (3 para rellenos, 4.5 para texto). `checkTheme` revisa cada par. Un nombre no declarado lanza un error que lista los declarados. Detalle en `themes/README.md`, "Colores de datos".

   Entre `body` y `h2` hay `type.display.sm|md|lg` (48, 56, 64 px); un tamaño intermedio se deriva con un factor (`type.stat * 0.8`), nunca con un literal.
   `type.ui` (`xs` 15, `sm` 20, `md` 24 px) es la letra de las interfaces densas que se leen con la cámara acercada (tablas, fichas, menús): no la uses para texto que se lee en pantalla completa. `qa` baja a `info` el texto chico que en algún otro cuadro de la misma escena se ve a tamaño legible, así que cada escena con `type.ui` necesita un acercamiento donde ese texto se lea; uno que no se lee en ningún cuadro sigue siendo error.

   **Nubes**: el fondo sale de `theme.cloud`; con tokens, `--cloud-color-1..12` (o `--cloud-colors`), `--cloud-count`, `--cloud-opacity`, `--cloud-seed` y `--cloud-blob-1..24: "x y [tamaño]"`. Una escena puede pisarlas con `<Stage cloud={{ colors, count, blobs, opacity }}>` y una historia entera con `spec.design.clouds`.

   `report` existe solo con `themeFromTokensWithReport`. Si no hay tokens, usá `neutral` (o `dark` si la herramienta que se recrea es oscura), exportá solo `theme` (`export const theme = dark;`, con `import { dark } from "../../themes"`) y decilo: `templates/tema-informe.ts` lo tolera y muestra solo el contraste. No inventes marcas ni colores corporativos.
2. **Informe del adaptador.** Corré `npx tsx templates/tema-informe.ts <slug>` y mostrá: roles tomados de los tokens, roles que quedaron con el valor base (`fallback`), avisos y fallas de contraste. Para cada falla proponé el arreglo (oscurecer el color de texto, cambiar el acento) y no lo apliques sin que la persona lo apruebe. Cada aviso trae `usedBy` (dónde usan las piezas ese color, como texto o como gráfico) y `suggestion` (el tono más cercano que llega al mínimo). Si la marca ya aprobó un par que no llega a 4.5:1 y la persona lo confirma, se reconoce en el tema con `acknowledge: ["accent/bg"]` (en `themeFromTokensWithReport(tokens, base, { acknowledge })`): sale como `note` en vez de aviso y queda en `report.notes`. `acknowledge` no cambia lo que mide `qa`, que juzga el texto real en pantalla.
3. **Elegí el estilo** (`theme.style`). Un design system no es solo una paleta: define cómo son las esquinas, las superficies, los números, el fondo y el movimiento. Se declara en el tema (`themeFromTokensWithReport(tokens, base, { style: {...} })`, o tokens `--style-<grupo>-<campo>`); lo que no se declara queda como en `neutral`. `templates/theme.ts` trae el bloque completo, comentado, con los valores por defecto. Elegí campo por campo mirando el design system de la persona y mostrale la tabla con lo elegido:

   | Grupo | Qué decide |
   |---|---|
   | `shape` | esquinas (`pill`, `rounded`, `sharp`), grosor de borde, si lleva borde |
   | `surface` | tipo (`solid`, `glass`, `outline`, `tinted`) y elevación (`shadow`, `flat`, `border`, `glow`) |
   | `type` | pesos, interletrado, mayúsculas de rótulos, tratamiento de los números y de la palabra resaltada |
   | `background` | nubes, liso, grilla, puntos, degradado o grano, y su intensidad |
   | `motion` | cómo entran las cosas, rebote, paso entre elementos, desenfoque de cámara, transición entre escenas |
   | `decor` | garabatos y su trazo, viñeta, marca de acento, vaivén del degradado |
   | `story` | valores por defecto de la historia: cartel, lista, acople, muro, cierre |
   | `chart` | radio de las barras, grosor de línea, guías y relleno de los gráficos |
   | `line`, `solid`, `depth`, `text` | trazos, sólidos, volumen y texto de los efectos de `fx/` |

   Referencias: los tres design systems de ejemplo, inventados y con estéticas opuestas: `themes/editorial.ts` (esquinas rectas, contorno, marcador y subrayado), `themes/neon.ts` (vidrio con halo, puntos, rebote) y `themes/papel.ts` (esquinas suaves, superficie teñida, grano, trazo a mano). Contrato completo en `docs/estilo.md`. `checkTheme` revisa contraste y combinaciones del estilo; lo que informe se corrige o se reconoce con `acknowledge` como el resto.
4. **Probá el estilo con la plantilla y mirá la hoja.** Con `videos/<slug>/theme.ts` listo, creá la escena y la historia de arranque (`bash templates/nuevo.sh historia <slug> <escena>`), corré `npm run sheet -- <slug> --count 12` y abrí la imagen con Read: tiene que verse como el design system (esquinas, bordes, números, fondo), no como el video neutro con otros colores. Pasá también `npm run qa -- <slug>-<escena> --count 30`. Ajustá el estilo hasta que la hoja convenza y mostrásela a la persona.
5. Fuentes: si la persona trae archivos, van en `public/` y se declaran en `theme.font.files`; confirmá su licencia para el lugar de exhibición (etapa 0, punto 8).

**Alto: esperá aprobación del tema.**

## Etapa 3: guion

Antes de empezar: tema aprobado. **El guion se escribe y se aprueba antes de construir cualquier escena**; si ya hay escenas sin guion, parás y lo escribís primero.

**Nombres de tema cortos.** El nombre de cada tema (`topics[].name`) va en una píldora sobre el panel del cierre y en la lista: se achica y se corta con "…". **Presupuesto de caracteres: hasta 18 por nombre** (ideal 12 a 16): es lo que entra sin cortarse con 2 a 6 temas y en los tres formatos (el límite es el cuadrado con 5 o 6 temas, unos 18; la píldora nunca pasa del 80 % del ancho y, si no entra, se achica y se corta con "…"). A tamaño de letra completo, sin achicarse, entran unos 11 en el peor caso (cuadrado con 5 o 6 temas), 16 en vertical con 4 o más y 20 en horizontal con 5 o 6. En la lista vertical el tope es de unos 22. Pensá cada nombre con ese tope ("Panel de ventas" sí, "Panel integral de ventas por región" no) y poné el detalle en `line` (2 renglones en la lista).

Escribí `videos/<slug>/guion.md`: una tabla por escena (apertura y cierre incluidos si usa historia). Cuadros a 30 fps; la columna de tiempo lleva segundos y cuadros, y hay una columna de duración en cuadros por escena.

**Presupuesto de cuadros.** Una historia con `n` temas dura `apertura + Σ temas + n × vuelta al listado + cierre`. **Por defecto: apertura 300 + vuelta al listado 120 × n + cierre 480 = 780 + 120n cuadros antes de sumar una sola escena** (con 3 temas, 1140 cuadros, 38 s). Para un video más corto bajá los bloques con `timing: { opening, interlude, closing }` en el `spec` (mínimo 60 cuadros cada uno) o sacá las vueltas con `interludes: false` (ver `stories/README.md`), o dejalas como una tira corta con `interludes: "compact"` en el `defineStory` (40 cuadros cada una, mínimo 24, `timing.interludeCompact`). Con vueltas compactas la fórmula es `apertura + Σ temas + n × interludeCompact + cierre`: con 3 temas y los valores por defecto, 300 + 480 + 3 × 40 = 900 antes de los temas. Ejemplo de 25 s (750 cuadros) con 3 temas: apertura 75 + 3 × (tema 135 + vuelta 60) + cierre 90 = 750. Despejá los temas de la fórmula y poné la cuenta en la primera línea del guion. Con el código a mano: `storyBudget(spec, scenes)` y `formatStoryBudget(...)` de `stories/` devuelven el total y el mínimo posible; con la historia ya armada, `npm run qa -- <id> --list-scenes` imprime el presupuesto por bloque (`budgetFromScenes`). La apertura tiene que durar al menos unos 4 s (120 cuadros) para que el título se lea: si el total no alcanza, sacá un tema o agrandá el video; no comprimas la apertura.

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

Si usa sonido, sumá una tabla de momentos (cuadro, efecto: `clic`, `tilde`, `aviso`, `barrido`, `campanita`, `golpe`) que después se vuelve `cues.json`. **Sin música el sonido queda flaco**, así que proponé un plan de cues en vez de dejarlo a medias: un sonido por cada acción clave (`clic` en cada clic del cursor, `tilde` cuando algo queda hecho, `aviso` cuando aparece un resultado o alerta), un `barrido` en cada transición (el atravesado y el velo, en el primer cuadro del `zoomThrough`) y un `golpe` suave (`gain` 0,5 a 0,7) en el título de la apertura y en el cierre. Dejá espacio: no más de un efecto cada 8 a 10 cuadros salvo que sea un redoble pensado. La música es opcional y es decisión de la persona: ofrecela, pero la pista y su licencia las pone ella (nunca la elegís ni la bajás vos). Si hay varios formatos, anotá qué cambia de disposición en cada uno.

**Alto: sin guion aprobado no se construye ninguna escena.**

## Etapa 4: escenas, de a una

Antes de empezar: `guion.md` aprobado (con presupuesto de cuadros) y el tema aprobado. Cada escena nueva empieza cuando la anterior está aprobada.

Para cada escena del guion, en orden:

1. **Elegí efectos del catálogo antes de escribir desde cero:** abrí `docs/animaciones.md` (sección "Cómo elegir") y usá los efectos de `fx/` que ya existen para cada momento del guion; combinalos con cámara, cursor y garabatos del kit (`docs/guia-escenas.md`, sección 9). Podés ver cualquiera con `npm run dev` y `/?video=fx-text`, `fx-3d` o `fx-data-ui-art`.
2. `bash templates/nuevo.sh escena <slug> <escena>` (no hay que registrarla; con `VE_VIDEOS_DIR` definida escribe en esa carpeta). Antes de acomodar nada a ojo, usá las medidas de la sección 13 de `docs/guia-escenas.md` (caja de la ventana por formato, franja del titular, zoom máximo que muestra una fila entera) y copiá de ahí la escena de datos completa si la escena es de ese tipo. **Estética por las ayudas, no a mano**: la escena no escribe radios, sombras, bordes, pesos de letra ni curvas propios. Usa `surfaceStyle` (con `bold`, `corner`, `level`), `cornerRadius`, `textStyle` y `Eyebrow`, `Highlight` y `Numeral` para texto y cifras destacadas, `entrance` y `staggerFrames` para entradas, `useCameraAt` para la cámara y `chartStyle` para gráficos (ver `docs/guia-escenas.md`, sección 14); así el mismo video se rehace con otro design system. Con la plantilla, probala bajo otros sistemas: `npm run qa -- <slug>-<escena> --props '{"theme":"editorial"}' --count 30` (también `neon`, `papel`) y `npm run sheet -- ... --props '{"theme":"neon"}'`. Construí la escena con piezas del kit siguiendo `docs/guia-escenas.md`: coordenadas del mundo, cámara con cuadros clave, todo del tema (los colores de la interfaz recreada, de `useTheme().data`; la letra densa de `type.ui`), interfaces recreadas con su estructura y rótulos, nunca capturas. Piezas que conviene conocer: `DockedHeadline layout="inline"` (título y línea en un renglón), `Vignette color="bg" strength={0.5}` en interfaces oscuras, `GradientText loop={90}` (vaivén que vuelve exacto), `flyInZ(progreso, { from })` para un panel que llega en profundidad y `Stage cloud={...}`. La plantilla ya trae una disposición horizontal y otra vertical con `useFormat().pick`; para cada formato extra del guion, diseñá la disposición (no achiques la horizontal). Si va en una historia, el contenido es `SceneBody` (sin `Stage`) y el titular va con `DockedHeadline` y una prop `title` (como en la plantilla), que funciona tanto sola como dentro de la historia. La alternativa es `<TopicHeadline title="..." number={1} />`: con `title` dibuja el titular también fuera de la historia (dentro, `title` y `number` pisan al tema); sin `title` y sin historia no dibuja nada y avisa una vez en la consola. `useTopic({ name: "..." })` (con valor de reserva) y `useTopicOrNull()` sirven para leer el tema sin que la escena sola falle. La escena exporta su `DURACION` y se prueba sola antes de entrar a la historia.
3. **Antes de mostrar nada**, corré en este orden y corregí lo que salga hasta que quede limpio:
   ```bash
   npm run typecheck
   npm run render -- <slug>-<escena> --check
   npm run qa -- <slug>-<escena> --count 40
   npm run qa -- <slug>-<escena> --themes all --count 40      # si el video tiene que funcionar con más de un design system (empezá por `editorial`, el más estricto)
   npm run qa -- <slug>-<escena> --count 40 --font-fallback wide --font-scale 1.25   # prueba de estrés de tipografía: 0 errores
   npm run privacy -- <slug>-<escena> --deny videos/<slug>/prohibidos.txt --scan-source videos/<slug>
   ```
   **Leé la línea `juzgados` de `qa`** (cuánto texto se juzgó de verdad y por qué no se juzgó el resto): un "0 errores" con la mitad del texto sin juzgar no dice nada, y una marca `data-qa-ignore` que calla a un contenedor entero es una escena que mira para otro lado. `--repeat 2` corre el control dos veces y falla si los informes difieren (si un hallazgo va y viene, es un defecto del control: avisá). Las reglas para que la escena aguante otro design system (texto atenuado calculado, nada pisado a píxeles fijos, filas con alto explícito, franja del titular) están en `docs/guia-escenas.md`, sección 15.
   Los avisos de `qa` que sean a propósito (transiciones) se explican; el texto de marco de una interfaz recreada va bajo `data-qa-decor` (ver `qa/README.md`) y `qa` cuenta lo que callan las marcas; solo se silencian con `data-qa-ignore="regla"` si lo decidiste a propósito y lo decís. Fundidos, elementos que se cruzan en movimiento, rebabas bajo cámara en movimiento y texto bajo un `Wash` a medio fundido ya salen como `info`: no los silencies. Lo que sigue pidiendo `data-qa-ignore` condicionado (p. ej. texto cortado a propósito bajo un zoom quieto: `data-qa-ignore={zoomed ? "offscreen" : undefined}`) y qué transiciones ya no hace falta silenciar: `docs/guia-escenas.md`, sección 7, "Recetas de `qa`". `ve-qa` y `ve-privacy` aceptan `--out <ruta>` para el informe; `ve-privacy` informa `DENY-JOINED` si un término aparece solo en texto unido entre vecinos en línea (con límites de palabra, nunca entre bloques).
4. Hoja de cuadros: `npm run sheet -- <slug>-<escena> --count 12` (una por formato: `--format vertical` escribe `out/<slug>-<escena>-vertical-sheet.png`). **Mirala como un espectador** (abrí la imagen con Read) y corregí lo que veas mal: titular tapando contenido, vacío arriba en la vista general, cosas fuera de cuadro, interfaces vacías o cargando, el sujeto chico en el cuadro vertical. Repasá `docs/guia-escenas.md`, sección "Para que no parezca un borrador".
5. MP4 de esa escena sola: `npm run render -- <slug>-<escena> --scale 0.5 --crf 23`. Entregá a la persona la ruta del MP4 y de la hoja, más un resumen de lo que hace cada tramo y de lo que QA y privacidad dijeron (aunque sea "limpio").

**Alto: esperá aprobación de la escena.** Aplicá las correcciones, repetí el punto 3 y mostrá de nuevo (solo lo que cambió). Recién con "aprobada" pasás a la escena siguiente.

## Etapa 5: armado

Antes de empezar: todas las escenas aprobadas, cada una con `--check`, `qa` y `privacy` en limpio.

1. Si hay varios temas: completá `bash templates/nuevo.sh historia <slug> <escena>`, reemplazá las escenas de ejemplo por las reales (en el mismo orden que `spec.topics`) y completá `spec.ts` con lo de las fichas (de 2 a 6 temas). **Dale una `thumbnail` real a cada tema**: sin ella el cierre muestra una tarjeta derivada del número y el nombre (barras, línea, anillo o filas según el tema), que varía pero sigue siendo genérica y es lo que más delata una plantilla. Es un componente sin props de 560×340, ver `docs/guia-escenas.md`, sección 8. `defineStory` agrega apertura, vueltas al listado y cierre. La firma del cierre puede llevar una marca propia: `signoff.slot` (un nodo React: ícono, sello) reemplaza al logo; `theme` de `defineStory` acepta un nombre ("neutral", "dark") o el objeto de `videos/<slug>/theme.ts`; por props (`--props '{"theme":"dark"}'`) se pisa con un nombre al renderizar. Con un solo tema o escena suelta, el video final es esa escena.

   Más opciones de la historia (detalle en `stories/README.md`):
   - **Historia parcial**: `scenes` va parejo a `spec.topics` y un tema sin escena se indica con `null` (sale en la lista y en el cierre, sin vuelta al listado); una lista vacía (`composeStory(spec, [])`) da solo apertura y cierre.
   - **`spec.design`**: `titleCard: "glass"` (cartel translúcido), `list: "inline"` (`01 Nombre · línea` en un renglón), `handoff: "dock"` (la apertura entrega la píldora del titular ya puesta), `wall: { columns, rows, blur }` y `clouds: { opacity, colors, ... }`. Todo lo que no se indica queda como siempre.
   - **Texto de la firma con negrita**: `signoff.text` y `signoff.tagline` aceptan un fragmento entre dobles asteriscos (`"Gracias por **mirar**"`).
   - **A mano**: si la historia no alcanza, `Opening`, `Interlude`, `Closing`, `TopicProvider` y `StoryStage` se usan sueltos dentro de `Sequence` (con las duraciones `openingFrames(spec)`, `interludeFrames(spec)`, `closingFrames(spec)`).
2. Sonido (solo si se pidió; detalle y límites en `docs/audio.md`), con el video mudo ya aprobado:
   - **Efectos**: `npm run audio -- efectos --out videos/<slug>/audio/sfx`.
   - **Cues**: `videos/<slug>/cues.json` con `[{"frame": 45, "sfx": "clic"}, ...]`; cada cuadro sale del guion (clic = cuadro del clic, tilde cuando se tilda, barrido en el atravesado). Los cuadros se miden en el tiempo del video, sumando el desplazamiento de cada escena en la historia (`timeline` de `composeStory`). Un `barrido` tarda 385 ms en llegar a su pico: con `"ancla": "pico"` el pico cae en el cuadro del cue en lugar del comienzo del archivo (por defecto, `"inicio"`).
   - **Música** (opcional; la pista y su licencia las trae la persona y nunca va al repo):
     1. **Convertí el mp3 a wav una sola vez** (`ffmpeg -i tema.mp3 tema.wav`) y usá ese wav en `tempo`, `empalme` y `mezcla`: un mp3 sin etiqueta Xing/LAME arranca unos 25 ms antes o después según el decodificador.
     2. `npm run audio -- tempo tema.wav --fps 30 --out videos/<slug>/tempo.json`. Mirá `bpm`, `confidence` y `phaseConfidence`; con `phaseConfidence` baja y los golpes a contratiempo, repetí con `--fase medio`.
     3. **Elegí dónde arranca**: `tempo.json` trae `secciones` (`n`, `sec`, `tipo`: `entrada`, `percusion`, `energia`, `caida`). El primer groove no es necesariamente donde entra la batería: mostrale a la persona las secciones y elegí una con `--inicio seccion:<n>` (o `--inicio percusion`, o `--inicio <seg>`).
     4. `npm run audio -- empalme tema.wav --frames <total> --fps 30 --inicio seccion:<n> --tempo videos/<slug>/tempo.json --out videos/<slug>/audio/musica.wav --json videos/<slug>/audio/musica.json`. Repite compases enteros dentro del cuerpo de la pista (sin su intro baja ni su cola) con cruces de 40 ms. Ajustes: `--corte-en 12.5,f450` hace que un empalme caiga cerca de un cambio de escena (mejor que se oiga ahí); `--lazo-inicio`/`--lazo-fin` ubican el lazo a mano; `--fade-in` (0,3 s por defecto si no arranca en el comienzo; 0 lo apaga); `--final real` toca el final propio de la pista en vez de una caída artificial cuando el video dura más que ella. Después de forzar algo, escuchá el empalme.
   - **Mezcla**: `npm run audio -- mezcla --cues videos/<slug>/cues.json --sfx videos/<slug>/audio/sfx --fps 30 --frames <total> --musica videos/<slug>/audio/musica.wav --musica-gain 0.5 --lufs -16 --out videos/<slug>/audio/audio-<slug>.wav`. Con música, cada efecto baja la música 5 dB (`--duck-db N`, `0` lo apaga); `--lufs` normaliza la sonoridad (-16 web y redes, -14 plataformas de video, -23 televisión; sin la opción no se normaliza) y `--techo` (-1 dBTP por defecto) limita el pico verdadero. La salida va a `videos/<slug>/audio/`, nunca a `public/`.
   - **En el video**: `defineStory({ ..., audio: { src: "audio-<slug>.wav" } })` (o `<Audio src={asset("audio-<slug>.wav")} />` en una escena suelta); `videos/<slug>/audio` se sirve solo, no hace falta `--assets`. Los `beatFrames` de `musica.json` sirven para que una animación caiga en el compás (`audio/beats.ts`: `pulse`, `nearestBeat`). La vista del navegador no reproduce audio: se oye en el MP4.
3. Verificación completa sobre el video final, sin saltear nada:
   ```bash
   npm run typecheck && npm test
   npm run render -- <slug> --check          # y con --format vertical (o cuadrado) si el video los admite
   npm run render -- <slug> --check --scene opening   # historia: también por bloque (opening, interlude-1, closing) y por formato
   npm run qa -- <slug> --count 60
   npm run qa -- <slug> --themes all --count 40     # si el video debe funcionar con más de un design system (y --font-fallback wide como estrés)
   npm run privacy -- <slug> --deny videos/<slug>/prohibidos.txt --scan-source videos/<slug> --every 15
   npm run sheet -- <slug> --count 16        # una hoja por formato
   ```
   `--check` de un video con escenas con nombre (una historia lo es) mira 12 cuadros parejos y además 6 por escena, 3 de ellos cerca del inicio, que es donde ocurren las entradas; el muestreo parejo solo puede saltearse el cuadro donde falla un bloque, por eso en una historia conviene repetirlo con `--scene` por bloque. Con `--frames a-b` se queda dentro del rango; `--check-count N`, `--check-per-scene N` y `--check-all` (todos los cuadros: lento) cambian el muestreo.
4. Render final: `npm run render -- <slug> --out out/<slug>.mp4` (el audio de `videos/<slug>/audio` se sirve solo; con `--format vertical --out out/<slug>-vertical.mp4` para cada formato extra). Mostrá las rutas, la duración y el peso de cada archivo.
5. Actualizá `videos/<slug>/guion.md` para que coincida con lo producido (tiempos reales, textos finales, cifras emuladas usadas).
6. Cerrá con: ruta del MP4, ruta del guion, pendientes de licencia (fuentes, música, marcas) y qué hacer para volver a renderizar.

**Alto: esperá la aprobación final** o los pedidos de cambio (vuelven a la etapa que corresponda).

## Cambios sobre un video existente

Si piden agregar, editar o corregir una escena: leé su carpeta y el guion, proponé el cambio en una línea, hacelo, corré el punto 3 de la etapa 4, mostrá hoja y MP4 de esa escena, y actualizá `guion.md`. El render por partes reutiliza lo que no cambió.

## Si algo falla

- `useTopic: solo se puede usar dentro de una escena armada con composeStory`: la escena se está renderizando sola. Pasale un valor de reserva (`useTopic({ name: "Panel de ventas" })`), usá `useTopicOrNull()` o dejá el titular con `DockedHeadline` y `title` por prop, como en `templates/scene/Scene.tsx`. `TopicHeadline` no lanza: fuera de la historia y sin `title` no dibuja nada (aviso en la consola); pasale `title` y `number`.
- La escena sola se ve bien pero en la historia el video sale solo en horizontal, o `--format vertical` dice que el video no lo admite: faltó `formats: ["vertical"]` en `defineVideo` o en `defineStory` (por defecto solo el formato base).
- `qa` marca `offscreen` con severidades distintas, o `contrast` en un texto bajo un `Wash`: el criterio (info / aviso / error según movimiento, cámara y fundido; velo en transición contra velo quieto) está en `qa/README.md`, secciones "`offscreen`: por qué error, aviso o info" y la fila de `contrast` en "Reglas de `ve-qa`"; resumen en `docs/reglas.md`. Se silencia solo a propósito, con `data-qa-ignore`.
- `privacy` imprime resultados de más o falla leyendo la lista: el comando documentado (`--deny videos/<slug>/prohibidos.txt --scan-source videos/<slug>`) ya omite del escaneo los archivos de `--deny` y `--allow` y cualquier archivo llamado `prohibidos.txt`; la lista vive en `videos/<slug>/`.
- `setFrame(n) fallo: ... holds pendientes` (timeout de 30 s): una fuente o imagen no carga. Revisá que el archivo exista (en `public/`, en `videos/<slug>/assets`, en `<VE_VIDEOS_DIR>/assets` o en una carpeta de `--assets`) y que `theme.font.files`/`asset()` apunten bien.
- `No cargó una fuente; el video saldría con otra tipografía: "Marca" ... desde <url>`: la fuente del tema no se pudo leer (404 o archivo dañado). Corregí la ruta (`asset("fonts/x.otf")` busca en las carpetas de estáticos; `import f from "../assets/x.otf?url"` lo resuelve vite). Solo para un borrador: `--allow-missing-fonts`.
- Videos en una carpeta fuera del repo (`VE_VIDEOS_DIR=<carpeta absoluta>`): es donde van los videos con material privado. `VE_VIDEOS_DIR=<carpeta> bash templates/nuevo.sh escena <slug> <nombre>` escribe ahí (no en `videos/`) con imports `video-estudio/...` y crea `tsconfig.json` y `env.d.ts` si faltan (modelos en `templates/externo/`; `nuevo.sh externo` solo prepara esos dos). Con la variable definida funcionan igual `render`, `--check`, `qa`, `sheet`, `privacy` y `npm run dev`, y la carpeta se suma a los ejemplos. `npm run typecheck` revisa también esa carpeta; `npm run typecheck:videos` solo esa (y falla si la variable no está). Si la ruta no existe, el comando falla con un mensaje claro.
- `--check` falla: seguí `docs/reglas.md`, sección **"Qué hacer cuando --check falla"**. El error imprime el cuadro, el rectángulo (bbox) y los elementos que caen ahí, más las escenas con nombre activas y una línea `pista:`; con eso se acota la pieza, se bisecan las piezas del bbox y se aplica la causa habitual. La comparación de HTML ignora el orden de atributos, clases y propiedades de `style`; solo cuentan valores, hijos y texto. Si `checkDeterminism` da `ok: false`, la escena depende del historial: buscá `useState`/`useRef` que acumulan, `Date.now()`, `Math.random()` (usá `random(seed)`), animaciones CSS, `setTimeout`, `useId`. `--check` tolera el ruido chico de desenfoques y sombras (detalle en `docs/reglas.md`); un cambio real no pasa y `--check-strict` compara byte a byte.
- `No se pudo cargar "playwright"` / `No se pudo lanzar Chromium`: `npm i -D playwright` y `npx playwright install chromium`, o `VE_CHROMIUM=/ruta/a/chrome`.
- ffmpeg o ffprobe no encontrado: instalalo y comprobá con `ffmpeg -version`.
- `Audio file ... not found`: poné el archivo en `public/`, en `videos/<slug>/audio` (se sirve solo) o pasá `--assets <dir>`.
- No encuentra el video (`id` desconocido): corré `npm run render -- --list` y fijate si aparece; la carpeta tiene que tener `index.ts(x)` con un `defineVideo` y estar en `videos/<slug>/` o `videos/<slug>/<carpeta>/`. Dos videos con el mismo `id` fallan con un error que nombra las dos carpetas.
- Salió algo viejo: `--no-cache` o borrá `.ve-cache/`.
- `cameraAt`/`kf`/`interpolate` lanzan error: los cuadros clave tienen que ser estrictamente crecientes.
- El caché de partes es por video: editar tu video re-renderiza sus partes (y las de los videos que comparten el código que tocaste), no las de los demás. Un render completo después de editar es normal.
