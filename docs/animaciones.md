# Catálogo de animaciones (`fx/`)

Efectos cortos, temáticos y reutilizables, escritos desde cero (ver `docs/ORIGEN.md`). Contrato común en `fx/README.md`: cada efecto es una función pura del cuadro, toma sus colores y tipografías del tema, y **su último cuadro es una imagen fija compuesta**. Se importan de `fx` (`import { MaskedRise } from "../../fx"`). La galería de texto se ve con `npm run dev` y `/?video=fx-text` (admite `&props={"theme":"dark"}`).

## Principios

1. **Tres curvas alcanzan.** `Easing.out` (arranca rápido y frena: entradas y todo lo que llega), `Easing.inOut` (arranca y frena: desplazamientos entre dos posiciones de reposo, giros) y `Easing.lands` / `Easing.back` (pasan un poco de largo y se asientan: cosas que "aterrizan", puntos, etiquetas, botones). Evitar la lineal salvo para movimientos continuos (cintas, giros constantes).
2. **Escalonados chicos.** Entre elementos de una serie, 1 a 3 cuadros de demora (`stagger`); con más, la serie se lee como lista lenta y no como un gesto. El total de una serie rara vez pasa de 30 cuadros.
3. **Corte seco entre palabras.** Para ritmo (`KineticWords`) cada palabra ocupa una porción igual y reemplaza a la anterior sin fundido; el movimiento ocurre adentro de cada palabra, no entre ellas.
4. **El último cuadro es un still.** Todo efecto termina compuesto y legible: se puede congelar para una miniatura, una pausa o la primera imagen de la escena siguiente. Por eso cada efecto lleva un tramo de pausa después de `duration`.
5. **Oclusión pintando de lejos a cerca.** En lo que simula profundidad (`TypeRing`, y los efectos 3D), se calcula la profundidad de cada pieza y se dibuja ordenando de atrás hacia adelante; no hace falta nada más para que lo de adelante tape lo de atrás.
6. **Profundidad con opacidad y grosor.** Lo lejano se desvanece (en el anillo, las letras de atrás a ~16 %) y las líneas lejanas se afinan; lo cercano es más grande, más opaco y más grueso. La perspectiva se proyecta a mano, nunca con `perspective`/`rotateX` de CSS.
7. **Raster estable.** Para que el render sea idéntico según el historial de cuadros: traslados en píxeles enteros, nada de `scale()` sobre texto (el asentado de tamaño se hace con `font-size`), y lo que no cabe en DOM se dibuja en `FrameCanvas`.

## Texto

| Componente | Qué hace | Cuándo usarlo | Estado |
|---|---|---|---|
| `MaskedRise` | Letras o palabras suben desde una máscara con escalonado y asentado de tamaño (108 % a 100 %); punto de acento opcional que aterriza. | Titulares de apertura y frases clave. | listo |
| `KineticWords` | N palabras a corte seco, cada una con su porción de la duración y fondo/color alternados desde el tema; usa `MaskedRise`. | Ritmo rápido: listas de ideas, enumeraciones, aperturas con energía. | listo |
| `Typewriter` | Escribe el texto con cursor que parpadea; al terminar aparece un elemento extra (etiqueta, ícono). | Comandos, búsquedas, frases con un remate. | listo |
| `ScrambleDecode` | Glifos al azar (sembrados) que se resuelven de izquierda a derecha hasta el texto final, en ranuras de ancho fijo. | Descifrar un título, "datos" que se procesan. | listo |
| `SplitFlap` | Tablero de salidas: la mitad superior del glifo viejo cae y descubre el nuevo; cada loseta gira un número sembrado de veces, escalonadas. | Estados, horarios, un dato que cambia. | listo |
| `DigitRoll` (`CountUpSlots`) | Número grande que cuenta con cada dígito en su ranura de ancho fijo (rueda tipo cuentakilómetros) y un sufijo que aterriza. | Cifras destacadas, métricas. | listo |
| `MarqueeBands` | Dos o tres bandas inclinadas con texto repetido que se deslizan en sentidos opuestos. | Fondos de energía, separadores, cierres. | listo |
| `TypeRing` | Texto en un anillo 3D que gira y se asienta con la frase al frente; atrás, letras espejadas, achatadas y a ~16 % de opacidad (`FrameCanvas`). | Un concepto de "alrededor de todo", portadas. | listo |
| `fitText` / `measureWidth` | Ayuda: tamaño de letra máximo que entra en un ancho (mide con canvas; estimación por glifo en jsdom). | Cualquier titular de largo desconocido. | listo |

## 3D

| Componente | Qué hace | Cuándo usarlo | Estado |
|---|---|---|---|
| `Globe` | _pendiente_ | _pendiente_ | pendiente |
| `ParticleSphere` | _pendiente_ | _pendiente_ | pendiente |
| `CubeStack` | _pendiente_ | _pendiente_ | pendiente |
| `Tunnel` | _pendiente_ | _pendiente_ | pendiente |
| `TerrainMesh` | _pendiente_ | _pendiente_ | pendiente |
| `TorusWire` | _pendiente_ | _pendiente_ | pendiente |
| `Helix` | _pendiente_ | _pendiente_ | pendiente |
| `LayerExplode` | _pendiente_ | _pendiente_ | pendiente |
| `CardFlip` | _pendiente_ | _pendiente_ | pendiente |
| `CarouselRing` | _pendiente_ | _pendiente_ | pendiente |
| `ExtrudeType` | _pendiente_ | _pendiente_ | pendiente |
| `IsoCity` | _pendiente_ | _pendiente_ | pendiente |
| `PhoneOrbit` | _pendiente_ | _pendiente_ | pendiente |
| `WaveDots` | _pendiente_ | _pendiente_ | pendiente |
| `OrbitRings` | _pendiente_ | _pendiente_ | pendiente |
| `CubeFold` | _pendiente_ | _pendiente_ | pendiente |

## Datos

| Componente | Qué hace | Cuándo usarlo | Estado |
|---|---|---|---|
| `LineDraw` | _pendiente_ | _pendiente_ | pendiente |
| `DonutRing` | _pendiente_ | _pendiente_ | pendiente |
| `RadarMorph` | _pendiente_ | _pendiente_ | pendiente |
| `Bars3D` | _pendiente_ | _pendiente_ | pendiente |
| `FlowSteps` | _pendiente_ | _pendiente_ | pendiente |

## Interfaz

| Componente | Qué hace | Cuándo usarlo | Estado |
|---|---|---|---|
| `NotificationStack` | _pendiente_ | _pendiente_ | pendiente |
| `ChatThread` | _pendiente_ | _pendiente_ | pendiente |
| `CommandPalette` | _pendiente_ | _pendiente_ | pendiente |
| `CardFan` | _pendiente_ | _pendiente_ | pendiente |
| `PhoneScroll` | _pendiente_ | _pendiente_ | pendiente |
| `BeforeAfter` | _pendiente_ | _pendiente_ | pendiente |
| `TileGrid` | _pendiente_ | _pendiente_ | pendiente |

## Arte

| Componente | Qué hace | Cuándo usarlo | Estado |
|---|---|---|---|
| `BlueprintDraw` | _pendiente_ | _pendiente_ | pendiente |
| `MarkerDraw` | _pendiente_ | _pendiente_ | pendiente |
| `PaperCollage` | _pendiente_ | _pendiente_ | pendiente |
| `ShapeMorph` | _pendiente_ | _pendiente_ | pendiente |
| `DotWipe` | _pendiente_ | _pendiente_ | pendiente |
| `HalftoneWave` | _pendiente_ | _pendiente_ | pendiente |
| `PixelBuild` | _pendiente_ | _pendiente_ | pendiente |
| `LogoLand` | _pendiente_ | _pendiente_ | pendiente |
| `LiquidBlob` | _pendiente_ | _pendiente_ | pendiente |
| `SealSpin` | _pendiente_ | _pendiente_ | pendiente |
| `RibbonTwist` | _pendiente_ | _pendiente_ | pendiente |

## Base común

- `engine`: `Easing.back`, `Easing.lands`, `FrameCanvas`.
- `fx/core`: `stagger`, `staggerBy`, `progress`, `phases`, `clip`, `sub`, `seededShuffle`, `lerp`, `clamp`, `mix`, `random`, `Clip`, `FxProps`, `useFx`, `roleColor`, `chartColor`.
