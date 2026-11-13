# kit

Kit de movimiento reutilizable sobre `engine/` y `themes/`. Todo sale de `kit/index.ts`.

## Regla de pureza

Cada pieza es una función pura del cuadro (de `useFrame()` o de una prop `frame` explícita) y del tema (`useTheme()`). La lista completa está en `docs/reglas.md` ("Lista única de determinismo"): nada de estado que acumule, temporizadores, animaciones CSS, `useId` ni `Math.random` (se usa `random(seed)` del motor). Colores, tipografías, radios, sombras y curvas salen del tema: ninguna pieza trae valores de marca. `__ve.checkDeterminism` debe dar `ok` en las escenas que las usan.

## Piezas

- **Ayudas**: `kf(frame, claves, valores, easing?)` cuadros clave; `track(frame, [[f, x, y], ...])` trayectos 2D; `typed(texto, frame, inicio, cps)` texto que se escribe.
- **Cámara**: `cameraAt(frame, claves, opts?)` devuelve `{x, y, scale, rx, ry, blur}` con inclinación y desenfoque según la velocidad (cámara quieta = sin inclinación ni desenfoque; topes configurables). `<World camera width height>` aplica la transformación y el desenfoque a sus hijos (coordenadas del mundo). `zoomThrough(frame, [ini, fin], cam, objetivo, power?)` convierte la cámara en un atravesado de un punto (se pasa por `opts.map`). `<Wash frame range color?>` velo de cierre de escena.
- **Cursor y viñeta**: `<Cursor frame keys clicks show>` con onda de clic en el acento; `<Vignette amount color? strength?>` (acento por defecto; `color` es un rol del tema o `data.<nombre>`).
- **Profundidad**: `flyInZ(progress, { from, perspective, x, y, rotateX, rotateY, fade })` devuelve el `style` de una entrada en profundidad para un elemento (ver abajo).
- **Garabatos** (trazo a mano que "hierve": el temblor se vuelve a sortear cada `boil` cuadros, 3 por defecto): `<DoodleCircle>`, `<DoodleArrow>`, `<DoodleUnderline>`; se dibujan y se desvanecen por cuadro; el trazo usa acento → acento 2 del tema. Cada uno necesita un `id` único.
- **Texto y fondo**: `<GradientText>` (degradado del tema, `pan` o `loop` opcionales), `<CloudBackground>` (manchas de `theme.cloud`, con `colors`, `count`, `seed`, `blobs`, `opacity` y `blur` para pisarlas), `<CountUp from to start duration format?>`.
- **Titular**: `<DockedHeadline index title subtitle frame start hide layout>` y `hideFromScale(scale, umbral?, rango?)` para que se aparte cuando la cámara se acerca.
- **Vuelo**: `flight(frame, [ini, fin], from, to, {arc})` y `<FlyingCard>` (arco y estela).
- **Tema por ámbito**: `<ThemeScope theme paint? style?>` cambia el tema de un subárbol (se anida); con `paint` pinta fondo, texto y tipografía del tema; declara el `@font-face` de sus fuentes y espera su carga. Ver `themes/README.md`.
- **Escena**: `<Stage>` fondo, tipografía y nubes opcionales del tema.

## Referencia de firmas

Props exactas de las piezas que más se usan (todas aceptan `frame?` para fijar el cuadro; sin él leen el del motor). Los `?` son opcionales y `=` marca el valor por defecto.

| Pieza | Props | Notas |
|---|---|---|
| `DockedHeadline` | `index: number`, `title: string`, `subtitle?: string`, `start = 0`, `hide = 0`, `layout = "stacked"`, `size = "md"`, `gradientLoop?` | Píldora fija en pantalla (fuera de `World`), en `left = theme.safe.x / 2`, `top = theme.safe.y / 2`. `index` es el número que se muestra (`01`, `02`...; empieza en 1 porque se muestra tal cual). Entra en `start..start + 18`; `hide` (0 a 1) la aparta: pasale `hideFromScale(cam.scale)`. `layout="inline"` pone título y subtítulo en una línea ("04 Nombre · línea"); `"stacked"` (por defecto) apila el subtítulo. `size="sm"` achica letra, huecos y relleno al 85 %. `gradientLoop` (cuadros) hace vaivén el degradado del número. |
| `hideFromScale` | `(scale, threshold = 1, range = 0.08)` | 0 con escala 1, 1 desde `1,08`. |
| `FlyingCard` | `range: [ini, fin]`, `from: {x, y}`, `to: {x, y}`, `arc = 0`, `width`, `height`, `trail = 5`, `trailLag = 1.5`, `hideBefore = true`, `hideAfter = false`, `children` | `from`/`to` son el **centro** de la tarjeta; los hijos se dibujan en `width x height` centrados ahí. Antes de `range[0]` no se dibuja (`hideBefore`; con `hideBefore={false}` espera en `from`), y después de `range[1]` queda en `to` (`hideAfter` la oculta): la tarjeta "real" del origen sigue ahí hasta que arranca el vuelo, y mientras vuela dejá un hueco punteado. `arc` en px, el signo elige el lado. |
| `Cursor` | `keys: [cuadro, x, y][]`, `clicks?: number[]`, `show: [ini, fin]` | Coordenadas del mundo (va dentro de `World`). La última parada antes de cada clic, 2 cuadros antes. `show` más largo que 20 cuadros hace fundido de 10 al entrar y al salir. |
| `DoodleCircle` | `id`, `start`, `end = 99999`, `cx`, `cy`, `rx`, `ry`, `boil = 3`, `width = 5` | Elipse centrada en `(cx, cy)`. `end` es el cuadro donde empieza a desvanecerse (dura 10). |
| `DoodleArrow` | `id`, `start`, `end`, `x1`, `y1`, `x2`, `y2`, `bend = 0.25`, `boil = 3`, `width = 6` | De `(x1, y1)` a `(x2, y2)` con la punta en el segundo; `bend` curva el trazo (el signo elige el lado). |
| `DoodleUnderline` | `id`, `start`, `end`, `x`, `y`, `length`, `boil = 3`, `width = 5` | Raya horizontal desde `(x, y)` hacia la derecha. |
| `Wash` | `range: [ini, fin]`, `color?` | Velo de cuadro completo (color del fondo del tema por defecto). Va fuera de `World`, al final del contenido. Lleva `data-qa-veil` para que `qa` lo trate como transición. |
| `ThemeScope` | `theme: Theme`, `paint = false`, `style?`, `children` | Cambia el tema de un subárbol. Con `paint`, pinta una superficie (el `style` le da posición, tamaño, radio y sombra). Ver `docs/guia-escenas.md`, sección 10. |
| `World` | `camera`, `width`, `height`, `perspective = 2400`, `children` | `width`/`height` del formato (`useFormat()`), no 1920x1080 escritos a mano. |
| `Stage` | `clouds = true`, `cloudOpacity?`, `cloud?: CloudOptions`, `children` | Fondo, tipografía y nubes del tema. `cloud` (`colors`, `count`, `seed`, `blobs`, `opacity`, `blur`) pisa lo que declara `theme.cloud` solo en esa escena. |
| `CloudBackground` | `colors?`, `count?`, `seed?`, `blobs?`, `opacity?`, `blur = 110`, `width?`, `height?` | Cada propiedad pisa a `theme.cloud`. `colors` y `blobs[].color` aceptan roles (`"accent2"`, `"data.estado"`, `"chart[2]"`) o colores del tema. `blobs: { x, y, size? }[]` (x, y en fracciones del cuadro) reemplaza el reparto sembrado. |
| `Vignette` | `amount: number` (0 a 1), `color = "accent"`, `strength = 1` | Oscurece los bordes; usala con el zoom. `color`: rol del tema (`"bg"`, `"text"`, `"data.x"`) o color sacado del tema; en una interfaz oscura, `color="bg"` y un `strength` bajo evitan teñirla. Opacidad del borde: `0,22 * strength * amount`. |
| `flyInZ` | `(progress, { from = 900, perspective = 1400, x, y, rotateX, rotateY, fade = true })` | Devuelve un `style` (no un componente). Ver "Entrada en profundidad". |
| `CountUp` | `from = 0`, `to`, `start`, `duration`, `format?`, `style?` | Número que cuenta. |
| `GradientText` | `children`, `pan = 0`, `loop?`, `style?` | Texto con el degradado del tema. `loop` = cuadros de un vaivén completo (vuelve exacto al terminar el ciclo); `pan` = velocidad sin ciclo exacto. Ambos salen del cuadro. |

## Entrada en profundidad: `flyInZ`

La profundidad real (`preserve-3d`, `perspective` en un ancestro) está prohibida por determinismo, así que un panel que "llega volando" se hace con la perspectiva propia de cada elemento:

```tsx
const p = kf(frame, [10, 40], [0, 1]);
<div style={{ position: "absolute", left: 120, top: 190, ...flyInZ(p, { from: 800, x: 140, y: 60 }) }}>{/* panel */}</div>
```

- `progress` va de 0 (lejos, invisible con `fade`) a 1 (en su lugar); curvá el progreso con el easing del tema en `kf`.
- Devuelve `transform: perspective(P) translate3d(x, y, -from) ...` para ese elemento, sin `preserve-3d` ni perspectiva en el ancestro; el layout (`left`/`top`) lo ponés vos en enteros y todo el movimiento va en el `transform`.
- Al llegar (`progress >= 1`) devuelve `{}`: sin `transform` ni `opacity` residuales (la causa más frecuente de que falle `--check`).
- `|from|` tiene que ser menor que `perspective` (si no, el elemento quedaría detrás de la cámara y lanza un error). `from` negativo hace que llegue desde adelante.
- No lo uses en piezas que se cruzan en profundidad: ordená con `zIndex`. Cubierto por `--check` en `examples/kit-demo` (las tarjetas de estadística).

## Precondiciones

- `kf`: `keys` estrictamente creciente (2 o más claves, o una sola = valor fijo); si no, lanza el error del motor.
- `cameraAt`: al menos una clave; `f` estrictamente creciente (si no, lanza un error que nombra los cuadros). Una clave = cámara fija.
- Casos degenerados que NO fallan: `Cursor` con una sola clave (fijo) o `show` corto (el fundido se acorta); `CountUp` con `duration` 0 (salta a `to`); `Wash`, `flight` y `zoomThrough` con inicio = fin (escalón).
- `Doodle*`: `id` único por garabato (se sanea para el degradado: solo letras, números, `_` y `-`).
- `Stage` declara `@font-face` con el primer nombre de `theme.font.family` (sin comillas) para los archivos de `theme.font.files`.
- `World` usa transformación 2D cuando no hay inclinación (`rx = ry = 0`) y emite `scale(...)` solo mientras la escala no es 1 (con la cámara quieta en escala 1 y sin inclinación no queda `scale(1)` ni `perspective`; lo prueba `kit/rest.test.tsx`); con inclinación, agrega `perspective(P) rotateX() rotateY()` dentro del `transform` del propio elemento (sin `perspective` ni `preserve-3d` en un ancestro, con `left`/`top` enteros y todo el movimiento en el `transform`; el mismo patrón que `rigTransform` de `stories/`). El mundo se inclina como un plano, así que los hijos no se cruzan en profundidad. Esto evita capturas no idénticas según el historial de cuadros (ver `docs/reglas.md`).

## Uso mínimo

```tsx
import { Stage, World, cameraAt, DockedHeadline, hideFromScale, Wash } from "../../kit";
import { ThemeProvider, neutral } from "../../themes";
import { useFrame } from "../../engine";

const KEYS = [{ f: 0, x: 960, y: 540, scale: 1 }, { f: 60, x: 400, y: 300, scale: 1.8 }];

function Scene() {
  const frame = useFrame();
  const cam = cameraAt(frame, KEYS);
  return (
    <Stage>
      <World camera={cam} width={1920} height={1080}>{/* contenido en coordenadas del mundo */}</World>
      <DockedHeadline index={1} title="Título" hide={hideFromScale(cam.scale)} />
      <Wash range={[80, 90]} />
    </Stage>
  );
}

export const Video = () => <ThemeProvider theme={neutral}><Scene /></ThemeProvider>;
```

`Cursor` ubica la flecha en píxeles enteros (`left`/`top` redondeados): con un `scale()` en un ancestro, una posición fraccionaria hacía fallar `--check`.

Ejemplos: `examples/theme-scope` (cambio de tema por ámbito). Ejemplo completo: `examples/kit-demo` (`/?video=kit-demo&props={"theme":"dark"}`).
