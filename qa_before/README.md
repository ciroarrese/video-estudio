# qa

Control de calidad automatico: revisa cuadros del video en Chromium **antes** de mostrarselo a una persona. Detecta los defectos de maquetacion que antes se encontraban a ojo: etiquetas cortadas, textos que se pisan, un titular que tapa contenido, letra chica, bajo contraste y datos privados en pantalla.

Se usa desde un clon del repo (como `ve-render`); necesita Chromium de Playwright. Compila el runtime con vite la primera vez (`.ve-cache/bundles/`; con `VE_VIDEOS_DIR`, en `<VE_VIDEOS_DIR>/.ve-cache/`).

## Comandos

```bash
npx ve-sheet kit-demo --count 12                    # hoja de cuadros: out/kit-demo-sheet.png
npx ve-sheet hello --frames 0,60,120 --cols 3 --scale 0.4
npx ve-qa kit-demo                                  # 24 cuadros repartidos
npx ve-qa mi-video --frames 30-90/10 --fail-on warn --json out/qa.json
npx ve-privacy mi-video --deny prohibidos.txt [--allow permitidos.txt] [--scan-source stories/]
npx ve-sheet mi-video --count 12 --out ~/Escritorio/hoja.png   # --out acepta cualquier ruta; el comando imprime la que escribió
npx ve-qa mi-video --out ~/Escritorio/qa.json                  # informe JSON (--out o --json, igual en ve-privacy); imprime "informe: <ruta>"
npx ve-qa mi-video --count 40 --repeat 5                       # autocomprobación: 5 corridas, falla (salida 3) si los informes difieren
```

Sin `--out`, `ve-sheet` escribe `out/<id>-sheet.png` (con `VE_VIDEOS_DIR`, en `<VE_VIDEOS_DIR>/out/`, nunca dentro del clon; ver `render/README.md`) (con `--format`, `out/<id>-<formato>-sheet.png`; con `--scene`, también el sufijo de la escena).

`ve-sheet`, `ve-qa` y `ve-privacy` aceptan `--assets <dir>` (repetible) y `--allow-missing-fonts`, igual que `ve-render`; los estáticos de una carpeta externa se sirven solos: `videos/<slug>/assets`, `videos/<slug>/audio` y `<VE_VIDEOS_DIR>/assets` (ver `render/README.md`, "Archivos del video"). Una fuente que no carga **falla** (nombra familia y URL) salvo con `--allow-missing-fonts`.

(Tambien `npm run qa|sheet|privacy -- <id> ...`.) Codigo de salida: 0 limpio, 1 hay hallazgos (`ve-qa`: errores, o avisos con `--fail-on warn`), 2 uso incorrecto, 3 (`ve-qa --repeat`) informes que difieren entre corridas.

Seleccion de cuadros (igual en los tres): `--frames 0,60,120` (admite `10-40/10`), `--every N` o `--count N`. `--props '{...}'` mezcla props con las del video. `--format horizontal|vertical|cuadrado` revisa el video en ese formato (si lo habilita `defineVideo({ formats })`); `--scene <id|índice>` (rango de la escena: los cuadros muestreados quedan dentro de su `Sequence`, primero y ultimo incluidos; los vecinos f-1 / f+1 que miden el movimiento si pueden caer en la escena de al lado) limita el muestreo al rango de una escena (no se combina con `--frames`) y `--list-scenes` las lista. En `min-size` y `contrast` el tamaño de referencia es el lado corto del cuadro (1080 = 18 px mínimos): en vertical es el ancho.

## Reproducibilidad: `--repeat <n>`

`ve-qa` es una función determinista del video y de las opciones: la misma orden sobre el mismo código tiene que dar el mismo informe, byte a byte (salvo `summary.seconds`). `--repeat <n>` lo comprueba: corre el control `n` veces, compara cada informe con el primero y, si alguno difiere, imprime qué hallazgos aparecen, desaparecen o cambian de medida (antes y ahora) y sale con código **3**. Si no hay diferencias, escribe el primer informe y sigue como siempre. Si una corrida de `ve-qa` da cosas distintas a la anterior, es un defecto de `qa`, no del video: correr con `--repeat 5` y avisar.

Dónde se mide con estado externo, y cómo se evita: los fondos del `contrast` salen de una captura con el texto oculto que se decodifica y se muestrea **en Node** (`qa/png.ts`), no en un canvas de la página; el estilo que oculta el texto espera dos cuadros de animación antes de capturar; los cuadros vecinos (f-1 / f+1) se piden siempre en el mismo orden en una misma página. La prueba `reproducible` de `qa/e2e.test.ts` corre dos veces `qa-defects` y `fx-in-scene` (tema `neon`) y exige informes idénticos.

## Reglas de `ve-qa`

Cada regla tiene id, severidad y umbrales. Se cambian con `--set regla.umbral=valor` (repetible), se eligen con `--rules a,b` o se apagan con `--skip a`. Valores por defecto en `qa/thresholds.ts`.

| Regla | Que detecta | Severidad | Umbrales (por defecto) |
|---|---|---|---|
| `clip` | Texto cortado: el elemento desborda con `overflow` oculto/elipsis, o una linea queda parcialmente fuera de un ancestro con overflow oculto. Lo totalmente oculto no cuenta. | error | `tolerancePx` 1.5, `minHiddenFraction` 0.02 |
| `offscreen` | Texto visible que sale solo en parte del cuadro. Totalmente afuera, casi transparente (<0.05) o gigante (zoom que atraviesa, > `maxFrames` veces el cuadro) se ignora. La severidad depende de tres cosas que el mensaje nombra (ver abajo). | error / warn / info | `tolerancePx` 1, `slipPct` 15, `sliverPx` 6, `cameraPx` 1, `maxFrames` 2 |
| `safe-area` | Texto dentro del cuadro pero fuera del area segura. No se evalua bajo camara/zoom. | warn | `margin` 0.03 (por lado) |
| `overlap` | Dos textos de elementos distintos (no ancestro/descendiente) cuyas cajas se pisan mas de `ratio` del menor. Las cajas se achican en vertical (`inkHeight` 0.75) porque la caja de linea es mas alta que la tinta. Ignora pares con uno casi transparente. | error | `ratio` 0.2, `minOpacity` 0.3 |
| `min-size` | Tamano en pantalla (tamano CSS x escala acumulada de las transformaciones, o sea, cuenta la camara) menor al minimo, escalado con el alto del cuadro. Con opacidad efectiva < `minOpacity` (fundido o decorativo) o en movimiento: `info`. **Detalle que se lee al acercar:** un texto chico que, dentro de la misma escena y mientras es visible, se ve en otro cuadro a tamaño legible es `info` (ver abajo). | error | `minPx1080` 18, `tolerancePx` 0.5, `minOpacity` 0.35, `probeFrames` 24 |
| `contrast` | Color del texto (por la opacidad) contra el fondo real: mediana de los pixeles bajo la caja en una captura con el texto oculto. Razon WCAG (`themes/contrast.ts`) < 3 error; < 4.5 aviso si el texto es chico. Texto con relleno transparente (gradiente) se omite; con opacidad efectiva < `minOpacity` pasa a `info`. El texto en **movimiento** (mas de `motion.crossPx` entre cuadros) pasa a `info`: el fondo que tiene debajo cambia de un cuadro al otro. El texto **quieto** (sin movimiento ni cambio de opacidad entre cuadros vecinos) se juzga con su opacidad compuesta, tal como se dibuja (p. ej. gris al 50 % sobre claro); el texto en fundido o en movimiento, con su propio color. Texto bajo un velo de cuadro completo translucido (opacidad propia x alfa de fondo entre 0.02 y 0.9, p. ej. un `Wash` a medio fundido) cuya opacidad cambia entre cuadros vecinos: `info` (es una transicion; mismo criterio que un fundido); si el velo esta quieto, sigue siendo error (el contraste que se ve es ese). Texto en fundido (su opacidad cambia entre cuadros vecinos) cuyo fondo lo pinta una superficie que tambien esta en fundido (un elemento con opacidad < 1 en o sobre el ancestro que pinta el fondo, p. ej. un panel oscuro que entra con su contenido sobre un video claro): `info`, porque el fondo muestreado esta a medio mezclar; una vez asentado se juzga normal. | error / warn | `error` 3, `warn` 4.5, `largePx1080` 24, `minOpacity` 0.35 |
| `covered` | El texto queda bajo un elemento opaco (opacidad propia x alfa del fondo x opacidad de ancestros >= 0.9; con color de fondo, imagen o degradado de fondo (no `background-clip:text`), `img`, `video`, `canvas`) que no es ancestro ni descendiente. Se muestrean 5 puntos por linea (10/30/50/70/90 % del ancho), asi que una tira que tapa un costado se detecta; el mensaje indica el % de puntos tapados. Un solo hallazgo por elemento que tapa. Se omite si el texto tiene opacidad < `minOpacity`. Estatico: error (este oculto por completo o no); en movimiento (texto o capa): `info`. Capa de cuadro completo (>= `maxCoverFraction`): `warn` si esta opaca del todo y quieta (suele ser una escena que deberia desmontarse), `info` si esta a medio fundido o se mueve; las demas reglas siguen ignorando ese texto. | error / warn | `minOpacity` 0.2, `maxCoverFraction` 0.9, `hiddenFully` 0.97 |

Los textos con opacidad baja (fundidos) se ignoran segun cada regla, asi que conviene muestrear cuadros donde la escena ya se asento. Todo se mide con rectangulos de pantalla (`Range.getClientRects`), por lo que respeta transformaciones 2D/3D; una rotacion se aproxima por su caja envolvente.

**Detalle que se lee al acercar (`min-size`).** Un tablero que se muestra entero y después se acerca tiene cientos de textos por debajo del mínimo en el plano general (un caso real dio 1112 hallazgos en un cuadro). La regla de principio: un texto por debajo del mínimo en el cuadro revisado que, **dentro de la misma escena**, se ve en **otro cuadro** (antes o después) con tamaño en pantalla >= mínimo mientras es visible (opacidad >= `minOpacity` y el centro dentro del cuadro) es un *detalle que se lee al acercar*: `info`, con **una sola línea resumen por cuadro** (`N textos por debajo del mínimo a este zoom que se leen al acercar ...`) y una línea final `info: N textos ... se leen al acercar` en la salida (siempre visible; `--verbose` muestra cada cuadro). Un texto que en ningún cuadro mirado de su escena llega al mínimo sigue siendo `error`. "Mismo texto" es la misma clave (ruta DOM + etiqueta + testid + texto); "misma escena" es la escena con nombre más chica que contiene el cuadro (o todo el video si no declara escenas). Para saber si se lee en otro cuadro se miran `min-size.probeFrames` cuadros (24) repartidos en la escena, más los muestreados, con una recolección liviana que mide solo esos textos: es un muestreo, así que un acercamiento más breve que el paso entre cuadros mirados puede no verse (`--set min-size.probeFrames=60`); `--set min-size.probeFrames=0` lo apaga y todo texto chico vuelve a ser error. La clasificación vive en `qa/zoom.ts` (`reclassifyDetail` es una función pura con prueba) y el resumen en `summary.detailSmallText` del informe JSON.

**Texto SVG.** `contrast` pinta el texto con su color real: en HTML `-webkit-text-fill-color` (que sigue a `color`); en SVG (`<text>`, `<tspan>`) `fill` con `fill-opacity` y, si el relleno es `none`, el trazo (`stroke`). Un degradado o patrón (`url(#...)`) se trata como relleno transparente (no se juzga), como el texto con degradado en HTML. Antes se leía el `color` CSS del `<text>` y el centro de un anillo con `fill` oscuro dentro de una tarjeta con `color` claro daba 1.01:1.

**Tapas invisibles.** `covered` ignora como tapa a un `img`, `video` o `canvas` con opacidad efectiva (propia o heredada) menor a 0.9 y a todo elemento con `visibility:hidden`; un `div` con fondo ya contaba la opacidad. Antes un `canvas` con `opacity:0` (la capa de una animación que todavía no entró) figuraba como tapa opaca.

**Movimiento.** Cada cuadro se compara con el anterior y el siguiente (f-1 y f+1 se renderizan de verdad, aunque se muestree con `--count`): si un texto (o el elemento que lo tapa) se desplaza mas de `motion.px` (12 px a 1080p; `--set motion.px=N`) entre cuadros, `offscreen` y `min-size` bajan a `info` (camaras, tarjetas volando, textos que salen). Para dos elementos que **se cruzan** el umbral es menor, `motion.crossPx` (4 px): `overlap`, `covered` y `contrast` bajan a `info` si alguno de los dos se mueve mas que eso (una tarjeta que vuela sobre otras, un texto que entra sobre un fondo que cambia). Lo quieto (0 px) sigue siendo error. Un texto se empareja con su vecino por ruta del DOM; si la ruta cambio (un hermano que se monta corre los indices) se empareja por etiqueta + testid + texto cuando es unico. Los defectos estaticos siguen siendo errores. El texto bajo una capa opaca de cuadro completo no cuenta para las reglas geometricas (evita ruido en un cambio de escena), pero `covered` lo informa (ver arriba). Tambien se mide el cambio de opacidad (`fade`) para distinguir un fundido de texto quieto en `contrast`.

**`offscreen`: por que error, aviso o info.** El mensaje dice cual fue el motivo. En orden:

1. **info** si el texto se mueve entre cuadros vecinos (mas de `motion.px`): camara en paneo o zoom, tarjeta volando; entra o sale del cuadro.
2. **error** si no hay camara/zoom que lo explique: el texto desborda el borde. Arreglo: moverlo adentro, achicarlo o acortarlo.
3. **info** si es una rebaba chica (<= `sliverPx`, 6 px) bajo camara/zoom y la camara se mueve (el texto se desplaza mas de `cameraPx`, 1 px, entre cuadros): se acomoda sola. Con la camara quieta, la misma rebaba es error.
4. Bajo camara/zoom y quieto:
   - recorte chico (<= `slipPct` %): **error** (rebaba de encuadre). Arreglo: correr unos px o ajustar la camara.
   - recorte grande y el texto **aparece o se apaga** (su opacidad cambia entre cuadros) con la camara quieta: **error** ("la camara esta quieta en este cuadro"): la persona lo ve entrar ya cortado. Arreglo: moverlo dentro del cuadro, o hacerlo aparecer despues, cuando la camara ya se alejo.
   - recorte grande y estable: **aviso** (parece un encuadre a proposito, p. ej. la camara sostiene una parte de un diseno mas grande). Si lo es, `data-qa-ignore="offscreen"`.

**Informe.** Se agrupa por regla y elemento: una linea por elemento, `SEV cuadros "extracto" [data-testid o etiqueta@ruta-DOM]: mensaje`, con los cuadros comprimidos (`78–143, 260`). Al final una linea con errores/avisos/info. `info` queda oculto salvo `--verbose`; `--max N` (40 por defecto) corta la lista con `… N más`. Codigo de salida segun `--fail-on error|warn`.

## Silenciar un falso positivo

Poner `data-qa-ignore` en el elemento o en cualquier ancestro. El valor es una lista de ids de regla (`clip offscreen safe-area overlap min-size contrast covered`) separados por espacios (o comas), o `all`:

```tsx
<div data-qa-ignore="offscreen safe-area">...</div>   {/* varias reglas */}
<div data-qa-ignore="all">...</div>                    {/* todas */}
```

En `covered` tambien vale el atributo en el elemento que tapa. Preferir ajustar el umbral con `--set` si el caso es general.

**Callar se ve.** Al final, `ve-qa` imprime cuántos hallazgos callaron `data-qa-ignore` y `data-qa-decor` por regla (`callados (no cuentan arriba): contrast: 3 por data-qa-ignore, 12 por data-qa-decor; ...`); en el JSON, `summary.silenced`. Se calcula corriendo las reglas otra vez sin las marcas y comparando, así que un silencio nunca es invisible.

**Texto coloreado solo como código redundante** (un número pintado por estado al lado de su rótulo, que no llega al contraste): es una decisión de diseño y `qa` no la trata aparte. La forma de aceptarla es `data-qa-ignore="contrast"` en ese elemento **con un comentario** que diga por qué (`{/* el estado también lo dice el rótulo */}`); el conteo de callados la deja a la vista.

## Adorno de interfaz recreada: `data-qa-decor`

Un tablero recreado trae mucho texto que es marco y no mensaje (menús, pestañas, barras, columnas que no se leen). Marcar el elemento (o un ancestro) con `data-qa-decor` en vez de poner varias familias de `data-qa-ignore`:

```tsx
<div data-qa-decor>{/* barra lateral y encabezados de la interfaz recreada */}</div>
<div data-qa-decor="main">{/* adorno que ES el contenido principal del cuadro */}</div>
```

- **Fuera de `min-size` y `contrast`.** El texto de adorno no se juzga ahí. No desaparece: `ve-qa` imprime una línea `info` con cuántos textos de adorno quedaron afuera (`summary.decor`).
- **Siguen aplicando** `clip` (un rótulo cortado se ve mal esté o no en un adorno) y `overlap` cuando el adorno pisa un texto que **no** es de adorno (adorno contra adorno no se juzga).
- **`offscreen`** solo aplica si el adorno está marcado `data-qa-decor="main"`, es decir, si es el contenido principal del cuadro; un adorno que la cámara recorta no da hallazgos.
- `safe-area` y `covered` no cambian.
- El texto que lleva un mensaje (cifras, títulos, rótulos que la persona tiene que leer) **no** va en un adorno: ahí `min-size` y `contrast` hacen su trabajo.

Los casos sembrados y sus contrapuntos estrictos están en `qa-defects` (cuadros 69 a 75).

## Privacidad (`ve-privacy`)

Recolecta el texto renderizado en los cuadros y las cadenas de `--props`. Falla si aparece un termino de `--deny`, un correo, un numero tipo telefono, o un dominio que no sea `example.com/.org/.net`, `.test`, `.example`, `.invalid`, `localhost` ni este en `--allow`.

**Que se mira en pantalla.** (1) Cada nodo de texto y los atributos `alt`, `title`, `aria-label`, `placeholder`, `value`. (2) El texto de cada bloque (elementos que no son en linea) y el `innerText` del escenario, con los espacios colapsados: un correo o un termino armado con spans (`<span>acme</span><span>@...`) no esta en ningun nodo suelto pero si en el bloque; no se buscan telefonos ahi (los numeros de bloques vecinos se pegarian). (3) Esos mismos bloques sin espacios, solo para terminos de la deny-list de 4 o mas caracteres: atrapa texto con un span por letra o por palabra (efectos de `fx/text`).

Lo que sale **solo** del texto pegado (no esta en ningun nodo entero) se informa con otro tipo, `DENY-JOINED`, y el mensaje lo explica. Reglas del texto pegado: no cruza limites de bloque ni `<br>` (cada bloque se mira por separado; los items de un flex/grid cuentan como una misma linea, para el texto con una letra por item) y la coincidencia tiene que **empezar y terminar en limite de palabra**. Asi el termino `mercado pago` ya no sale de "Supermercado" + "Pagó ..." de dos elementos, pero `Mercado` + `Pago` en spans de una misma linea, o un termino con una letra por span, siguen detectandose.

**Formato de las listas.** Un termino o `/regex/flags` por linea; `#` comenta. Los terminos se comparan plegados: sin mayusculas, acentos ni diacriticos, con NFKD (letras de ancho completo, ligaduras), sin caracteres invisibles (ancho cero, joiners, marcas bidi, guion blando U+00AD) y con ø/đ/ł/ß/æ/œ llevadas a su equivalente ASCII. Asi `Ac\u200Bme`, `ＡＣＭＥ` y `Gløbex` no esquivan la lista.

**Coincidencia.** En el **codigo fuente** (`--scan-source`) los terminos se buscan como subcadena, para atrapar identificadores (`AcmeClient`, `GlobexCloud`, `ACME_KEY`). En **pantalla** tambien son subcadena, salvo los terminos de menos de 4 letras, que exigen palabra entera (`ana` no coincide con `banana`; el costo es algun falso positivo con terminos largos, p. ej. `norte` dentro de `nortena`: ajustar la lista o usar `--allow`). Las regex se aplican al texto plegado, siempre con la bandera `u` (`\p{L}` funciona); un patron invalido es un error claro, no un literal. Para acotar una regex patologica (ReDoS) el texto se le pasa por ventanas de 10 000 caracteres; igual conviene evitar cuantificadores anidados. Con `--allow`, cualquier correo/dominio/telefono que contenga una entrada permitida se acepta.

**Que NO se ve: texto dentro de `canvas`.** El texto dibujado con `fillText` no esta en el DOM y no se escanea. Ese texto sale de props o de codigo: pasar las props reales con `--props` (se escanean todas sus cadenas) y revisar el codigo con `--scan-source`. Tampoco se lee texto dentro de imagenes (`img`, `svg` como imagen) ni de `video`.

`--scan-source <dir>` (repetible) busca en el codigo fuente los mismos terminos, correos y dominios que aparezcan como URL (los telefonos no se buscan en codigo). Recorre estas extensiones: `.ts .tsx .mts .cts .js .jsx .mjs .cjs .json .jsonc .md .mdx .txt .css .scss .html .htm .svg .yml .yaml .toml .ini .cfg .conf .env .sh .bash .zsh .ps1 .py .xml .csv .srt .vtt .graphql .sql` y cualquier archivo `.env`, `.env.*` o `*.env`; salta `node_modules`, `dist`, `out`, `.git`, `.ve-cache` y archivos de mas de 2 MB. **No escanea las listas**: salta el archivo pasado a `--deny` y el de `--allow` (se comparan por ruta real, tambien si se llega por un enlace) y cualquier archivo que se llame `prohibidos.txt`; asi `--deny videos/<slug>/prohibidos.txt --scan-source videos/<slug>` no se reporta a si mismo. Lee linea por linea: un termino partido en dos lineas no se detecta. En pantalla solo cubre los cuadros muestreados: usar `--every` bajo para videos con mucho texto que cambia.

## Antes de mostrar una escena a una persona

1. `ve-sheet <id> --count 12` y mirar la hoja.
2. `ve-qa <id> --count 40`; corregir errores; revisar avisos.
3. `ve-privacy <id> --deny prohibidos.txt --scan-source stories/`.
4. Reciclar solo con `data-qa-ignore` lo que se haya decidido a proposito.

## API

`import { runQa, makeSheet, runPrivacy } from '../qa'` (`qa/index.ts`):

- `runQa({videoId, frames|every|count, props, rules, thresholds, concurrency})` -> `{findings, summary}`.
- `makeSheet({videoId, frames|every|count, cols, scale, out, labels})` -> `{out, frames, width, height}`.
- `runPrivacy({videoId?, deny, allow?, scanSource?, ...})` -> `{ok, findings, ...}` (`deny`/`allow` son el contenido de las listas).

Las reglas son funciones puras sobre datos (`qa/rules/*.ts`); la recoleccion dentro de la pagina esta en `qa/collect.inpage.js` (JS plano, sin transpilar); el muestreo de fondos (decodificar PNG, mediana por caja) esta en Node, `qa/png.ts`. El video `qa-defects` (`examples/qa-defects/`) siembra un defecto por cuadro: 0 limpio, 1 `clip`, 2 `offscreen`, 3 `overlap`, 4 `min-size`, 5 `contrast`, 6 `covered`, 7 correo y dominio. Los cuadros 69-75 cubren `data-qa-decor` y el conteo de callados (cada uno con su contrapunto estricto). Los cuadros 8-14 son NO defectos que no deben dar errores: lavado a pantalla completa (se informa como `info`, 8), tarjeta volando sobre texto (9-10), texto decorativo tenue (11) y texto que sale del cuadro en movimiento (12-14). Los cuadros 19-21 son NO defectos: texto claro sobre un bloque de acento bajo un velo de cuadro completo cuya opacidad cambia de un cuadro al siguiente (0.45, 0.55, 0.65): `contrast` da `info`. Los cuadros 22-24 mantienen el MISMO velo quieto (0.55): el cuadro 23 (con vecinos identicos) es un error de `contrast` ("velo QUIETO"). Los cuadros 25-54 emparejan cada indulgencia nueva con su contraparte estricta (la misma situacion pero quieta, que sigue dando error): fundido lento al final de un easing (26) frente al mismo texto quieto al 51 % (29); texto oscuro que cruza una banda oscura (32) frente al quieto (35); dos textos que se cruzan a 6 px por cuadro (38) frente a los quietos (41); pastilla opaca que se desliza sobre un texto (44) frente a la quieta (47); rebaba de 5 px bajo una camara que se mueve (50, `info`) frente a la camara quieta (53, `offscreen` error). Los cuadros 55-56 son para la privacidad con el termino `mercado pago`: dos elementos distintos ("Supermercado" y "Pagó ...", 55: sin coincidencia) y el termino en una linea de spans (56: `deny-joined`). Los cuadros 57-62 emparejan el detalle que se lee al acercar con su contraparte estricta: el mismo texto chico en el plano general (57, `info`, con el resumen) y legible acercado (59), frente a un texto chico que nunca se lee (61, `min-size` error); 58, 60 y 62 son cuadros limpios para que los vecinos no parezcan movimiento. Los cuadros 63-65 son texto SVG en un anillo: `fill` oscuro con `color` CSS claro (63, sin hallazgo), `fill` claro sobre fondo claro con `color` oscuro (64, `contrast` error) y solo trazo (65, sin hallazgo). Los cuadros 66-68 son tapas invisibles: un `canvas` con `opacity:0` y un bloque `visibility:hidden` sobre un texto (66) y un `canvas` bajo un ancestro con `opacity:0` (67) no dan nada; el mismo `canvas` visible (68) es un `covered` error. Los cuadros 15-17 son defectos que las primeras reglas no veian y deben dar error: texto quieto al 50 % de opacidad con bajo contraste compuesto (15, `contrast`), tira con degradado sobre el costado izquierdo de una linea con el centro libre (16, `covered`) y texto quieto oculto por completo bajo una tarjeta (17, `covered`).

## Limitaciones conocidas

- El runtime se compila con el `ensureBundle` compartido de `render/` (`.ve-cache/bundles/<hash>`).
- El texto bajo un `Wash` a medio fundido ya era `info` (ver `contrast`: lo comprueba el cuadro 20 de `qa-defects`); si el lavado esta quieto, no. Un campo de elementos de fondo que sangra por el borde del cuadro (p. ej. chips) cuenta como `offscreen`; silenciarlo con `data-qa-ignore="offscreen safe-area"` en el contenedor.
- No mide texto dentro de `canvas`/imagenes; el contraste omite texto con relleno transparente; una cobertura por elementos translucidos (vinetas) no cuenta como `covered`, pero un degradado o imagen de fondo con opacidad >= 0.9 si (se asume opaco).
- El movimiento y el fundido se miden contra los cuadros vecinos (f-1, f+1); un texto se empareja con su vecino por ruta del DOM + etiqueta + testid + texto, salvo los contadores (texto solo numerico, p. ej. `CountUp`), que se emparejan sin el texto: un fundido de menos de 0.003 de opacidad por cuadro se toma como texto quieto (el tramo final de un easing, 0.01 por cuadro, ya cuenta como fundido: se juzga por su color; un texto fijo al 50 % cambia exactamente 0 y se juzga con su opacidad compuesta).
- El velo (`veil`) se detecta en el centro de la primera linea de cada texto: un velo que cubre solo una parte del cuadro, o uno que se desmonta de un cuadro a otro, se trata como transicion si cambia de opacidad entre cuadros vecinos (un velo que no existe en el vecino cuenta como opacidad 0).
- Las propiedades CSS individuales `scale`/`rotate` no entran en la escala medida (solo `transform`).
- Durante una transicion (tarjeta volando sobre otra, camara en movimiento) las reglas `overlap`/`covered`/`offscreen` pueden saltar a proposito: se juzga mirando la hoja.
