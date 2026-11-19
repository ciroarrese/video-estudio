# Catálogo de animaciones (`fx/`)

Efectos cortos, temáticos y reutilizables, escritos desde cero (ver `docs/ORIGEN.md`). Es el catálogo único: antes de escribir una animación desde cero, buscá acá si ya existe. Contrato común en `fx/README.md`: cada efecto es una función pura del cuadro, toma colores y tipografías del tema y **su último cuadro es una imagen fija compuesta**. Las reglas de determinismo están en `docs/reglas.md`.

```tsx
import { MaskedRise, BarsGrow } from "../../fx";   // todo sale de fx/index.ts
<MaskedRise text="Resultados del año" start={10} />
```

Todos aceptan `frame?`, `start?`, `duration?`, `width?`, `height?`, `seed?` y `style?` (ver `fx/README.md`); con valores por defecto ya funcionan. Los que lo dicen en "Cajas chicas" aceptan además `density`. Dentro de una escena sin `frame`, usan el cuadro del motor.

## Cómo ver cada efecto

Tres galerías con un efecto por tramo de 90 cuadros (75 de animación y 15 de pausa con la imagen final, con el nombre en una etiqueta), más dos ejemplos que no son galerías (`fx-muro`: muestrario en lazo; `fx-in-scene`: regresión):

| Galería | Qué muestra | Ver en el navegador | Hoja de cuadros |
|---|---|---|---|
| `fx-text` | los 8 efectos de texto | `npm run dev` y `/?video=fx-text` | `npm run sheet -- fx-text --count 16` |
| `fx-3d` | los 16 efectos 3D (17 tramos: `PhoneOrbit` con y sin pantalla) | `/?video=fx-3d` | `npm run sheet -- fx-3d --count 17` |
| `fx-data-ui-art` | datos, interfaz y arte (25 tramos) | `/?video=fx-data-ui-art` | `npm run sheet -- fx-data-ui-art --count 25` |
| `fx-muro` | muestrario de referencia: 20 efectos en baldosas chicas, todos en `Loop`, con `density`, más una escena anidada (`NestedScene`) | `/?video=fx-muro` (`&props={"density":"off"}` para compararlo) | `npm run sheet -- fx-muro --count 8` |
| `fx-in-scene` | ejemplo de regresión: efectos montados desde el cuadro 0 dentro de una escena real, antes de su `start` y después de terminar | `/?video=fx-in-scene` | `npm run sheet -- fx-in-scene --count 12` |

Las galerías admiten `&props={"theme":"dark"}`; `fx-in-scene` no es una galería de efectos: es la prueba de que un efecto puede quedar montado todo el tiempo sin ensuciar el render (ver "Efectos montados"). Para ver un solo efecto: el tramo `i` (desde 0, en el orden de las tablas de abajo, o el de la etiqueta) ocupa los cuadros `i*90` a `i*90+89`: `npm run render -- fx-3d --frames 270-359 --scale 0.5 --crf 23` (`CubeFold`, el cuarto de `fx-3d`, es el tramo 3). En `fx-data-ui-art` el orden es datos (0 a 5), interfaz (6 a 13, con `TileDone` en el 13), arte (14 a 24).

## Cómo elegir

Esta tabla da el efecto por función; después filtrá por el carácter del design system con "Afinidad con el design system" (más abajo).

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
| Señalar o llamar la atención sobre algo | `Callout` (la señal la decide el tema; con `focus`, más `FocusGroup`) | `MarkerDraw` y los garabatos del kit, solo si el design system es de trazo a mano |
| Tutorial de interfaz: señalar pasos, uno tras otro, con la cámara siguiendo cada foco | `StepFrame` del kit (cámara guiada por focos, etiqueta junto al foco, `DataCard` y `ProgressBar`); ejemplo `examples/tutorial-demo`, plantilla `npm run nuevo -- paso <slug> <nombre>` | `guidedCameraKeys` + `projectRect` + `Callout` con `fixed`, si el marco no alcanza (ver `kit/README.md`, "Tutorial de interfaz") |
| Un importe o una cifra de la interfaz que a tamaño real no se lee | `DataCard` (rótulo y valor grande junto al foco) | `DigitRoll` si el número tiene que contar |
| Que un efecto se repita mientras se muestra | `Loop` (envuelve cualquier efecto: pausa, desfase, fundido o ida y vuelta) | - |
| Transición entre escenas | `Wash` (sigue a `motion.transition`) | `DotWipe` (lúdico), `Tunnel`, `HalftoneWave`, `MarqueeBands` (separador) |
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
| `CardFlip` | Tarjeta que se da vuelta entre dos caras. | Antes/después, pregunta/respuesta. | `front`, `back`, `cardWidth`, `cardHeight`, `crisp` (borde nítido en cajas chicas: superficie entera y sin `scale`; lo usa `fx-muro`) |
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

Nota: `DonutRing` sin `unit` muestra en el centro el porcentaje de `max` (`value=4, max=4` da "100%"); con `unit` muestra el valor absoluto seguido de la unidad (`unit=" tareas"` da "4 tareas"; `unit=""` da "4"). Debajo va `label`, que por defecto es "Avance" (con `label=""` se apaga). Para dimensionarlo: `DONUT_SIZE` y `donutGeometry`. Nota: `Bars3D` ocupa casi todo el cuadro que le das (barras más anchas y altas, rótulos del tamaño `eyebrow`); aun así la proyección isométrica de una fila deja aire a los lados: usá `BarsGrow` si necesitás lectura de valores a distancia.

## Interfaz (`fx/ui`, galería `fx-data-ui-art`)

Interfaces recreadas con el tema (no capturas). Se pueden poner dentro de `World` o en pantalla.

| Componente | Qué hace | Cuándo usarlo | Props principales |
|---|---|---|---|
| `NotificationStack` | Tarjetas que llegan de a una y empujan a las anteriores. | Notificación o aviso. | `items` (`{title, body?, time?}`) |
| `ChatThread` | Burbujas con indicador de "escribiendo" antes de cada respuesta. | Una conversación, un asistente. | `messages` (`{from: "me" \| "them", text}`) |
| `CommandPalette` | Se abre, se escribe una consulta, filtra y "presiona" el primer resultado. | Búsqueda rápida, atajos. | `query`, `items` (`{label, hint?}`) |
| `CardFan` | Tarjetas que salen de una pila y se abren en abanico. | Presentar varias opciones. | `items` o `children`, `spread` |
| `PhoneFrame` | Marco de teléfono que recorta sus hijos a la pantalla. | Mostrar tu propia interfaz en un teléfono. | `children`, `bezel`, `bezelColor` |
| `PhoneScroll` | Teléfono con contenido que se desplaza y barra de desplazamiento. | Una pantalla larga, un feed. | `children`, `contentHeight` |
| `BeforeAfter` | Manija que revela el "después" sobre el "antes" (por defecto, alambre a diseño). | Comparación antes/después. | `before`, `after`, `rest`, `beforeLabel`, `afterLabel` |
| `TileGrid` | Baldosas que se dan vuelta y se encienden con escalonado sembrado. | Progreso de muchas cosas a la vez. | `cols`, `rows`, `lit`, `seed` |
| `TileDone` | Baldosa que pasa a "hecha" con onda en `start`. | Marcar una tarea como completada junto a un `Cursor`. | `label`, `pendingText`, `doneText` |

Ayudas de tamaño de la interfaz (se importan de `fx/`): `phoneScreen(width, height, bezel?)` da la caja `{ x, y, width, height }` de la pantalla de un `PhoneFrame` (para dimensionar tu contenido: el marco no lo hace por vos); `phoneScreenRadius(theme)` y las constantes `PHONE_SIZE` y `PHONE_BEZEL` (tamaño y marco por defecto) completan el cálculo. De `NotificationStack`: `NOTIFICATION_SIZE` (caja por defecto), `NOTIFICATION_CARD_HEIGHT`, `notificationPitch(height, count)` (distancia entre tarjetas) y `stackOffsets(arrivals, pitch)` (desplazamiento vertical de cada tarjeta). En vertical, calculá el `width`/`height` del teléfono para que llene el cuadro (ver "Para que no parezca un borrador" en `docs/guia-escenas.md`).

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

## Afinidad con el design system

Antes de elegir un efecto mirá el **carácter** del design system que te dieron: `geométrico-sobrio` (formas limpias, flechas rectas, sin adornos), `editorial` (esquinas rectas, contorno, serif, subrayados y corchetes), `lúdico-manual` (trazo a mano, superficies cálidas, marcador) y `técnico-oscuro` (fondo oscuro, líneas finas, halos, mallas). `themeCharacter(theme)` (en `themes/`) devuelve el que el tema declara (`style.decor.character`, token `--style-decor-character`) y, si no declara ninguno, lo deduce del estilo (en los cinco temas de ejemplo: `neutral` geométrico-sobrio, `dark` y `neon` técnico-oscuro, `editorial`, `papel` lúdico-manual); la deducción es solo el respaldo, y un design system propio puede no encajar del todo: declaralo en el tema o decidilo vos y anotalo en el guion. "Evitar" no es una prohibición: es lo que desentona con ese carácter salvo que el guion lo justifique y lo adaptes con `theme.style`. El dato también está en código (`FX_AFFINITY`, `affinityOf(nombre)` y `fxFor(carácter | tema)` en `fx/affinity.ts`, que se exportan de `fx/`).

**Señalar no es un efecto del catálogo: lo decide el tema.** Para llamar la atención sobre algo usá `Callout` (kit), que dibuja la señal de `style.annotation.mark` (flecha recta, línea con codo y punto, corchete, anillo, trazo a mano, etiqueta pegada, foco, subrayado o ninguna). `MarkerDraw` y los garabatos del kit son para sistemas de trazo a mano; no uses flechas por costumbre. La transición entre escenas es `Wash` (sigue a `motion.transition`); `DotWipe` es una elección lúdica, no la de siempre. Una capa decorativa que debe seguir continua durante todo el video (partículas de fondo) no es un efecto de escena: va en `spec.backdrop` de la historia (`stories/README.md`).

| Efecto | Encaja con | Evitar en | Nota |
|---|---|---|---|
| `MaskedRise` | todos | - | Entrada limpia de titulares; sirve en cualquier sistema (el tema decide la llegada con text.arrival). |
| `KineticWords` | geométrico-sobrio, técnico-oscuro, lúdico-manual | editorial | Corte seco y energía: evitarlo en un sistema editorial sobrio. |
| `Typewriter` | técnico-oscuro, editorial | - | Comandos y citas; el cursor sigue a text.caret. |
| `ScrambleDecode` | técnico-oscuro | editorial, lúdico-manual | Tono técnico o de cifrado; desentona con un sistema editorial o manual. |
| `SplitFlap` | geométrico-sobrio, técnico-oscuro | lúdico-manual | Tablero mecánico; evitarlo donde el sistema es cálido y manual. |
| `DigitRoll` | geométrico-sobrio, técnico-oscuro, editorial | - | Cifra destacada; neutro en casi todos. |
| `MarqueeBands` | lúdico-manual, técnico-oscuro | editorial | Bandas inclinadas con energía; evitarlo en un sistema sobrio y de márgenes amplios. |
| `TypeRing` | técnico-oscuro, lúdico-manual | editorial | Portada con volumen; recargado para un sistema editorial. |
| `Globe` | geométrico-sobrio, técnico-oscuro | - | Alcance y red; pide líneas finas (line.weight) en sistemas editoriales. |
| `ParticleSphere` | técnico-oscuro | editorial, lúdico-manual | Datos o IA en abstracto; frío y tecnológico. |
| `CubeStack` | geométrico-sobrio, técnico-oscuro | lúdico-manual | Piezas que forman un todo, geométrico. |
| `CubeFold` | geométrico-sobrio, técnico-oscuro | lúdico-manual | Entrega o paquete, geométrico. |
| `Tunnel` | técnico-oscuro | editorial, lúdico-manual | Velocidad y avance; enérgico, no sobrio. |
| `TerrainMesh` | técnico-oscuro | editorial, lúdico-manual | Fondo de malla; técnico. |
| `TorusWire` | técnico-oscuro, geométrico-sobrio | lúdico-manual | Decoración de alambre. |
| `Helix` | técnico-oscuro, geométrico-sobrio | lúdico-manual | Ciencia o código. |
| `OrbitRings` | geométrico-sobrio, técnico-oscuro | lúdico-manual | Un sistema alrededor de un centro. |
| `WaveDots` | técnico-oscuro, geométrico-sobrio | editorial | Fondo animado de puntos; evitarlo en un sistema editorial de fondo liso o de grilla. |
| `LayerExplode` | geométrico-sobrio, técnico-oscuro, editorial | - | Capas rotuladas; claro y diagramático. |
| `CardFlip` | geométrico-sobrio, editorial, lúdico-manual | - | Antes y después; con tarjetas del tema. |
| `CarouselRing` | geométrico-sobrio, técnico-oscuro | editorial | Galería en anillo; vistoso, no sobrio. |
| `IsoCity` | geométrico-sobrio, técnico-oscuro | lúdico-manual | Bloques isométricos. |
| `ExtrudeType` | técnico-oscuro, geométrico-sobrio | editorial | Volumen en el titular; el tema elige la extrusión (depth.extrude). |
| `PhoneOrbit` | geométrico-sobrio, técnico-oscuro | - | Presentar una app con tu interfaz en la pantalla. |
| `LineDraw` | todos | - | Tendencia; sigue chart.lineWidth y chart.grid. |
| `DonutRing` | geométrico-sobrio, técnico-oscuro, lúdico-manual | - | Porcentaje; en un sistema editorial preferí BarsGrow. |
| `RadarMorph` | geométrico-sobrio, técnico-oscuro | lúdico-manual | Perfiles en varios ejes. |
| `Bars3D` | técnico-oscuro, geométrico-sobrio | editorial | Barras con volumen; en un sistema editorial preferí BarsGrow. |
| `BarsGrow` | todos | - | Comparar categorías; sigue chart.barRadius, chart.fill y chart.grid. |
| `FlowSteps` | todos | - | Proceso en pasos; sigue la forma de panel del tema. |
| `NotificationStack` | geométrico-sobrio, técnico-oscuro, lúdico-manual | - | Avisos; superficie y entrada del tema. |
| `ChatThread` | geométrico-sobrio, técnico-oscuro, lúdico-manual | - | Conversación. |
| `CommandPalette` | técnico-oscuro, geométrico-sobrio | lúdico-manual | Búsqueda rápida, técnica. |
| `CardFan` | geométrico-sobrio, lúdico-manual | - | Varias opciones en abanico. |
| `PhoneFrame` | todos | - | Marco para tu interfaz. |
| `PhoneScroll` | todos | - | Pantalla larga o feed. |
| `BeforeAfter` | todos | - | Comparación; manija neutra. |
| `TileGrid` | geométrico-sobrio, técnico-oscuro | editorial | Progreso de muchas cosas a la vez. |
| `TileDone` | todos | - | Tarea completada junto a un cursor. |
| `BlueprintDraw` | técnico-oscuro, editorial, geométrico-sobrio | lúdico-manual | Plano técnico; líneas finas. |
| `MarkerDraw` | lúdico-manual, editorial | técnico-oscuro | Trazo de marcador; evitarlo en un sistema técnico oscuro (usá Callout con la señal del tema). |
| `PaperCollage` | lúdico-manual | geométrico-sobrio, técnico-oscuro, editorial | Collage artesanal; solo con un sistema manual. |
| `ShapeMorph` | geométrico-sobrio, técnico-oscuro | editorial | Cambio de concepto, geométrico. |
| `DotWipe` | lúdico-manual, geométrico-sobrio | editorial | Transición con un punto que crece; lúdica. En un sistema editorial usá Wash con motion.transition wipe. |
| `HalftoneWave` | geométrico-sobrio, técnico-oscuro, editorial | - | Fondo o transición suave de semitono. |
| `PixelBuild` | técnico-oscuro | editorial, lúdico-manual | Estética retro; solo si el sistema la tiene. |
| `LogoLand` | todos | - | Cierre con marca. |
| `LiquidBlob` | lúdico-manual, geométrico-sobrio | editorial, técnico-oscuro | Fondo orgánico; evitarlo en un sistema editorial o técnico. |
| `SealSpin` | editorial, lúdico-manual, geométrico-sobrio | técnico-oscuro | Sello de cierre. |
| `RibbonTwist` | lúdico-manual, geométrico-sobrio | editorial, técnico-oscuro | Decoración con cinta. |


## Lazo: `Loop` (un muestrario nunca queda estático)

**Regla: un efecto que se muestra solo (un muestrario, un muro de baldosas, el catálogo en pantalla) no queda quieto con su imagen final: se repite mientras está a la vista.** Un efecto termina en un still (su último cuadro es una imagen compuesta), y un still de varios segundos en una baldosa parece un error. `Loop` (de `fx/`, también `loopState` para sincronizar otra cosa con el lazo) lo resuelve con una función pura del cuadro, sin estado ni temporizadores:

```tsx
import { Loop, Globe } from "../../fx";
// el efecto corre 60 cuadros, se queda 24 quieto, se funde y vuelve a empezar; cada baldosa con su desfase para que no pulsen juntas
<Loop duration={60} pause={24} offset={i * 9}>
  <Globe start={0} duration={60} width={W} height={H} />
</Loop>
```

| Prop | Qué hace |
|---|---|
| `duration` | cuadros que dura el efecto (el mismo `duration` que le das al efecto; hace falta para saber cuándo termina) |
| `pause` | cuadros con la imagen final quieta antes de volver a empezar (20 por defecto) |
| `offset` | desfase en cuadros (`i * 9`): la primera vuelta ya empieza avanzada; cada baldosa con el suyo |
| `start` | cuadro en que arranca la primera vuelta (antes, el efecto está en su cuadro 0) |
| `mode` | `fade` (por defecto): la imagen final se funde y la vuelta siguiente entra con fundido (`fadeOut` 8 y `fadeIn` 6 cuadros): nunca hay una pieza vacía; `pingpong`: ida, pausa y vuelta por el mismo camino, sin cortes; `restart`: corte seco al cuadro 0 (solo si ese cuadro ya es una imagen completa) |
| `times`, `fadeFirst` | cantidad de vueltas (después queda en la imagen final) y fundido también en la primera |
| hijos | el efecto, o una función `(local, estado) => nodo` (`estado.index` es el número de vuelta: sirve para variar la `seed` en cada vuelta) |

Adentro, `useFrame()` es el cuadro local (0 al empezar cada vuelta): el efecto va con `start={0}`. El contenedor ocupa a su padre (`position: relative; width/height: 100%`; `style` lo pisa) y solo lleva `opacity` mientras funde, así que pasa `--check` (los efectos del catálogo no dejan residuos antes de `start` ni al terminar). `examples/fx-muro` es el muestrario de referencia: 17 efectos en baldosas chicas, todos en lazo, más una escena anidada.

## Cajas chicas: `density`

Los efectos se diseñan para una caja (`LineDraw` 900 x 520, `NotificationStack` 760 x 560...). En una baldosa de 330 x 150, sin ayuda, la letra, los trazos y los márgenes quedan a escala de diseño y el efecto se ve apretado o recortado. La prop `density` los achica todos juntos:

- sin `density` (por defecto): el efecto de siempre, píxel a píxel (los videos ya hechos no cambian);
- `density="auto"`: el factor sale de la caja (`min(ancho / ancho de diseño, alto / alto de diseño)`, nunca más que 1 ni menos que 0,3);
- `density={0.6}`: un factor explícito (0,25 a 2).

Lo implementan `LineDraw`, `TileDone`, `NotificationStack` (la caja de diseño tiene el alto justo para las tarjetas que hay), `DigitRoll` (con `auto` y `width`, la letra baja lo justo para que la cifra con su sufijo entre), `CardFlip` (borde, elevación y, con tus propias caras, la escala a la que se dibujan: se diseñan para una tarjeta de 620 x 400), `FlowSteps`, `RadarMorph`, `ChatThread` (caja de diseño 760 x 560: letra, relleno, separación y puntos de "escribiendo"), `CommandPalette` (900 x 560: buscador, filas, letra y márgenes, y con ello la caja de búsqueda deja de cortarse en una caja de 330 px), `BeforeAfter` (900 x 560: rótulos, manija y borde; el "antes" y el "después" por defecto se dibujan en la caja de diseño y se achican con ella) y `MarkerDraw` (560 x 160: el trazo y el tope de la letra que depende del alto; la letra ya seguía el ancho de la caja, así que con una caja ancha y baja el cambio es pequeño). Los de `fx/three` ya escalan sus trazos con la caja (`strokeScale`). Revisado en `examples/fx-muro` (baldosas de 285 x 150 de contenido; `{"density":"off"}` las deja en su tamaño de diseño, para comparar; ver el comentario del archivo sobre `data-qa-decor`): `DonutRing`, `BarsGrow`, `TileGrid`, `MaskedRise`, `Typewriter`, `ScrambleDecode`, `SplitFlap` y `Globe` se adaptan bien con `width`/`height` y no necesitan `density`. En una caja ancha y baja el piso de 0,3 de `auto` deja a `ChatThread` y `CommandPalette` con letra ilegible (su caja de diseño es casi cuadrada): el muro les fija 0,55.

## Principios

1. **Tres curvas alcanzan.** `Easing.out` (entradas), `Easing.inOut` (desplazamientos entre dos reposos, giros) y `Easing.lands` / `Easing.back` (pasan un poco de largo y se asientan: puntos, etiquetas, botones). La lineal, solo para movimientos continuos.
2. **Escalonados chicos.** Entre elementos de una serie, 1 a 3 cuadros de demora; el total de una serie rara vez pasa de 30 cuadros.
3. **Corte seco entre palabras** (`KineticWords`): el movimiento ocurre dentro de cada palabra, no entre ellas.
4. **El último cuadro es un still.** Todo efecto termina compuesto y legible; se puede congelar para una miniatura o como primera imagen de la escena siguiente.
5. **Oclusión pintando de lejos a cerca** y **profundidad con opacidad y grosor**: lo lejano se desvanece y se afina; lo cercano es más grande y más opaco. En `fx/three` la perspectiva se proyecta a mano.
6. **Efectos montados: pueden estar desde el cuadro 0.** **Antes de `start` no se ve nada de un efecto** (ni rótulos, ni valores, ni formas): los que tienen texto quedan ocultos con `opacity: 0` mientras no empezaron (`hiddenBefore(local)` de `fx/core`; lo prueba `fx/antesDeStart.test.tsx` para todo el catálogo, con los que esconden el texto bajo una máscara, `MaskedRise` y `KineticWords`, comprobados por su estructura) y desde `start` no emiten esa opacidad. Una vez terminados no emiten `transform`, `filter` ni `opacity` (en reposo no queda `scale(1)` ni `opacity: 1`), así que montarlos de más no ensucia el render; **un efecto propio que tenga texto tiene que cumplir lo mismo** (`...hiddenBefore(local)` al final del `style` de la raíz); `examples/fx-in-scene` es el ejemplo de regresión. Si querés que su estado inicial se vea antes de `start` (el "0" de un `DigitRoll` cuyo bloque ya entra con un fundido), pasale `frame={Math.max(f, start)}`: el cuadro local queda en 0 y no se oculta. Si `--check` falla con un efecto, seguí `docs/reglas.md`, sección "Qué hacer cuando --check falla".
7. **Raster estable.** Para que el render sea idéntico según el historial de cuadros, ver la lista única en `docs/reglas.md` (traslados enteros, `scale()` sobre texto solo si la pieza pasa `--check` completo, CSS 3D solo como `perspective()` propio de cada elemento, sin sombras bajo `rotate()`).

## Base común

- `engine`: `Easing.back`, `Easing.lands`, `FrameCanvas`, `random`.
- `fx/core`: `stagger`, `staggerBy`, `progress`, `phases`, `clip`, `sub`, `seededShuffle`, `lerp`, `clamp`, `mix`, `Clip`, `FxProps`, `useFx`, `roleColor`, `chartColor`.
- Para quien escribe un efecto nuevo (que en reposo no deje residuos): `xform({ x, y, scale, rotate, round })` arma un `transform` solo con las partes que no son identidad (`undefined` si todas lo son), `fade(opacidad)` devuelve la opacidad a emitir (`undefined` si es casi 1, así no queda `opacity: 0.999`), `svgScale(cx, cy, s)` es el equivalente SVG de una escala alrededor de un punto (`undefined` con escala 1) y `styleKey(obj)` da la lista de propiedades presentes de un estilo (queda como `key` opcional: la comparación de `--check` ya ignora el orden de las propiedades, así que no hace falta para eso). Un efecto propio con `<text>` en un `<svg>` pone `textRendering: "geometricPrecision"` en el `<svg>` (el texto SVG bajo un `scale()` se rasteriza según el historial; lo prueba `fx/textoSvg.test.tsx` para todo el catálogo). Ver sus comentarios en `fx/core/math.ts`.
- Cómo combinarlos con cámara, cursor y garabatos del kit: `docs/guia-escenas.md`, sección 9.
