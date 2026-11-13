# Guía de escenas

Cómo se escribe una escena de este toolkit. Antes leé `docs/reglas.md` (las reglas y sus motivos), `kit/README.md` (las piezas) y `engine/README.md` (la regla de determinismo). Antes de escribir una animación a medida, mirá el catálogo de efectos listos en `docs/animaciones.md`. Para arrancar copiá la plantilla: `bash templates/nuevo.sh escena <slug> <nombre>`. Las firmas exactas de las piezas están en la tabla de `kit/README.md`; dónde poner cada cosa en el cuadro y cuánto acercar la cámara, en la sección 13.

## 1. Lo básico

Un video es una función del número de cuadro. Una escena:

- lee el cuadro con `useFrame()` (o recibe `frame` por props) y el tema con `useTheme()`;
- devuelve React puro: sin estado que acumule, sin temporizadores, sin azar suelto (`random(seed)`), sin animaciones CSS;
- calcula cada valor animado con `kf` (cuadros clave) o `interpolate`, nunca guardándolo.

Formato por defecto: 1920×1080, 30 fps. Un tema (`useTheme()`) trae `color`, `font`, `radius`, `shadow`, `type` (tamaños en px, con `type.display` para textos grandes intermedios y la subescala `type.ui` para interfaces recreadas), `safe` (área segura), `motion`, `cloud` y `data` (colores con nombre propios del video: `useTheme().data.estado`, sin `#hex` en la escena; se declaran con `themeFromTokens(tokens, base, { data })`, ver `themes/README.md`).

`theme.type` (valores de `neutral` y de `dark`; un tema armado desde tokens parte de ellos): son tamaños de letra en píxeles del cuadro, iguales en todos los formatos.

| Clave | px | Para qué |
|---|---|---|
| `hero` | 120 | título de apertura, cifra o palabra que ocupa el cuadro |
| `h1` | 96 | nombre de tema, título de sección |
| `h2` | 72 | subtítulo grande, firma de cierre |
| `body` | 44 | texto corrido, rótulo de panel |
| `caption` | 32 | filas, botones, titular fijo; es el escalón "grande" de una interfaz recreada |
| `eyebrow` | 26 | rótulos chicos, encabezados de columna; el piso para algo que no se acerca |
| `stat` | 180 | cifra de un indicador (se usa multiplicada: `type.stat * 0.6` en una tarjeta) |
| `ui.md` / `ui.sm` / `ui.xs` | 24 / 20 / 15 | **solo** texto de una interfaz recreada que se lee con la cámara acercada (tablas densas, fichas, menús); en pantalla completa usá los escalones de arriba |

`theme.safe` es `{ x: 140, y: 110 }`: el margen seguro es la mitad por lado (70 px a los costados y 55 arriba y abajo); `DockedHeadline` se apoya justo en ese margen.

## 2. Coordenadas del mundo y cámara

Hay dos espacios:

- **Mundo**: lo que va dentro de `<World camera={cam} width height>`. Se mueve con la cámara. Una unidad = un píxel a escala 1, con el origen arriba a la izquierda del lienzo de 1920×1080. Acá van las interfaces recreadas, los garabatos, el cursor y las tarjetas que vuelan.
- **Pantalla**: lo que va fuera de `World` (titular, viñeta, velo `Wash`). No se mueve con la cámara.

La cámara se define con cuadros clave `{ f, x, y, scale }`: `(x, y)` es el punto del mundo que queda en el centro de la pantalla, `scale` el zoom.

```tsx
const KEYS: CameraKey[] = [
  { f: 0,   x: 960, y: 540, scale: 1 },   // vista general: el lienzo entero
  { f: 40,  x: 650, y: 310, scale: 1.8 }, // acercamiento rápido a un punto
  { f: 110, x: 650, y: 310, scale: 1.8 }, // sostener
];
const cam = cameraAt(f, KEYS);            // { x, y, scale, rx, ry, blur }
```

- Los `f` van estrictamente crecientes. Una sola clave = cámara fija.
- Para centrar un elemento en pantalla, poné su centro como `(x, y)`: `x = left + ancho/2`, `y = top + alto/2`.
- `cameraAt` agrega inclinación y desenfoque según la velocidad: quieta no hay ni uno ni otro; en viajes largos aparece el desenfoque. Se ajusta con `maxBlur`, `blurThreshold`, `tiltGain`, `maxTilt`.
- Atravesar un elemento al final: `cameraAt(f, KEYS, { map: (fr, c) => zoomThrough(fr, [112, 149], c, destino, 40), noBlurFrom: 112 })`. El foco se desliza a `destino` y la escala se multiplica por `40 ** p`. Poné `Wash` en los últimos 15 a 20 cuadros.
- `hideFromScale(cam.scale)` da 0 con escala 1 y 1 con escala 1,08 o más: se lo pasás al titular (`hide`) para que se aparte.
- Para que el contenido siga una conducta distinta durante el zoom (por ejemplo, una viñeta que aparece al acercar): `kf(cam.scale, [1.05, 1.45], [0, 1])`.

## 3. Qué pieza usar para qué

| Necesitás | Pieza |
|---|---|
| Fondo, tipografía y color de texto de la escena | `Stage` (`clouds={false}` para un fondo liso; `CloudBackground` si querés las manchas del tema; las nubes siguen el tamaño del cuadro en todos los formatos) |
| Mover la cámara sobre un mundo | `World` + `cameraAt` |
| Valor que cambia entre cuadros clave | `kf(f, [f0, f1, ...], [v0, v1, ...], easing?)` |
| Trayecto 2D por paradas | `track(f, [[f, x, y], ...])` |
| Texto que se escribe | `typed(texto, f, inicio, caracteresPorCuadro)` |
| Cursor que viaja y hace clic | `Cursor` (`keys: [[f, x, y], ...]`, `clicks: [f]`, `show: [ini, fin]`) |
| Marcar algo a mano | `DoodleCircle`, `DoodleArrow`, `DoodleUnderline` (con `id` único, `start`, `end`) |
| Una tarjeta que viaja de un lugar a otro | `FlyingCard` con `range`, `from`, `to`, `arc` |
| Número que cuenta | `CountUp` (`start`, `duration`, `format?`) |
| Texto con el degradado del tema | `GradientText` (`loop={90}` lo hace ir y volver y termina exacto en el primer cuadro del ciclo; `pan` es una velocidad sin ciclo exacto) |
| Titular que se aparta | `DockedHeadline` con `title` (o `TopicHeadline`, que dentro de una historia lee el tema y fuera de ella necesita `title`); `layout="inline"` pone título y subtítulo en un renglón ("04 Nombre · línea"), `"stacked"` (por defecto) los apila |
| Oscurecer los bordes al acercar | `Vignette amount={0..1}` (`color`: un rol del tema o `data.<nombre>`; `color="bg"` y un `strength` bajo si la escena es oscura y no querés teñirla de acento) |
| Un panel que llega volando en profundidad | `style={{ ...flyInZ(progreso, { from: 800 }) }}` en el propio elemento (nunca `preserve-3d` ni perspectiva en un ancestro) |
| Nubes propias de la escena | `Stage cloud={{ colors, count, blobs, opacity }}` (pisa solo en esa escena lo que declara `theme.cloud`; el tema las define con tokens `--cloud-*`, ver `themes/README.md`, "Nubes"). Una historia entera: `spec.design.clouds` |
| Salida de escena | `zoomThrough` + `Wash` |
| Mezclar escenas con tiempos | `Sequence`, `Series` (motor) |
| Audio | `Audio` (motor) o `defineStory({ audio })` |
| Título, número, gráfico, teléfono, transición ya hechos | un efecto de `fx/` (ver `docs/animaciones.md`) |

## 4. Tiempos a 30 fps

| Duración | Cuadros | Uso típico |
|---|---|---|
| 0,3 s | 8 a 10 | clic, onda, aparición de un rótulo |
| 0,5 a 0,7 s | 15 a 20 | entrada de un elemento, trazo de un garabato |
| 1 a 1,3 s | 30 a 40 | acercamiento rápido a la acción clave |
| 1,5 a 2 s | 45 a 60 | viaje de cámara entre dos zonas, vuelo de una tarjeta |
| 1 a 1,3 s | 30 a 40 | atravesado final (los últimos 15 a 20 llevan el velo) |
| 5 s | 150 | escena de un tema |

Una escena de un tema dura entre 150 y 600 cuadros (más corta, de 90 a 150, en un video corto: el presupuesto de cuadros del video completo está en la skill, etapa 3, y en `stories/README.md`). Entradas escalonadas: desfasá 5 a 6 cuadros entre elementos (`kf(f, [8 + i * 6, 26 + i * 6], [0, 1])`). Un clic ocurre cuando el cursor ya llegó: la última parada de `keys` antes del clic es 2 cuadros antes de `clicks`.

Escribí los tiempos en una constante `T = { zoom: 40, click: 62, ... }` para que el guion y el código se lean juntos.

## 5. Recorrido de `examples/kit-demo`

Escena de 300 cuadros (10 s). Se lee en este orden:

1. **Mundo.** Dos paneles (`A`, `B`) en coordenadas fijas y tres tarjetas posicionadas por `cardPos(i)`. Todo es `position: absolute` con `left`/`top` del mundo.
2. **Cámara.** `KEYS` tiene siete claves: vista general (0 a 55), acercamiento a la tarjeta elegida (90 a 135), apertura a una vista media (165), viaje al contador (200) y sostener (300). `camera(f)` agrega `zoomThrough` entre 240 y 299 con el contador como destino y apaga el desenfoque desde 240.
3. **Entradas.** Cada tarjeta y fila aparece con `kf(frame, [i * 6 - 14, i * 6 + 8], [0, 1])`: escalonado.
4. **Acción clave.** El cursor (`Cursor`) viaja entre 74 y 122 y hace clic en el cuadro 124; recién en 126 la tarjeta queda "seleccionada" (`picked`). El garabato `DoodleCircle` empieza en 96.
5. **Viaje de una tarjeta.** Entre 150 y 190, `FlyingCard` la lleva con arco al panel B; mientras vuela, en su lugar queda un hueco punteado. Una flecha (`DoodleArrow`) marca el recorrido.
6. **Llegada.** `CountUp` empieza a contar cuando la tarjeta aterriza (`land`) y el subrayado (`DoodleUnderline`) lo remata.
7. **Pantalla.** Fuera de `World`: `Vignette` (crece con el zoom), `DockedHeadline` con `hide={hideFromScale(cam.scale)}` y `Wash` en los últimos 20 cuadros.

Probalo: `npm run dev` y abrí `/?video=kit-demo`, o `npm run sheet -- kit-demo --count 12`. Con otro tema: `/?video=kit-demo&props={"theme":"dark"}`.

## 6. Recrear una interfaz con primitivas del tema

Las herramientas se arman con `div` posicionados y con los valores del tema. Estas piezas son punto de partida; copialas a la carpeta de la escena (`videos/<slug>/<escena>/`, de ahí los `../../../` hasta la raíz) y ajustalas. Siempre tamaño de letra de `theme.type`, colores de `theme.color`, radios y sombras del tema.

```tsx
import React from "react";
import { useTheme } from "../../../themes";

/** Ventana con barra de título (tres puntos + nombre de la herramienta). */
export function Window({ x, y, w, h, title, children }: { x: number; y: number; w: number; h: number; title: string; children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, overflow: "hidden", background: t.color.surface, border: `1px solid ${t.color.border}`, borderRadius: t.radius.lg, boxShadow: t.shadow.lg }}>
      <div style={{ height: 56, display: "flex", alignItems: "center", gap: 10, padding: "0 22px", background: t.color.surfaceAlt, borderBottom: `1px solid ${t.color.border}` }}>
        {[t.color.danger, t.color.warning, t.color.success].map((c, i) => (
          <span key={i} style={{ width: 14, height: 14, borderRadius: t.radius.pill, background: c }} />
        ))}
        <span style={{ marginLeft: 16, fontSize: t.type.eyebrow, fontWeight: t.font.weights.semibold, color: t.color.textMuted }}>{title}</span>
      </div>
      <div style={{ position: "relative", height: h - 56 }}>{children}</div>
    </div>
  );
}

/** Tabla: encabezado y filas con las columnas reales de la herramienta. `appear` (0..1 por fila) la hace entrar escalonada. */
export function Table({ columns, rows, appear }: { columns: string[]; rows: string[][]; appear: (row: number) => number }) {
  const t = useTheme();
  const grid = `repeat(${columns.length}, 1fr)`;
  return (
    <div style={{ padding: "18px 30px" }}>
      <div style={{ display: "grid", gridTemplateColumns: grid, padding: "0 20px 12px", fontSize: t.type.eyebrow, color: t.color.textMuted, fontWeight: t.font.weights.medium }}>
        {columns.map((c) => <span key={c}>{c}</span>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: grid, alignItems: "center", height: 56, marginBottom: 8, padding: "0 20px", boxSizing: "border-box", background: t.color.bg, border: `1px solid ${t.color.border}`, borderRadius: t.radius.md, fontSize: t.type.eyebrow, color: t.color.text, opacity: appear(i) }}>
          {r.map((c, j) => <span key={j}>{c}</span>)}
        </div>
      ))}
    </div>
  );
}

/** Tarjeta de indicador. `selected` agrega el borde de acento. */
export function StatCard({ label, value, selected }: { label: string; value: string; selected?: boolean }) {
  const t = useTheme();
  return (
    <div style={{ width: 360, height: 200, boxSizing: "border-box", padding: 28, background: t.color.surfaceAlt, borderRadius: t.radius.panel, border: `2px solid ${selected ? t.color.accent : t.color.border}`, boxShadow: selected ? t.shadow.lg : t.shadow.sm }}>
      <div style={{ fontSize: t.type.eyebrow, color: t.color.textMuted }}>{label}</div>
      <div style={{ fontSize: t.type.stat * 0.6, fontWeight: t.font.weights.stat, color: t.color.text }}>{value}</div>
    </div>
  );
}

/** Gráfico de barras que crece con el cuadro. `progress` va de 0 a 1 (usá `kf`). */
export function BarChart({ values, progress, w, h }: { values: number[]; progress: number; w: number; h: number }) {
  const t = useTheme();
  const max = Math.max(...values);
  const gap = 18;
  const bw = (w - gap * (values.length - 1)) / values.length;
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      {values.map((v, i) => {
        const bh = (v / max) * h * progress;
        return <div key={i} style={{ position: "absolute", left: i * (bw + gap), bottom: 0, width: bw, height: bh, borderRadius: `${t.radius.sm}px ${t.radius.sm}px 0 0`, background: t.color.chart[i % t.color.chart.length] }} />;
      })}
    </div>
  );
}
```

Cómo usarlas dentro de `<World>`: `<Window x={260} y={200} w={1400} h={700} title="Panel de ejemplo"><Table columns={["Nombre", "Estado"]} rows={[["Elemento alfa", "Activo"]]} appear={(i) => kf(f, [30 + i * 5, 48 + i * 5], [0, 1])} /></Window>`.

### Colores con nombre y letra chica de la interfaz

Una interfaz recreada necesita colores sin rol en `theme.color` (estados, severidades, fondos de ficha) y letra más chica que `eyebrow`. Ninguno de los dos va escrito a mano en la escena:

- **Colores: `theme.data`.** Se declaran una vez en `videos/<slug>/theme.ts` (con tokens o con un valor propio) y la escena los lee con `useTheme().data.<nombre>`. Un nombre que no existe lanza un error que lista los declarados; `checkTheme` revisa cada par color/superficie con el contraste que declaraste.

  ```ts
  // videos/<slug>/theme.ts
  const r = themeFromTokensWithReport(tokens, neutral, {
    data: {
      estadoOk: "data-estado-ok",                                              // un token
      estadoBajo: { token: "severity-1", on: ["bg", "surface"], min: 4.5 },     // se usa como texto: 4.5
      ficha: { color: "#22252b", on: ["surface"], min: 1.1 },                   // valor propio (solo en el tema, nunca en la escena)
    },
    acknowledge: ["accent/bg"],                                                 // ver más abajo
  });
  export const theme = r.theme;
  // en la escena
  const t = useTheme();
  <span style={{ color: t.data.estadoOk }}>Aprobado</span>
  ```

- **Letra grande intermedia: `type.display`** (`sm` 48, `md` 56, `lg` 64 px), entre `body` y `h2`, para cifras de ficha, rótulos y títulos de panel. Si ningún escalón da el tamaño, se deriva de uno con un factor (`type.stat * 0.8`): válido; un literal (`58`) no. `h1` (96) y `hero` (120) cubren lo más grande.
- **Letra: `type.ui`** (`xs` 15, `sm` 20, `md` 24 px): para tablas densas, fichas y menús que se leen con la cámara acercada. El control de calidad la trata aparte: un texto chico que, en otro cuadro de la misma escena, se ve a tamaño legible es `info` (no error), con una línea resumen por cuadro. Por eso cada escena con `type.ui` tiene que tener un acercamiento donde ese texto se lea; si en ningún cuadro llega al mínimo, `min-size` sigue siendo error. En pantalla completa usá `caption`, `body`, etc.
- **Pares de la marca que no llegan a 4.5:1.** Si la marca aprobó una combinación (`accent` sobre `bg`, por ejemplo), la persona lo confirma y se reconoce en el tema con `acknowledge: ["accent/bg"]`: `checkTheme` la informa como `note` en vez de aviso y `report.notes` la lista aparte. No cambia lo que mide `qa`, que juzga el texto real en pantalla: si el texto es chico, el arreglo sigue siendo usar el tono sugerido (`suggestion`) solo para ese texto.

Criterios:

- **Estructura real**: las mismas columnas, pestañas, botones y rótulos que la herramienta, con datos ficticios. Si no los conocés, preguntá o pedí el nombre de las secciones; no los inventes parecidos.
- **Herramienta oscura = tema oscuro.** Usá `dark` o un tema propio oscuro para esa escena (envolviendo solo esa escena, o solo la herramienta, con `ThemeScope`; ver la sección 10).
- **Estado por cuadro**: lo que cambia (un casillero que se tilda, un campo que se completa) se deriva del cuadro: `const checked = f >= T.click + 2;`.
- **Texto que se escribe**: `typed("texto", f, inicio, 0.8)`.
- **Todo con tamaño legible**: si en la vista general algo queda debajo de 18 px de pantalla, es decoración: el zoom lo lleva a tamaño legible o no lleva texto.

## 7. Errores comunes y qué regla los atrapa

| Error | Cómo se nota | Qué lo detecta |
|---|---|---|
| `useState`/`useRef` que acumulan, `Math.random()`, `Date.now()`, CSS `transition` | el video sale distinto según el orden de render | `npm run render -- <id> --check` |
| Rótulo más largo que su caja (`overflow: hidden`, `…`) | texto cortado | `qa`: `clip` |
| Titular encima de contenido al acercar | dos textos se pisan o uno queda tapado | `qa`: `overlap`, `covered` (y la hoja de cuadros) |
| Texto que se sale del cuadro o del área segura | recortado en un borde | `qa`: `offscreen`, `safe-area` |
| Letra de 14 px en una escena que no se acerca | ilegible en pantalla | `qa`: `min-size` |
| Texto gris sobre fondo claro o color de acento sobre acento | poco contraste | `qa`: `contrast` (y `checkTheme` para el tema) |
| Un panel o una pastilla opaca sobre un texto | texto invisible | `qa`: `covered` |
| Color o fuente escritos a mano (también en una tabla de colores aparte dentro de la escena) | desentona al cambiar el tema | revisión: buscar `#` y `font-family` en la carpeta de la escena; los colores propios de la interfaz van en `theme.data` (sección 6) |
| Dos garabatos con el mismo `id` | se pisan el trazo y el degradado | revisión |
| Datos reales, correos o dominios en pantalla | privacidad | `ve-privacy` con `prohibidos.txt` |
| Claves de cámara no crecientes | error con los cuadros nombrados | `cameraAt` lanza al renderizar |
| Imagen o fuente que no carga | timeout `holds pendientes` | `render` (30 s) |
| Vista general sin espacio arriba | el titular tapa el contenido | hoja de cuadros |
| Texto claro sobre un color sólido mientras un `Wash` lo cruza | el velo lo deja sin contraste a mitad de camino | hoja de cuadros en los cuadros del velo; dejá el texto fuera del tramo del `Wash` o apartalo antes |

Durante una transición (tarjeta volando sobre otra, cámara en movimiento, fundidos) `qa` baja solo a `info` lo que se mueve o cambia de opacidad entre cuadros vecinos: no hace falta silenciarlo, se juzga con la hoja de cuadros. Para silenciar lo que sí decidiste a propósito: `data-qa-ignore="regla"` en el elemento (ver `qa/README.md`). Un umbral que no sirve en general se cambia con `--set regla.umbral=valor`.

### Recetas de `qa`

- **Silenciar una regla solo mientras dura el encuadre.** El atributo acepta `undefined`, así que se activa con una condición del cuadro y el resto del tiempo la regla sigue vigilando. Hoy hace falta casi solo para texto cortado a propósito bajo una cámara quieta con zoom:

  ```tsx
  const zoomed = cam.scale > 1.05;      // la cámara está encuadrando una parte del diseño
  <div data-qa-ignore={zoomed ? "offscreen" : undefined}>…filas vecinas cortadas por el borde…</div>
  ```

  Se puede poner en un ancestro (alcanza a todo lo de adentro), con varias reglas separadas por espacios o `all`. Hacelo en el elemento mínimo y con la condición más angosta posible; decí en el mensaje de entrega qué silenciaste y por qué.
- **Falsos errores de `contrast` con texto que entra.** Un texto que se escribe (`typed`) mientras su contenedor está en fundido (entrada del titular, o `hide` al acercar) puede dar `contrast` como "quieto" con opacidad intermedia: cada cuadro tiene un texto distinto y no se empareja con el vecino. Escribilo cuando el contenedor ya terminó de entrar y de apartarse, o mostralo entero con el contenedor.
- **Cortado por el zoom a propósito.** Las tarjetas o filas vecinas que la cámara deja cortadas por el borde dan `offscreen` (aviso si el recorte es grande y estable). Si es el encuadre que querés, la condición `zoomed` de arriba lo silencia solo durante el zoom (con la cámara en movimiento ya es `info`); si no, alejá la cámara o usá el zoom máximo de la sección 13.

**Qué transiciones ya no hace falta silenciar** (`qa` las baja solo a `info`, que queda oculto salvo `--verbose`; criterio en `qa/README.md`, "Reglas de `ve-qa`" y "`offscreen`: por qué error, aviso o info"):

- Texto que se mueve entre cuadros vecinos (más de 12 px a 1080p): cámara en paneo o zoom, tarjeta volando sobre otra, texto que sale o entra del cuadro (`offscreen`, `overlap`, `covered`, `min-size`).
- Un `Wash` o cualquier velo de cuadro completo cuya opacidad cambia de un cuadro al siguiente: el texto de abajo da `contrast` en `info`.
- Un panel que entra junto con el texto de adentro (los dos en fundido): `contrast` en `info` hasta que se asienta.
- Texto con opacidad baja (fundido, decorativo): `info`.
- Dos elementos que se cruzan mientras uno se mueve (una tarjeta que vuela sobre otras, un texto que entra sobre un fondo que cambia): `overlap`, `covered` y `contrast` en `info`.
- Una rebaba chica (hasta 6 px) bajo una cámara que se mueve: `info`.
- Texto bajo un `Wash` a medio fundido: `info` (con el velo quieto sigue siendo error).

**Adorno de interfaz recreada.** El texto que es marco de la interfaz (menús, pestañas, barras que no se leen) va bajo `data-qa-decor`: queda fuera de `min-size` y `contrast` (con una línea `info` con la cuenta), y `clip`, el `overlap` contra texto normal y el `offscreen` de lo marcado `data-qa-decor="main"` siguen aplicando. El texto que dice algo no es adorno. Un color usado solo como código redundante (un número pintado por estado junto a su rótulo) se acepta con `data-qa-ignore="contrast"` y un comentario; `qa` imprime cuántos hallazgos callaron las marcas por regla (ver `qa/README.md`).

**Qué sigue pidiendo tu decisión**: un encuadre quieto que deja cortado un elemento (`offscreen` en aviso: `data-qa-ignore` con la condición del zoom, solo si la cámara está quieta), un velo que se queda a medias (error de `contrast`: es lo que ve la persona), un texto que se escribe mientras su contenedor se funde (ver arriba) y cualquier texto quieto tapado.

### Para que no parezca un borrador

Un video puede pasar todas las herramientas y seguir pareciendo un borrador. Reglas concretas, sacadas de un primer video que salió así:

- **En vertical, el sujeto llena el cuadro.** Un teléfono de 460 px en un cuadro de 1080×1920 deja la pantalla vacía alrededor: subí la escala del sujeto (o su zoom) hasta que ocupe casi todo el ancho y apilá lo demás; no reuses la composición horizontal achicada.
- **Nunca sostengas una interfaz vacía o "cargando" en una vista general.** Si la interfaz entra con datos que aparecen, que la vista general ya los tenga (o que la cámara se acerque recién cuando hay contenido).
- **La apertura dura al menos unos 4 s** (120 cuadros): menos y el título no alcanza a leerse. Si el presupuesto no da, sacá un tema; no acortes la apertura (ver el presupuesto de cuadros en la skill).
- **El texto secundario se lee en la vista general o aparece solo con zoom.** Si a tamaño de vista general queda debajo de 18 px de pantalla, es decoración: mostralo cuando la cámara ya se acercó.
- **Mirá cada hoja como un espectador** antes de mostrarla: ¿se entiende qué es, qué cambia y adónde mirar en cada cuadro?, ¿hay zonas vacías?, ¿algo se corta? Una hoja por formato.

## 8. Historias: varias escenas en un video

Con 2 a 6 temas usá `defineStory` (ver `stories/README.md` y `templates/story/`): arma la apertura, las vueltas al listado y el cierre desde un `StorySpec`. Cada escena de tema:

- es un componente sin `Stage` (la historia ya lo pone) y de duración fija (`durationInFrames`);
- puede usar `useTopic()` y `<TopicHeadline start hide />` para el titular con el nombre del tema. Para que la escena se renderice también sola (lo recomendado) hay dos caminos: pasarle el titular por prop y usar `DockedHeadline`, como `templates/scene/Scene.tsx`, o dejar `TopicHeadline` con `title` y `number` (`<TopicHeadline title="Panel de ventas" number={1} />`; dentro de la historia pisan al tema, y sin `title` ni historia no dibuja nada y avisa una vez en la consola) y `useTopic({ name: "Panel de ventas" })` con valor de reserva (`useTopicOrNull()` devuelve `null` fuera de la historia). El contenido no debe depender de `StoryStage` ni de `composeStory`;
- termina con `Wash` o atravesando algo;
- **dale una `thumbnail` a cada tema**: es la miniatura de su panel en el muro del cierre; sin ella el cierre muestra una tarjeta derivada del número y el nombre del tema (varía según el tema, pero es genérica). Va en la lista de escenas de `defineStory`: `{ id: "ventas", component: Ventas, durationInFrames: 150, thumbnail: MiniVentas }`. `MiniVentas` es un componente sin props que dibuja en un lienzo de **560×340** (coordenadas propias, `position: absolute` desde `(0, 0)`), con piezas del tema, no recibe props y, si lee `useFrame()`, obtiene el cuadro del cierre y no el de tu escena: dibujala quieta (sin `kf`): el recorte de la interfaz recreada en su momento más claro (un panel con 2 o 3 filas, una cifra y un gráfico chico). La letra de la miniatura es chica a propósito (el cierre la marca para `qa`); en 560 px de ancho entran unas 4 filas a `type.eyebrow * 0.8`. Reusá las mismas piezas de la escena (copiá el `Window`/`Table` de la sección 6) para que se reconozca.

- **Historia parcial**: `scenes` va parejo a `spec.topics`; un tema sin escena se indica con `null` (sale en la lista y en el cierre, sin vuelta al listado) y una lista vacía deja solo apertura y cierre.
- **`spec.design`** (opcional): `titleCard: "glass"`, `list: "inline"`, `handoff: "dock"` (la apertura entrega la píldora del titular ya puesta, así que la escena del primer tema arranca con `<TopicHeadline />` completo), `wall: { columns, rows, blur }` y `clouds`. Tabla en `stories/README.md`, "Opciones de diseño".
- La firma del cierre acepta negrita (`signoff.text`, `signoff.tagline`: `"Gracias por **mirar**"`) o una marca propia (`signoff.slot`). Si `composeStory` no alcanza, las piezas (`Opening`, `Interlude`, `Closing`, `TopicProvider`, `StoryStage`) se arman a mano dentro de `Sequence`.
- **Verificá por bloque**: `--check` de la historia entera toma cuadros parejos más 6 por escena; un fallo del cartel de la apertura se vio con `--scene opening` y no con el muestreo parejo. Corré también `--check --scene opening`, `--scene interlude-1` y `--scene closing` en cada formato (`--check-per-scene N`, `--check-count N` y `--check-all` cambian el muestreo).

Probá cada escena sola (su propio `defineVideo`, como en `templates/scene/index.ts`) y recién después en la historia. `defineStory` publica por defecto solo el formato base: los formatos extra se piden con `formats: ["vertical"]` y cada escena de tema tiene que tener su disposición. El presupuesto de cuadros de la historia entera se ve con `npm run qa -- <id> --list-scenes`.

## 9. Combinar el kit con efectos de `fx/`

Los efectos de `fx/` son componentes comunes: se ponen dentro de `World` (se mueven con la cámara) o fuera (fijos en pantalla), y los garabatos y el cursor del kit se dibujan encima. Reglas prácticas:

- Un efecto sin `frame` lee el cuadro del motor: usá `start` y `duration` para ubicarlo en la línea de tiempo de la escena. Su último cuadro es una imagen fija, así que se queda en pantalla después de terminar.
- Posicionalo con un contenedor `position: absolute` con `left`/`top` en píxeles enteros y dale `width`/`height` al efecto.
- Los garabatos y el cursor van en las coordenadas del mundo del efecto sobre el que apuntan; empezá el garabato cuando el efecto ya terminó (`start + duration`).
- Para una transición entre escenas, `DotWipe` (cuadro completo) o `Wash` del kit; no los apiles.

```tsx
import { useFrame, useVideoConfig } from "../../../engine";
import { Cursor, DoodleCircle, Stage, Wash, World, cameraAt } from "../../../kit";
import type { CameraKey } from "../../../kit";
import { BarsGrow, MaskedRise } from "../../../fx";

const KEYS: CameraKey[] = [
  { f: 0, x: 960, y: 540, scale: 1 },
  { f: 50, x: 1200, y: 620, scale: 1.6 },
  { f: 120, x: 1200, y: 620, scale: 1.6 },
];

export function EscenaCombinada() {
  const f = useFrame();
  const { width, height } = useVideoConfig();
  const cam = cameraAt(f, KEYS);
  return (
    <Stage clouds={false}>
      <World camera={cam} width={width} height={height}>
        <div style={{ position: "absolute", left: 160, top: 120 }}>
          <MaskedRise text="Ventas por región" start={4} dot />
        </div>
        <div style={{ position: "absolute", left: 760, top: 320 }}>
          <BarsGrow start={20} duration={50} width={900} height={520} data={[40, 65, 52, 90]} labels={["N", "S", "E", "O"]} />
        </div>
        <DoodleCircle id="ej-circulo" start={80} end={105} cx={1330} cy={500} rx={110} ry={90} />
        <Cursor show={[50, 118]} keys={[[50, 1500, 900], [76, 1360, 560]]} clicks={[78]} />
      </World>
      <Wash range={[104, 119]} />
    </Stage>
  );
}
```

El titular y las barras entran solos con su propio escalonado; la cámara se acerca a las barras, el cursor hace clic y el círculo marca la barra más alta. Probalo con `npm run dev` y `/?video=fx-text`, `fx-3d` o `fx-data-ui-art` para ver cada efecto por separado.

## 10. Un tema distinto para una escena o una parte de la escena

Para una herramienta oscura dentro de un video claro (o al revés) envolvela con `<ThemeScope theme={dark}>`, de `kit/`:

```tsx
import { Stage, ThemeScope } from "../../../kit";
import { dark } from "../../../themes";

<Stage>
  <ThemeScope theme={dark} paint style={{ position: "absolute", left: 500, top: 190, width: 860, height: 660, borderRadius: 24, overflow: "hidden" }}>
    {/* piezas del kit, efectos de fx/, canvas, tu recreación de la herramienta */}
  </ThemeScope>
</Stage>
```

- Todo lo de adentro lee `useTheme()` y obtiene el tema del ámbito; lo de afuera sigue con el del video. Se puede anidar (un ámbito claro dentro del oscuro).
- Con `paint`, el ámbito pinta una superficie con el fondo, el texto y la tipografía de su tema; sin `paint` solo cambia el tema.
- Los colores de un canvas (`FrameCanvas`, efectos de `fx/three`) también salen del ámbito donde estén.
- Si el tema trae `font.files`, `ThemeScope` declara el `@font-face` y frena la captura hasta que la fuente cargue.
- Un tema para toda una escena: poné el `ThemeScope` en la raíz de la escena, o un `ThemeProvider` si no necesitás nada más.
- Corré `checkTheme(tema)` una vez por cada tema que uses.

Ejemplo completo: `examples/theme-scope` (`/?video=theme-scope`).

## 11. Vertical y cuadrado

El mismo video puede salir en 16:9 (1920×1080), vertical (1080×1920) y cuadrado (1080×1080). Se habilita con `formats` en `defineVideo` o `defineStory` (sin `formats` solo existe el formato base): `formats: ["vertical", "cuadrado"]`; con el base 1920×1080 los tamaños se derivan solos, y todos los lados tienen que ser pares y se elige con `--format horizontal|vertical|cuadrado` en `render`, `qa` y `sheet` (en el navegador, `&format=vertical`).

- El tamaño del escenario sale de `useVideoConfig()` (`width`, `height`): no supongas 1920×1080 ni escribas `960`/`540` a mano; usá `width / 2`, `height / 2`.
- `useFormat()` da `{ format, width, height, pick }`. `pick({ horizontal: 4, vertical: 2, cuadrado: 3 })` elige un valor según el formato (lo que falta usa el de `horizontal`). Con eso se cambian columnas, tamaños y posiciones: tarjetas en fila en horizontal y apiladas en vertical, tamaño de punto, zoom de cámara.
- El texto del tema (`theme.type`) no cambia de tamaño: en vertical hay menos ancho, así que usá más renglones, apilá o achicá la composición, no la letra. El QA mide el tamaño mínimo contra el lado corto del cuadro (en vertical, el ancho).
- Cada formato extra que se habilita es un diseño más por escena: no alcanza con achicar la composición horizontal. `templates/scene/Scene.tsx` trae un ejemplo horizontal + vertical.
- Mirá una hoja de cada formato (`npm run sheet -- <id> --format vertical --count 12`) y corré `render --check` y `qa` en cada uno. Un ejemplo completo: `examples/hello` (punto y titular con `pick`) y `examples/story-demo` (la escena cambia de diseño por formato).

## 12. Probar una escena sola

`npm run qa -- <id> --list-scenes` (también `sheet` y `render`) lista las escenas con nombre: las `<Series.Item name="...">` / `<Sequence name="...">`, las que declara `defineVideo({ scenes })` y, en una historia, la apertura, cada tema, las vueltas al listado y el cierre; las versiones de `qa` y `sheet` agregan, en una historia, el presupuesto de cuadros por bloque (la de `render` no). Con `--scene <id|índice>` (índice desde 0) `render`, `qa` y `sheet` trabajan solo sobre el rango de cuadros de esa escena: `npm run sheet -- mi-video --scene ventas --count 8`.

## 13. Composición: dónde poner cada cosa y cuánto acercar

Sin coordenadas de partida, cada escena se reabre varias veces para mover cosas. Estas tres recetas ahorran esas vueltas. Todas las medidas son del mundo (1 unidad = 1 px a escala 1) con el tema `neutral`/`dark`; con otro tema recalculá con `theme.safe` y `theme.type`.

### a) Receta de disposición por formato

| | Horizontal | Vertical | Cuadrado |
|---|---|---|---|
| Lienzo (`useFormat()`) | 1920×1080 | 1080×1920 | 1080×1080 |
| Margen seguro por lado (`theme.safe / 2`) | 70 en x, 55 en y | 70 en x, 55 en y | 70 en x, 55 en y |
| Franja del titular (`DockedHeadline`, fijo en pantalla) | de y = 55 a unos 145; dejá libre hasta y = 170 | igual, dejá libre hasta y = 240 | hasta y = 200 |
| Ventana o panel recomendado `{ x, y, w, h }` | `{ 260, 200, 1400, 700 }`; denso: `{ 160, 190, 1600, 780 }` | `{ 40, 260, 1000, 1400 }` | `{ 60, 200, 960, 800 }` |
| Contenido dentro de la ventana | fila de 3 tarjetas de 400×220 (separadas 50) y filas de 58 a 90 de alto | rejilla de 2 columnas de 440×400 (separadas 40) o una columna de 920; filas de 96 | una columna de 840 o 2 columnas de 400 |
| Letra de la interfaz | `eyebrow` (26) o `caption` (32); cifras `stat * 0.6` | `caption` (32) o `body` (44); cifras `stat * 0.8` | `caption`; cifras `stat * 0.6` |
| Dónde queda el cursor al arrancar | abajo a la derecha de la ventana | abajo a la derecha de la ventana | abajo a la derecha |

Cómo se usa:

- **El titular no se mueve**: está fijo en pantalla y se aparta (`hideFromScale`) apenas la cámara se acerca. En la vista general nada va por encima de la franja del titular; con la ventana empezando donde dice la tabla no hay que pensarlo.
- **Horizontal**: el centro del lienzo es `(960, 540)`; la ventana recomendada queda centrada en x (260 + 1400 / 2 = 960) y un poco baja, para compensar el titular.
- **Vertical**: el sujeto llena el cuadro (1000 de 1080 de ancho y 1400 de 1920 de alto) y la letra sube un escalón del tema. No achiques la composición horizontal: apilá, o poné las tarjetas en dos columnas. Un panel de 700 px de alto en 1920 deja los dos tercios del cuadro vacíos.
- **Cuadrado**: sin `pick` propio cae en la disposición horizontal, que se sale del cuadro: definí la suya (la tabla da una base).
- Todo texto de la interfaz dentro del margen seguro de la ventana (mínimo 30 px de relleno interno) y a `eyebrow` o más grande si no se acerca.
- **Vista general con contenido**: sostené la primera clave de cámara hasta el cuadro 26 y hacé que todo el contenido ya haya entrado para entonces (entradas de 4 cuadros de desfase, la última termina en el 26). La plantilla lo hace así.

### b) Zoom máximo que muestra un elemento completo

Para que un elemento de ancho `w` (una fila, una tarjeta) se vea entero con un margen `m` a cada lado, el zoom más alto es:

```
zmax = (ancho del cuadro - 2 * m) / w          // con la altura: (alto del cuadro - 2 * m) / h; usá el menor
```

`ancho del cuadro` es `width` de `useFormat()` y `m` el margen seguro por lado (`theme.safe.x / 2`, 70 con los temas base). La cámara va centrada en el elemento (`x = left + w / 2`, `y = top + h / 2`). Quedate un poco por debajo de `zmax` (el 90 %) para que entren el borde y el garabato.

Ejemplos con el tema neutro:

| Elemento | Cuenta | zmax | Usá |
|---|---|---|---|
| Fila de 1320 en horizontal (1920) | (1920 - 140) / 1320 | 1,35 | 1,3 |
| Tarjeta de 400 en horizontal | (1920 - 140) / 400 | 4,45 | 1,8 a 2,2 (más sería exagerar) |
| Tarjeta de 440 en vertical (1080) | (1080 - 140) / 440 | 2,14 | 2 |
| Fila de 920 en vertical | (1080 - 140) / 920 | 1,02 | no hay zoom que valga |

Cuando `zmax` da cerca de 1 (la fila ya ocupa todo el ancho), el zoom no aporta: acercá a la parte que importa (el botón, la cifra) aceptando que el resto quede cortado (y silenciá `offscreen` solo durante el zoom, receta de la sección 7), o rediseñá el elemento en dos renglones en vertical. Lo mismo vale al revés: si el elemento es chico (`zmax` mayor de 3), no acerques hasta `zmax`: con 1,8 a 2,2 la acción se lee y el contexto se ve.

En código (el ejemplo de abajo lo usa): `const zoom = Math.min((width - 2 * m) / ROW.w, 1.5)`, con `m = theme.safe.x / 2`.

### c) Una escena de datos completa

La escena de `examples/kit-demo` es un recorrido de piezas; esta es una escena de datos como las que se entregan: **vista general sostenida hasta el cuadro 26 con el contenido ya adentro, acercamiento a la acción, clic del cursor, resultado, vuelta a la vista general, atravesado final**. 150 cuadros:

| Cuadros | Qué pasa |
|---|---|
| 0 a 26 | la ventana, el indicador y las 4 filas entran escalonados; la cámara no se mueve |
| 26 a 50 | acercamiento rápido a la fila elegida (zoom calculado con la fórmula) |
| 24 a 64 | el cursor viaja al botón; clic en el 66 |
| 68 | resultado: la fila pasa a "Aprobado" y el indicador suma uno |
| 72 a 90 | garabato sobre el estado nuevo |
| 96 a 122 | la cámara vuelve a la vista general |
| 122 a 149 | atravesado hacia el indicador y velo |

Guardalo como `videos/<slug>/datos/Scene.tsx` después de `bash templates/nuevo.sh escena <slug> datos` (que ya deja el `index.ts` y el tema; el ejemplo exporta los mismos nombres que la plantilla: `DURACION`, `SceneBody` y `SceneVideo`). Es horizontal; para vertical agregale una entrada vertical a las constantes de caja como en `templates/scene/Scene.tsx`. Pasa `typecheck`, `--check` y `qa` sin errores:

```tsx
import React from "react";
import { useFormat, useFrame } from "../../../engine";
import { Cursor, DockedHeadline, DoodleCircle, Stage, Wash, World, cameraAt, hideFromScale, kf, zoomThrough } from "../../../kit";
import type { CameraKey } from "../../../kit";
import { ThemeProvider, useTheme } from "../../../themes";
import { theme as videoTheme } from "../theme";

export const DURACION = 150;

// Zoom máximo que todavía muestra un elemento de ancho w con margen seguro m a cada lado.
const maxZoom = (frameW: number, w: number, m: number) => (frameW - 2 * m) / w;

// Caja de la ventana (mundo = píxeles del lienzo de 1920x1080) y datos ficticios.
const WIN = { x: 260, y: 200, w: 1400, h: 700 };
const ROW = { x: WIN.x + 40, y: WIN.y + 150, w: WIN.w - 80, h: 90, gap: 14 }; // filas de la tabla
const FILAS = [
  ["Pedido 1041", "Equipo norte", "Pendiente"],
  ["Pedido 1042", "Equipo sur", "Pendiente"],
  ["Pedido 1043", "Equipo este", "Pendiente"],
  ["Pedido 1044", "Equipo oeste", "Pendiente"],
];
const ELEGIDA = 2;
const rowTop = (i: number) => ROW.y + i * (ROW.h + ROW.gap);

const T = { hold: 26, zoomIn: 50, click: 66, result: 68, back: [96, 122] as [number, number], through: [122, 149] as [number, number] };

export function SceneBody({ title }: { title: string }) {
  const f = useFrame();
  const t = useTheme();
  const { width, height } = useFormat();
  const m = t.safe.x / 2; // margen seguro por lado
  const zoom = Math.min(maxZoom(width, ROW.w, m), 1.5); // 1920 -> (1920 - 140) / 1320 = 1,35

  const fila = { x: ROW.x + ROW.w / 2, y: rowTop(ELEGIDA) + ROW.h / 2 };
  const boton = { x: ROW.x + ROW.w - 120, y: fila.y };
  const kpi = { x: WIN.x + WIN.w - 190, y: WIN.y + 80 };
  const hecho = f >= T.result;

  const keys: CameraKey[] = [
    { f: 0, x: width / 2, y: height / 2, scale: 1 },
    { f: T.hold, x: width / 2, y: height / 2, scale: 1 }, // vista general con todo adentro
    { f: T.zoomIn, x: fila.x, y: fila.y, scale: zoom },   // acercamiento a la acción
    { f: T.back[0], x: fila.x, y: fila.y, scale: zoom },  // sostener el resultado
    { f: T.back[1], x: width / 2, y: height / 2, scale: 1 }, // vuelve a la vista general
  ];
  const cam = cameraAt(f, keys, { map: (fr, c) => zoomThrough(fr, T.through, c, kpi, 40), noBlurFrom: T.through[0] });
  const zoomed = cam.scale > 1.05;

  return (
    <>
      <World camera={cam} width={width} height={height}>
        <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h, background: t.color.surface, border: `1px solid ${t.color.border}`, borderRadius: t.radius.lg, boxShadow: t.shadow.lg, opacity: kf(f, [0, 10], [0, 1]) }} />
        <div style={{ position: "absolute", left: WIN.x + 40, top: WIN.y + 34, whiteSpace: "nowrap", fontSize: t.type.body, fontWeight: t.font.weights.semibold, color: t.color.text, opacity: kf(f, [2, 12], [0, 1]) }}>Pedidos de la semana</div>
        <div style={{ position: "absolute", left: kpi.x - 80, top: kpi.y - 40, width: 270, height: 80, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: t.color.surfaceAlt, borderRadius: t.radius.md, fontSize: t.type.eyebrow, color: t.color.textMuted, opacity: kf(f, [4, 14], [0, 1]) }}>
          Aprobados
          <b style={{ fontSize: t.type.caption, color: t.color.text }}>{hecho ? 8 : 7}</b>
        </div>

        {FILAS.map(([id, equipo, estado], i) => {
          const esta = i === ELEGIDA && hecho;
          return (
            <div
              key={id}
              data-qa-ignore={zoomed ? "offscreen" : undefined} // las filas vecinas quedan cortadas a propósito durante el zoom
              style={{ position: "absolute", left: ROW.x, top: rowTop(i), width: ROW.w, height: ROW.h, boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 30px", gap: 40, background: t.color.bg, border: `1px solid ${esta ? t.color.accent : t.color.border}`, borderRadius: t.radius.md, fontSize: t.type.caption, color: t.color.text, opacity: kf(f, [6 + i * 4, 20 + i * 4], [0, 1]) }}
            >
              <span style={{ width: 280, fontWeight: t.font.weights.semibold }}>{id}</span>
              <span style={{ flex: 1, color: t.color.textMuted }}>{equipo}</span>
              <span style={{ width: 200, color: esta ? t.color.success : t.color.textMuted }}>{esta ? "Aprobado" : estado}</span>
              <span style={{ width: 190, padding: "10px 0", textAlign: "center", borderRadius: t.radius.pill, background: t.color.accent, color: t.color.onAccent, fontSize: t.type.eyebrow, fontWeight: t.font.weights.semibold }}>Aprobar</span>
            </div>
          );
        })}

        <DoodleCircle id="datos-circulo" start={T.result + 4} end={T.back[1] - 6} cx={ROW.x + ROW.w - 360} cy={fila.y} rx={100} ry={46} />
        <Cursor show={[T.hold - 2, T.back[0] + 6]} keys={[[T.hold - 2, 1500, 860], [T.click - 2, boton.x, boton.y]]} clicks={[T.click]} />
      </World>
      <DockedHeadline index={1} title={title} start={4} hide={hideFromScale(cam.scale)} />
      <Wash range={[133, 149]} />
    </>
  );
}

export const SceneVideo: React.FC<{ title?: string; subtitle?: string }> = ({ title = "Aprobar pedidos" }) => (
  <ThemeProvider theme={videoTheme}>
    <Stage clouds={false}>
      <SceneBody title={title} />
    </Stage>
  </ThemeProvider>
);
```

Qué copiar de este ejemplo: las constantes arriba (la caja, las filas y los tiempos, para que el guion y el código se lean juntos); la cámara con la primera clave sostenida; `data-qa-ignore` condicionado al zoom; el resultado derivado del cuadro (`hecho = f >= T.result`), nunca guardado; el garabato que empieza después del resultado.

## 14. El design system decide la estética: qué usar en lugar de escribirlo

El design system va primero (ver la etapa 2 de la skill): el tema trae un bloque `style` con las decisiones de forma, superficie, texto, fondo, movimiento y gráficos. **Una escena no decide estética que el design system puede decidir** (`docs/reglas.md`): no escribe un radio, una sombra, un peso de letra ni una curva; pide el resultado a una ayuda o a una pieza del kit.

| Si necesitás... | Usá | No escribas |
|---|---|---|
| una tarjeta, panel o ventana | `surfaceStyle(theme, "card" \| "panel" \| "window", { level, bold, corner })` | `background`, `border`, `borderRadius`, `boxShadow` |
| un radio suelto (una barra, un chip, una fila) | `cornerRadius(theme, "bar" \| "chip" \| "control" \| ...)` | `borderRadius: 12`, `Math.min(theme.radius.panel, ...)` |
| el grosor de un borde | `borderWidth(theme, rol, { bold })` | `1 + 1`, `${w + 1}px` |
| un rótulo, un título o un texto pequeño | `Eyebrow`, `textStyle(theme, "title" \| "label" \| "eyebrow", { strong })` | `fontWeight: 600`, `letterSpacing`, `textTransform` |
| una palabra resaltada | `Highlight` | un degradado o un subrayado propios |
| un número de paso o de lista | `Numeral` (las métricas que cuentan no lo usan: `CountUp`) | un degradado de texto a mano |
| que algo entre | `entrance(theme, progreso, índice, { native, distance, curve, offset })` y `staggerFrames(theme, i, { base })` | `translateY((1 - p) * 30)` y `i * 4` |
| la cámara | `useCameraAt(frame, claves, opciones)` | `cameraAt` directo (no lleva el desenfoque ni la inclinación del tema) |
| un gráfico | `chartStyle(theme)` (radio de barra, grosor de línea, guías, relleno), `chartFill` | `rx={6}`, `strokeWidth={5}` |
| un SVG con superficie | `surfaceParts(theme, rol)` (fill, stroke, radius, shadow) | leer `surfaceStyle` con expresiones regulares |
| un efecto de `fx/` | el efecto, que ya sigue `theme.style` (`useFx` da `style`) | rehacerlo con otro estilo |

Reglas para que funcione:

- Los roles son los de `docs/estilo.md`: `card` (tarjeta suelta), `panel` (contenedor mediano), `window` (contenedor grande), `chip`, `control`, `bar`. Si ninguno sirve, se pide uno en `themes/`; no se corrige a mano.
- Lo que el estilo no decide (tamaños de letra, área segura, medidas de lo que se mide) sigue saliendo de `theme.type`, `theme.safe` y de las constantes de la escena.
- El borde del aparato de `PhoneFrame` y las cifras de métricas están exentos (ver las exenciones en `docs/estilo.md`).

**Probar el video con otros design systems.** El video se hace con el tema aprobado; antes de entregarlo, comprobá que no quedó nada decidido a mano mirándolo con otros. `--props '{"theme":"editorial"}'` (también `neon`, `papel`, `dark`) cambia el tema en `render`, `qa` y `sheet`; la plantilla de escena y la de historia lo aceptan (en una escena propia, copiá el mapa de nombres de `templates/scene/Scene.tsx`):

```bash
npm run sheet -- <id> --count 12 --props '{"theme":"editorial"}'
npm run qa -- <id> --count 30 --props '{"theme":"neon"}'
npm run render -- <id> --check --props '{"theme":"papel"}'
```

Lo que tiene que pasar: el video se ve distinto con cada uno (esquinas, superficies, números, fondo, movimiento) y `qa` da 0 errores. Si una escena se ve igual en los tres, hay decisiones escritas a mano; si da errores de contraste solo con un tema, lo que dibuja usa un color que no sale de un rol.
