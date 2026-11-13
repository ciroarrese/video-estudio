# fx/three

Efectos 3D proyectados a mano (sin librerías 3D): se rota cada punto, se proyecta con perspectiva simple, se ordena de atrás hacia adelante y se dibuja. Todo sale del tema (`useTheme()`); todas las piezas son funciones puras del cuadro y el último cuadro (`frame >= start + duration`) es un still compuesto. Se importa de `fx/three` (o de `fx`, cuando el índice lo reexporte).

## Props comunes (`ThreeProps`)

`frame?`, `start?`, `duration?` (75 por defecto), `width?`, `height?`, `size?`, `seed?`, `style?`, más sobrescrituras de color por rol del tema: `bg` (relleno que tapa lo de atrás), `ink` (trazos principales y texto), `line` (líneas finas), `accent`. Por defecto: `bg`, `text`, `textMuted`, `accent`.

## Piezas

| Pieza | Para qué sirve | Props principales |
|---|---|---|
| `Globe` | Alcance, red, rutas entre lugares | `cities`, `routes`, `centerLon` |
| `ParticleSphere` | Datos o IA abstractos: grilla que se vuelve esfera | `count` (1000), `accentShare` |
| `CubeStack` | Piezas que se ensamblan en un todo (27 cubos) | `light` |
| `CubeFold` | Caja o paquete que se cierra, tapa al final | `light` |
| `Tunnel` | Avance, velocidad, transición | `rings`, `accentEvery`, `sides` |
| `TerrainMesh` | Fondo de vuelo sin fin con horizonte en acento | `rows`, `cols`, `relief` |
| `TorusWire` | Objeto giratorio decorativo | `minor`, `segments` |
| `Helix` | Doble hélice con peldaños (ciencia, código, ADN) | `steps`, `turns` |
| `OrbitRings` | Núcleo con anillos y satélites | `rings` |
| `WaveDots` | Campo de puntos con olas viajeras | `grid`, `amplitude` |
| `LayerExplode` | Arquitectura por capas rotuladas | `labels` (de abajo hacia arriba) |
| `CardFlip` | Dar vuelta una tarjeta (antes/después) | `front`, `back`, `cardWidth`, `cardHeight` |
| `CarouselRing` | Galería de tarjetas en anillo | `children`, `count`, `cardWidth`, `cardHeight` |
| `IsoCity` | Crecimiento, mapa de calor en bloques | `grid`, `maxHeight` |
| `ExtrudeType` | Titular con volumen | `text`, `fontSize`, `layers`, `step` |
| `PhoneOrbit` | Presentar una app: teléfono que gira hacia el espectador | `startAngle` |

Ayudas puras en `math.ts`: `rotateX/Y/Z`, `camera({distance|fov, tilt, yaw})` con `project`, `sortBackToFront`, `faceNormal` + `shade`, `greatCircle`, `fibonacciSphere`, `isometric`, `lineByDepth`.

## Notas

- **Canvas o DOM**: lo que tiene muchas primitivas usa `FrameCanvas`. `CardFlip`, `CarouselRing`, `ExtrudeType` y los rótulos de `LayerExplode` van en DOM (el texto lo ve `qa`) con solo traslado y escala 2D: nada de `perspective`/`rotateY` de CSS. `CardFlip` esconde la cara que no mira por ángulo (el ancho sigue a `cos`).
- **`PhoneOrbit`** dibuja la pantalla como una interfaz ficticia hecha de formas dentro del canvas (sin texto, sin hijos): es determinista bajo `--check` y no usa transformaciones 3D de CSS.
- **Oclusión**: se rellena de atrás hacia adelante con el color de fondo (`TerrainMesh` por franja, `TorusWire` por cara, cubos por cara). Si el efecto va sobre otra imagen, tapa lo que tiene detrás: poné `bg` con el rol que coincida con el fondo.
- **Rendimiento**: sin bucles por píxel. Cada dibujo hace de cientos a pocos miles de trazos o rellenos (`WaveDots` ~1300 puntos, `ParticleSphere` ~1000, `TerrainMesh` ~64 franjas con ~130 vértices). Con 4 a 8 cuadros por segundo de captura sobra margen. `ParticleSphere` memoriza la esfera por cantidad de puntos (solo caché de una función pura).
- **Still**: la rotación, el avance y las olas se detienen en `duration`; luego el cuadro no cambia.
- Galería: `examples/fx-3d` (`/?video=fx-3d&props={"theme":"dark"}`).
