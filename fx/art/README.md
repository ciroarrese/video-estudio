# fx/art

Efectos de arte y transición. Mismo contrato que el resto de `fx`. `LiquidBlob` usa `FrameCanvas` (campo a baja resolución, ampliado); el resto es SVG puro.

| Pieza | Para qué sirve | Props principales |
|---|---|---|
| `BlueprintDraw` | Contornos que se dibujan sobre una grilla, con cotas y un punto-pluma brillante | `shapes` (`rect`, `line`, `circle`, `path`), `dimensions`, `grid` |
| `MarkerDraw` | Trazos gruesos de marcador con temblor sembrado: resaltar, subrayar, encerrar, tachar | `text`, `kind`, `color`, `seed` |
| `PaperCollage` | Tiras de papel rasgado que llegan, se pasan unos grados y se asientan; al final cae la cinta | `strips` |
| `ShapeMorph` | Pasa entre formas con igual cantidad de puntos o superelipses | `shapes` (`"circle"`, `"square"`, `"star"`, ..., `{superellipse}` o puntos), `count` |
| `DotWipe` | Punto que crece hasta llenar el cuadro; transición de entrada, salida o ambas | `mode` (`in` / `out` / `inout`), `cx`, `cy`, `color`, `edge` |
| `HalftoneWave` | Semitono modulado por una onda que viaja y se detiene | `spacing`, `angle` |
| `PixelBuild` | Texto armado con cuadritos que vuelan a su lugar (cobertura de glifos muestreada en un canvas fuera de pantalla; sin canvas, patrón sembrado) | `text`, `rows`, `seed` |
| `LogoLand` | Trazos que dibujan una marca a través de una máscara; un punto cae, se aplasta y se asienta con una onda | `paths` (SVG en caja de 200), `dot`, `strokeWidth` |
| `LiquidBlob` | Metabolas que se funden | `balls`, `cell` (reducción del campo) |
| `SealSpin` | Sello circular con texto sobre un trazado que gira y frena | `text`, `turns` |
| `RibbonTwist` | Cinta que se retuerce a lo largo de una curva mostrando dos caras | `segments`, `twists`, `ribbonWidth` |

Los datos de trazado aceptan `M L H V C S Q T A Z` (absolutos y relativos). `DotWipe` va a cuadro completo: se superpone a la escena y, con `inout`, termina despejado.
