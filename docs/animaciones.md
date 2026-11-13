# Catálogo de animaciones (`fx/`)

Efectos cortos, temáticos y reutilizables, escritos desde cero (ver `docs/ORIGEN.md`). Es el catálogo único: antes de escribir una animación desde cero, buscá acá si ya existe. Contrato común en `fx/README.md`: cada efecto es una función pura del cuadro, toma colores y tipografías del tema y **su último cuadro es una imagen fija compuesta**. Las reglas de determinismo están en `docs/reglas.md`.

```tsx
import { MaskedRise, BarsGrow } from "../../fx";   // todo sale de fx/index.ts
<MaskedRise text="Resultados del año" start={10} />
```

Todos aceptan `frame?`, `start?`, `duration?`, `width?`, `height?`, `seed?` y `style?` (ver `fx/README.md`); con valores por defecto ya funcionan. Dentro de una escena sin `frame`, usan el cuadro del motor.

## Cómo ver cada efecto

Tres galerías, un efecto por tramo de 90 cuadros (75 de animación y 15 de pausa con la imagen final), con el nombre en una etiqueta:

| Galería | Qué muestra | Ver en el navegador | Hoja de cuadros |
|---|---|---|---|
| `fx-text` | los 8 efectos de texto | `npm run dev` y `/?video=fx-text` | `npm run sheet -- fx-text --count 16` |
| `fx-3d` | los 16 efectos 3D (17 tramos: `PhoneOrbit` con y sin pantalla) | `/?video=fx-3d` | `npm run sheet -- fx-3d --count 17` |
| `fx-data-ui-art` | datos, interfaz y arte (25 tramos) | `/?video=fx-data-ui-art` | `npm run sheet -- fx-data-ui-art --count 25` |

Todas admiten `&props={"theme":"dark"}`. Para ver un solo efecto: el tramo `i` (desde 0, en el orden de las tablas de abajo, o el de la etiqueta) ocupa los cuadros `i*90` a `i*90+89`: `npm run render -- fx-3d --frames 270-359 --scale 0.5 --crf 23` (`CubeFold`, el cuarto de `fx-3d`, es el tramo 3). En `fx-data-ui-art` el orden es datos (0 a 5), interfaz (6 a 13, con `TileDone` en el 13), arte (14 a 24).

## Cómo elegir

| Necesitás | Probá con | Alternativas |
|---|---|---|
| Título de apertura | `MaskedRise` | `KineticWords` (con energía), `ScrambleDecode` (tono técnico), `ExtrudeType` (con volumen), `TypeRing` (portada) |
| Número grande o métrica | `DigitRoll` | `DonutRing` (porcentaje), `SplitFlap` (estado que cambia) |
| Lista de ideas a ritmo | `KineticWords` | `MarqueeBands` |
| Comparación antes/después | `BeforeAfter` | `CardFlip` (dar vuelta una tarjeta) |
| Proceso en pasos | `FlowSteps` | `Helix`, `LayerExplode` (capas) |
| Tendencia o evolución | `LineDraw` | `BarsGrow`, `Bars3D` |
| Comparar categorías | `BarsGrow` | `RadarMorph` (varios ejes), `IsoCity` (mapa de calor en bloques) |
| Mapa, alcance global, red | `Globe` | `ParticleSphere`, `OrbitRings` |
| Notificación o aviso | `NotificationStack` | `ChatThread`, `CommandPalette` |
| Mostrar una app | `PhoneFrame` / `PhoneScroll` con tu contenido | `PhoneOrbit` (gira hacia el espectador; acepta tu interfaz como `children` o `screen`) |
| Cierre con logo | `LogoLand` | `SealSpin`, `MaskedRise` con `dot` |
| Resaltar algo a mano | `MarkerDraw` | los garabatos del kit (`DoodleCircle`, ...) |
| Transición entre escenas | `DotWipe` | `Tunnel`, `HalftoneWave`, `MarqueeBands` (separador) |
| Fondo animado | `WaveDots`, `TerrainMesh` | `HalftoneWave`, `LiquidBlob` |
| Plano técnico, arquitectura | `BlueprintDraw` | `LayerExplode`, `CubeStack` |

## Texto (`fx/text`, galería `fx-text`)

Props comunes de texto: `text`, `fontSize` (por defecto `theme.type.h1`), `color` (rol del tema), `weight`, `align`.

| Componente | Qué hace | Cuándo usarlo | Props principales |
|---|---|---|---|
| `MaskedRise` | Letras o palabras suben desde una máscara, con escalonado y asentado de tamaño (108 % a 100 %); punto de acento opcional que aterriza. | Abrir una sección; titulares y frases clave. | `text`, `by` (`letter` / `word`), `dot`, `dotColor` |
| `KineticWords` | N palabras a corte seco, cada una con su porción de la duración y fondo/color alternados desde el tema. | Ritmo rápido: ideas, enumeraciones, aperturas con energía. | `words`, `pairs`, `maxFontSize` |
| `Typewriter` | Escribe el texto con cursor que parpadea; al terminar aparece un elemento extra. | Comandos, búsquedas, frases con remate. | `text`, `caretColor`, `after` |
| `ScrambleDecode` | Glifos sembrados que se resuelven de izquierda a derecha hasta el texto final. | Descifrar un título, datos que se procesan. | `text`, `glyphs`, `hold` |
| `SplitFlap` | Tablero de salidas: cada loseta gira un número sembrado de veces hasta su letra. | Estados, horarios, un dato que cambia. | `text`, `tileColor`, `glyphs` |
| `DigitRoll` (alias `CountUpSlots`) | Número grande con cada dígito en una ranura de ancho fijo (rueda de cuentakilómetros) y sufijo que aterriza. | Mostrar un dato destacado, métricas. | `value`, `from`, `suffix`, `thousands` |
| `MarqueeBands` | Dos o tres bandas inclinadas con texto repetido, en sentidos opuestos. | Separadores, fondos de energía, cierres. | `lines`, `angle`, `speed`, `pairs` |
| `TypeRing` | Texto en un anillo 3D que gira y se asienta con la frase al frente; atrás, letras espejadas y tenues (`FrameCanvas`). | Portadas, un concepto de "alrededor de todo". | `text`, `radius`, `tilt`, `turns` |

Ayudas: `fitText` / `measureWidth` (tamaño de letra máximo que entra en un ancho; mide con canvas, y en jsdom estima por glifo), para titulares de largo desconocido.

## 3D (`fx/three`, galería `fx-3d`)

Proyectadas a mano (sin librerías 3D). Props comunes (`ThreeProps`): `bg` (rol que tapa lo de atrás; ponelo igual al fondo si el efecto va sobre otra imagen), `ink`, `line`, `accent`; `duration` 75 por defecto.

| Componente | Qué hace | Cuándo usarlo | Props principales |
|---|---|---|---|
| `Globe` | Globo con ciudades y rutas entre ellas. | Mapa, alcance global, red. | `cities`, `routes`, `centerLon` |
| `ParticleSphere` | Grilla de puntos que se vuelve esfera. | Datos o IA en abstracto. | `count`, `accentShare` |
| `CubeStack` | 27 cubos que se ensamblan en uno. | Piezas que forman un todo. | `light` |
| `CubeFold` | Caja que se cierra, con tapa al final. | Paquete, entrega, "todo incluido". | `light` |
| `Tunnel` | Anillos que se acercan. | Avance, velocidad, transición. | `rings`, `accentEvery`, `sides` |
| `TerrainMesh` | Malla de relieve en vuelo, con horizonte en acento. | Fondo sin fin. | `rows`, `cols`, `relief` |
| `TorusWire` | Toro de alambre giratorio. | Decoración, fondo de sección. | `minor`, `segments` |
| `Helix` | Doble hélice con peldaños. | Ciencia, código, ADN. | `steps`, `turns` |
| `OrbitRings` | Núcleo con anillos y satélites. | Un sistema alrededor de un centro. | `rings` |
| `WaveDots` | Campo de puntos con olas viajeras. | Fondo animado. | `grid`, `amplitude` |
| `LayerExplode` | Capas rotuladas que se separan. | Arquitectura por capas. | `labels` (de abajo hacia arriba) |
| `CardFlip` | Tarjeta que se da vuelta entre dos caras. | Antes/después, pregunta/respuesta. | `front`, `back`, `cardWidth`, `cardHeight` |
| `CarouselRing` | Tarjetas en un anillo que gira. | Galería, lista de ejemplos. | `children`, `count`, `cardWidth`, `cardHeight` |
| `IsoCity` | Bloques isométricos que crecen. | Crecimiento, mapa de calor. | `grid`, `maxHeight` |
| `ExtrudeType` | Titular con volumen (capas apiladas). | Títulos con presencia. | `text`, `fontSize`, `layers`, `step` |
| `PhoneOrbit` | Teléfono que gira hasta mirar al espectador, con un anillo en órbita. | Presentar una app, con tu propia interfaz en la pantalla. | `startAngle`, `children` / `screen` |

Notas: **`PhoneOrbit` sin contenido dibuja una pantalla ficticia de formas; con `children` (o `screen({ width, height, frame })`) recibe tu interfaz recreada** en una caja del tamaño de la pantalla (`width: "100%"`, `height: "100%"`), con la misma cámara que el resto del teléfono. Para un teléfono quieto, `PhoneFrame` / `PhoneScroll`. Los trazos, puntos y rótulos de las piezas 3D escalan con el tamaño de la caja. Estas piezas tapan lo que tienen detrás (rellenan con `bg`). Ayudas de cálculo (`rotateX/Y/Z`, `camera`, `sortBackToFront`, `shade`, ...) en `fx/three/math.ts`.

## Datos (`fx/data`, galería `fx-data-ui-art`)

SVG puros; colores, tipografía y radios del tema.

| Componente | Qué hace | Cuándo usarlo | Props principales |
|---|---|---|---|
| `LineDraw` | Línea que se traza con un punto en la punta, área, ejes y valor que cuenta. | Mostrar una tendencia. | `data`, `labels`, `color`, `format`, `title`, `showValue` |
| `DonutRing` | Anillo de progreso con marcas y número al centro. | Un porcentaje o avance. | `value`, `max`, `label`, `unit`, `ticks` |
| `RadarMorph` | Radar de N ejes que pasa de un conjunto a otro. | Comparar perfiles, antes/después en varias dimensiones. | `axes`, `from`, `to` (0..1) |
| `Bars3D` | Barras isométricas que suben en ola. | Comparar categorías con volumen. | `data`, `labels`, `format` |
| `BarsGrow` | Barras comunes que crecen escalonadas, con valores. | Comparar categorías de forma clara. | `data`, `labels`, `singleColor`, `format` |
| `FlowSteps` | Pasos en escalera unidos por un conector que se dibuja. | Un proceso en pasos. | `steps` (`{title, caption?, state?}`), `activeIndex` |

Nota: `Bars3D` ocupa casi todo el cuadro que le das (barras más anchas y altas, rótulos del tamaño `eyebrow`); aun así la proyección isométrica de una fila deja aire a los lados: usá `BarsGrow` si necesitás lectura de valores a distancia.

## Interfaz (`fx/ui`, galería `fx-data-ui-art`)

Interfaces recreadas con el tema (no capturas). Se pueden poner dentro de `World` o en pantalla.

| Componente | Qué hace | Cuándo usarlo | Props principales |
|---|---|---|---|
| `NotificationStack` | Tarjetas que llegan de a una y empujan a las anteriores. | Notificación o aviso. | `items` (`{title, body?, time?}`) |
| `ChatThread` | Burbujas con indicador de "escribiendo" antes de cada respuesta. | Una conversación, un asistente. | `messages` (`{from: "me" \| "them", text}`) |
| `CommandPalette` | Se abre, se escribe una consulta, filtra y "presiona" el primer resultado. | Búsqueda rápida, atajos. | `query`, `items` (`{label, hint?}`) |
| `CardFan` | Tarjetas que salen de una pila y se abren en abanico. | Presentar varias opciones. | `items` o `children`, `spread` |
| `PhoneFrame` | Marco de teléfono que recorta sus hijos a la pantalla. | Mostrar tu propia interfaz en un teléfono. | `children`, `bezel` |
| `PhoneScroll` | Teléfono con contenido que se desplaza y barra de desplazamiento. | Una pantalla larga, un feed. | `children`, `contentHeight` |
| `BeforeAfter` | Manija que revela el "después" sobre el "antes" (por defecto, alambre a diseño). | Comparación antes/después. | `before`, `after`, `rest`, `beforeLabel`, `afterLabel` |
| `TileGrid` | Baldosas que se dan vuelta y se encienden con escalonado sembrado. | Progreso de muchas cosas a la vez. | `cols`, `rows`, `lit`, `seed` |
| `TileDone` | Baldosa que pasa a "hecha" con onda en `start`. | Marcar una tarea como completada junto a un `Cursor`. | `label`, `pendingText`, `doneText` |

## Arte y transiciones (`fx/art`, galería `fx-data-ui-art`)

`LiquidBlob` usa `FrameCanvas`; el resto es SVG puro.

| Componente | Qué hace | Cuándo usarlo | Props principales |
|---|---|---|---|
| `BlueprintDraw` | Contornos que se dibujan sobre una grilla, con cotas y un punto-pluma. | Plano técnico, diseño, arquitectura. | `shapes`, `dimensions`, `grid` |
| `MarkerDraw` | Trazos de marcador con temblor sembrado. | Resaltar, subrayar, encerrar o tachar un texto. | `text`, `kind`, `color`, `seed` |
| `PaperCollage` | Tiras de papel rasgado que llegan y se asientan; cae una cinta. | Collage, tono artesanal. | `strips` |
| `ShapeMorph` | Pasa entre formas con igual cantidad de puntos o superelipses. | Cambio de concepto, fondo. | `shapes`, `count` |
| `DotWipe` | Punto que crece hasta llenar el cuadro. | Transición entre escenas (entrada, salida o ambas). | `mode` (`in` / `out` / `inout`), `cx`, `cy`, `color`, `edge` |
| `HalftoneWave` | Semitono modulado por una onda que viaja y se detiene. | Fondo, transición suave. | `spacing`, `angle` |
| `PixelBuild` | Texto armado con cuadritos que vuelan a su lugar. | Una cifra o palabra con estética retro. | `text`, `rows`, `seed` |
| `LogoLand` | Trazos que dibujan una marca; un punto cae, se aplasta y se asienta. | Cierre con logo. | `paths` (SVG en caja de 200), `dot`, `strokeWidth` |
| `LiquidBlob` | Metabolas que se funden. | Fondo orgánico. | `balls`, `cell` |
| `SealSpin` | Sello circular con texto sobre un trazado que gira y frena. | Sello, garantía, cierre. | `text`, `turns` |
| `RibbonTwist` | Cinta que se retuerce mostrando dos caras. | Decoración, separador. | `segments`, `twists`, `ribbonWidth` |

Notas: **`PixelBuild` muestrea la cobertura de los glifos en un canvas fuera de pantalla y espera a que cargue la tipografía del tema** (`holdRender` hasta que esté lista; la memoria de celdas es acotada y su clave incluye la fuente); sin canvas (pruebas), usa un patrón sembrado. Verificá en la hoja que la forma sea legible. `DotWipe` va a cuadro completo: se superpone a la escena y, con `inout`, termina despejado. Los trazados (`path`) aceptan `M L H V C S Q T A Z`, absolutos y relativos.

## Principios

1. **Tres curvas alcanzan.** `Easing.out` (entradas), `Easing.inOut` (desplazamientos entre dos reposos, giros) y `Easing.lands` / `Easing.back` (pasan un poco de largo y se asientan: puntos, etiquetas, botones). La lineal, solo para movimientos continuos.
2. **Escalonados chicos.** Entre elementos de una serie, 1 a 3 cuadros de demora; el total de una serie rara vez pasa de 30 cuadros.
3. **Corte seco entre palabras** (`KineticWords`): el movimiento ocurre dentro de cada palabra, no entre ellas.
4. **El último cuadro es un still.** Todo efecto termina compuesto y legible; se puede congelar para una miniatura o como primera imagen de la escena siguiente.
5. **Oclusión pintando de lejos a cerca** y **profundidad con opacidad y grosor**: lo lejano se desvanece y se afina; lo cercano es más grande y más opaco. En `fx/three` la perspectiva se proyecta a mano.
6. **Raster estable.** Para que el render sea idéntico según el historial de cuadros, ver la lista única en `docs/reglas.md` (traslados enteros, `scale()` sobre texto solo si la pieza pasa `--check` completo, CSS 3D solo como `perspective()` propio de cada elemento, sin sombras bajo `rotate()`).

## Base común

- `engine`: `Easing.back`, `Easing.lands`, `FrameCanvas`, `random`.
- `fx/core`: `stagger`, `staggerBy`, `progress`, `phases`, `clip`, `sub`, `seededShuffle`, `lerp`, `clamp`, `mix`, `Clip`, `FxProps`, `useFx`, `roleColor`, `chartColor`.
- Cómo combinarlos con cámara, cursor y garabatos del kit: `docs/guia-escenas.md`, sección 9.
