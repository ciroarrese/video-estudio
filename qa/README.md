# qa

Control de calidad automatico: revisa cuadros del video en Chromium **antes** de mostrarselo a una persona. Detecta los defectos de maquetacion que antes se encontraban a ojo: etiquetas cortadas, textos que se pisan, un titular que tapa contenido, letra chica, bajo contraste y datos privados en pantalla.

Se usa desde un clon del repo (como `ve-render`); necesita Chromium de Playwright. Compila el runtime con vite la primera vez (`.ve-cache/qa-bundles/`).

## Comandos

```bash
npx ve-sheet kit-demo --count 12                    # hoja de cuadros: out/kit-demo-sheet.png
npx ve-sheet hello --frames 0,60,120 --cols 3 --scale 0.4
npx ve-qa kit-demo                                  # 24 cuadros repartidos
npx ve-qa mi-video --frames 30-90/10 --fail-on warn --json out/qa.json
npx ve-privacy mi-video --deny prohibidos.txt [--allow permitidos.txt] [--scan-source stories/]
```

(Tambien `npm run qa|sheet|privacy -- <id> ...`.) Codigo de salida: 0 limpio, 1 hay hallazgos (`ve-qa`: errores, o avisos con `--fail-on warn`), 2 uso incorrecto.

Seleccion de cuadros (igual en los tres): `--frames 0,60,120` (admite `10-40/10`), `--every N` o `--count N`. `--props '{...}'` mezcla props con las del video.

## Reglas de `ve-qa`

Cada regla tiene id, severidad y umbrales. Se cambian con `--set regla.umbral=valor` (repetible), se eligen con `--rules a,b` o se apagan con `--skip a`. Valores por defecto en `qa/thresholds.ts`.

| Regla | Que detecta | Severidad | Umbrales (por defecto) |
|---|---|---|---|
| `clip` | Texto cortado: el elemento desborda con `overflow` oculto/elipsis, o una linea queda parcialmente fuera de un ancestro con overflow oculto. Lo totalmente oculto no cuenta. | error | `tolerancePx` 1.5, `minHiddenFraction` 0.02 |
| `offscreen` | Texto visible que sale solo en parte del cuadro. Totalmente afuera, casi transparente (<0.05) o gigante (zoom que atraviesa, > `maxFrames` veces el cuadro) se ignora. Bajo una camara/zoom, un recorte grande (> `slipPct` %) es aviso (es un paneo); una rebaba chica es error. | error / warn | `tolerancePx` 1, `slipPct` 15, `maxFrames` 2 |
| `safe-area` | Texto dentro del cuadro pero fuera del area segura. No se evalua bajo camara/zoom. | warn | `margin` 0.03 (por lado) |
| `overlap` | Dos textos de elementos distintos (no ancestro/descendiente) cuyas cajas se pisan mas de `ratio` del menor. Las cajas se achican en vertical (`inkHeight` 0.75) porque la caja de linea es mas alta que la tinta. Ignora pares con uno casi transparente. | error | `ratio` 0.2, `minOpacity` 0.3 |
| `min-size` | Tamano en pantalla (tamano CSS x escala acumulada de las transformaciones, o sea, cuenta la camara) menor al minimo, escalado con el alto del cuadro. | error | `minPx1080` 18, `tolerancePx` 0.5 |
| `contrast` | Color del texto (por la opacidad) contra el fondo real: mediana de los pixeles bajo la caja en una captura con el texto oculto. Razon WCAG (`themes/contrast.ts`) < 3 error; < 4.5 aviso si el texto es chico. Texto con relleno transparente (gradiente) se omite. | error / warn | `error` 3, `warn` 4.5, `largePx1080` 24, `minOpacity` 0.6 |
| `covered` | El centro del texto queda bajo un elemento opaco (fondo solido, `img`, `video`, `canvas`) que no es ancestro ni descendiente, p. ej. una pastilla encima. | error | `minOpacity` 0.5 |

Los textos con opacidad baja (fundidos) se ignoran segun cada regla, asi que conviene muestrear cuadros donde la escena ya se asento. Todo se mide con rectangulos de pantalla (`Range.getClientRects`), por lo que respeta transformaciones 2D/3D; una rotacion se aproxima por su caja envolvente.

El informe agrupa por regla; el mismo hallazgo en varios cuadros sale una vez con la lista de cuadros. Cada elemento se describe con etiqueta, `data-testid` mas cercano, extracto del texto y caja `[x,y ancho x alto]`.

## Silenciar un falso positivo

Poner `data-qa-ignore="regla"` en el elemento o en cualquier ancestro (varias separadas por coma/espacio, o `all`):

```tsx
<div data-qa-ignore="overlap,covered">...</div>
```

En `covered` tambien vale el atributo en el elemento que tapa. Preferir ajustar el umbral con `--set` si el caso es general.

## Privacidad (`ve-privacy`)

Recolecta todo el texto renderizado en los cuadros (nodos de texto y `alt`, `title`, `aria-label`, `placeholder`, `value`) y las cadenas de `--props`. Falla si aparece un termino de `--deny`, un correo, un numero tipo telefono, o un dominio que no sea `example.com/.org/.net`, `.test`, `.example`, `.invalid`, `localhost` ni este en `--allow`.

Formato de las listas: un termino o `/regex/flags` por linea; `#` comenta. Los terminos ignoran mayusculas y acentos y respetan limites de palabra (`ana` no coincide con `banana`); las regex se aplican al texto sin acentos y en minusculas. Con `--allow`, cualquier correo/dominio/telefono que contenga una entrada permitida se acepta.

`--scan-source <dir>` (repetible) busca en el codigo fuente los mismos terminos, correos y dominios que aparezcan como URL (los telefonos no se buscan en codigo). Solo cubre los cuadros muestreados: usar `--every` bajo para videos con mucho texto que cambia.

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

Las reglas son funciones puras sobre datos (`qa/rules/*.ts`); la recoleccion dentro de la pagina esta en `qa/collect.inpage.js` (JS plano, sin transpilar). El video `qa-defects` (`examples/qa-defects/`) siembra un defecto por cuadro: 0 limpio, 1 `clip`, 2 `offscreen`, 3 `overlap`, 4 `min-size`, 5 `contrast`, 6 `covered`, 7 correo y dominio.

## Limitaciones conocidas

- `render/` no exporta su `ensureBundle`, asi que `qa/bundle.ts` hace una version minima propia (hash de ruta+tamano+mtime). Si `render/` la exporta, conviene reusarla.
- No mide texto dentro de `canvas`/imagenes; el contraste omite texto con relleno transparente; una cobertura por elementos translucidos (vinetas, degradados) no cuenta como `covered`.
- Las propiedades CSS individuales `scale`/`rotate` no entran en la escala medida (solo `transform`).
- Durante una transicion (tarjeta volando sobre otra, camara en movimiento) las reglas `overlap`/`covered`/`offscreen` pueden saltar a proposito: se juzga mirando la hoja.
