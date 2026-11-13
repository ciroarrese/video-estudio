# Guía de escenas

Cómo se escribe una escena de este toolkit. Antes leé `docs/reglas.md` (las reglas y sus motivos), `kit/README.md` (las piezas) y `engine/README.md` (la regla de determinismo). Antes de escribir una animación a medida, mirá el catálogo de efectos listos en `docs/animaciones.md`. Para arrancar copiá la plantilla: `bash templates/nuevo.sh escena <slug> <nombre>`.

## 1. Lo básico

Un video es una función del número de cuadro. Una escena:

- lee el cuadro con `useFrame()` (o recibe `frame` por props) y el tema con `useTheme()`;
- devuelve React puro: sin estado que acumule, sin temporizadores, sin azar suelto (`random(seed)`), sin animaciones CSS;
- calcula cada valor animado con `kf` (cuadros clave) o `interpolate`, nunca guardándolo.

Formato por defecto: 1920×1080, 30 fps. Un tema (`useTheme()`) trae `color`, `font`, `radius`, `shadow`, `type` (tamaños en px), `safe` (área segura), `motion` y `cloud`.

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
| Fondo, tipografía y color de texto de la escena | `Stage` (`clouds={false}` para un fondo liso; `CloudBackground` si querés las manchas del tema) |
| Mover la cámara sobre un mundo | `World` + `cameraAt` |
| Valor que cambia entre cuadros clave | `kf(f, [f0, f1, ...], [v0, v1, ...], easing?)` |
| Trayecto 2D por paradas | `track(f, [[f, x, y], ...])` |
| Texto que se escribe | `typed(texto, f, inicio, caracteresPorCuadro)` |
| Cursor que viaja y hace clic | `Cursor` (`keys: [[f, x, y], ...]`, `clicks: [f]`, `show: [ini, fin]`) |
| Marcar algo a mano | `DoodleCircle`, `DoodleArrow`, `DoodleUnderline` (con `id` único, `start`, `end`) |
| Una tarjeta que viaja de un lugar a otro | `FlyingCard` con `range`, `from`, `to`, `arc` |
| Número que cuenta | `CountUp` (`start`, `duration`, `format?`) |
| Texto con el degradado del tema | `GradientText` |
| Titular que se aparta | `DockedHeadline` (o `TopicHeadline` dentro de una historia) |
| Oscurecer los bordes al acercar | `Vignette amount={0..1}` |
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

Una escena de un tema dura entre 150 y 600 cuadros. Entradas escalonadas: desfasá 5 a 6 cuadros entre elementos (`kf(f, [8 + i * 6, 26 + i * 6], [0, 1])`). Un clic ocurre cuando el cursor ya llegó: la última parada de `keys` antes del clic es 2 cuadros antes de `clicks`.

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
| Color o fuente escritos a mano | desentona al cambiar el tema | revisión: buscar `#` y `font-family` en la carpeta de la escena |
| Dos garabatos con el mismo `id` | se pisan el trazo y el degradado | revisión |
| Datos reales, correos o dominios en pantalla | privacidad | `ve-privacy` con `prohibidos.txt` |
| Claves de cámara no crecientes | error con los cuadros nombrados | `cameraAt` lanza al renderizar |
| Imagen o fuente que no carga | timeout `holds pendientes` | `render` (30 s) |
| Vista general sin espacio arriba | el titular tapa el contenido | hoja de cuadros |

Durante una transición (tarjeta volando sobre otra, cámara en movimiento) `overlap`, `covered` y `offscreen` pueden saltar a propósito: se juzga con la hoja de cuadros. Para silenciar uno que decidiste a propósito: `data-qa-ignore="overlap"` en el elemento (ver `qa/README.md`). Un umbral que no sirve en general se cambia con `--set regla.umbral=valor`.

## 8. Historias: varias escenas en un video

Con 2 a 6 temas usá `defineStory` (ver `stories/README.md` y `templates/story/`): arma la apertura, las vueltas al listado y el cierre desde un `StorySpec`. Cada escena de tema:

- es un componente sin `Stage` (la historia ya lo pone) y de duración fija (`durationInFrames`);
- puede usar `useTopic()` y `<TopicHeadline start hide />` para el titular con el nombre del tema;
- termina con `Wash` o atravesando algo;
- puede pasar un `thumbnail` (lienzo de 560×340) para el cierre.

Probá cada escena sola (su propio `defineVideo`, como en `templates/scene/index.ts`) y recién después en la historia.

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
