# fx/data

Efectos de datos: gráficos que se dibujan solos. Todos siguen el contrato de `fx/README.md` (`frame?`, `start?`, `duration?`, `width?`, `height?`, `seed?`, `style?`), son SVG puros del cuadro, toman colores, tipografía y radios del tema y terminan en una imagen fija compuesta. Con valores por defecto: `<LineDraw />` ya funciona.

| Pieza | Para qué sirve | Props principales |
|---|---|---|
| `LineDraw` | Línea que se traza con un punto en la punta, área que se desvanece, ejes y valor que cuenta | `data`, `labels`, `color` (rol), `format`, `title`, `showValue` |
| `DonutRing` | Anillo de progreso con marcas y número al centro | `value`, `max`, `label`, `unit`, `ticks`, `color` |
| `RadarMorph` | Radar de N ejes que pasa de un conjunto de valores a otro | `axes`, `from`, `to` (0..1), `color` |
| `Bars3D` | Barras isométricas que suben en ola, sombreado plano por cara | `data`, `labels`, `format` |
| `BarsGrow` | Barras comunes que crecen escalonadas, con valores | `data`, `labels`, `singleColor`, `format` |
| `FlowSteps` | Pasos en escalera unidos por un conector redondeado que se dibuja | `steps` (`{title, caption?, state?}`), `activeIndex` |

Ayudas puras exportadas (sirven para pruebas y para otras piezas): `trimPolyline`, `pointAt`, `catmullRom`, `parsePath`, `resample`, `morphPoints`, `roundedPolyline`, `niceTicks`, `staggerT`, `donutArc`, `radarValues`, `radarPoints`, `iso`, `boxFaces`.

## Estilo del diseño (`theme.style`)

| Pieza | Qué toma |
|---|---|
| `BarsGrow` | `chart.barRadius`, `chart.fill` (sólido, degradado o rayado con `<defs>` de id derivado de `seed` e índice), `chart.grid` (`on` suma guías, `off` quita la línea base), `motion.stagger` y `motion.overshoot` |
| `LineDraw` | `chart.lineWidth` (la punta lo sigue), `chart.grid`, `chart.fill` del área (sólido = el degradado suave de siempre) |
| `RadarMorph` | `chart.lineWidth`, `chart.grid` (`on` anillos intermedios, `off` solo el exterior), `chart.fill` |
| `FlowSteps` | `shape.corners` (por el factor de `cornerRadius("panel")` sobre `radius.panel`), `surface` (relleno, filo duro o halo), `type.numerals` (el paso pendiente queda atenuado), `motion.stagger` |
| `Bars3D`, `DonutRing` | sin cambio (geometría y cifras de contenido) |

`styleKit.tsx` traduce `surfaceStyle` y `chartFill` a lo que pide un SVG (`parseSurface`, `SvgShadow`, `FillDef`) y suma una entrada del tema a un traslado propio (`entranceWithOffset`). Con el estilo por defecto el resultado es el de antes.
