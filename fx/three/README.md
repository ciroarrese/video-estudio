# fx/three

Efectos 3D proyectados a mano (sin librerías 3D): se rota cada punto, se proyecta con perspectiva simple, se ordena de atrás hacia adelante y se dibuja. Todo sale del tema (`useTheme()`); todas las piezas son funciones puras del cuadro y el último cuadro (`frame >= start + duration`) es un still compuesto. Se importa de `fx/three` (o de `fx`, cuando el índice lo reexporte).

## Props comunes (`ThreeProps`)

`frame?`, `start?`, `duration?` (75 por defecto), `width?`, `height?`, `size?`, `seed?`, `style?`, más sobrescrituras de color por rol del tema (los trazos, puntos y rótulos escalan con la caja: `strokeScale` en `common.ts`): `bg` (relleno que tapa lo de atrás), `ink` (trazos principales y texto), `line` (líneas finas), `accent`. Por defecto: `bg`, `text`, `textMuted`, `accent`.

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
| `PhoneOrbit` | Presentar una app: teléfono que gira hacia el espectador | `startAngle`, `children` o `screen` (pantalla propia) |

Ayudas puras en `math.ts`: `rotateX/Y/Z`, `camera({distance|fov, tilt, yaw})` con `project`, `sortBackToFront`, `faceNormal` + `shade`, `greatCircle`, `fibonacciSphere`, `isometric`, `lineByDepth`.

## Estilo del design system

`CardFlip` y `CarouselRing` toman radio, relleno, borde y sombra de `surfaceStyle(theme, "card")` (`cardSurface` en `common.ts`; por defecto borde de 2 px y sin sombra, como siempre; con `elevation: "shadow"` tampoco se dibuja sombra), los cuadrados de muestra de `cornerRadius("control")` y los rótulos el peso de titular. `LayerExplode` usa el peso de titular en sus rótulos. `CarouselRing` y `LayerExplode` escalan su escalonado con `motion.stagger` (`stepDelay`, sin pasarse del tiempo disponible). El resto de las piezas de canvas dibuja con la **pluma** (`pen`, de `useThreeFx`; `penFor` en `common.ts`): grosor, guiones, terminación, halo, forma de punto, uso del acento y temblor de mano (`style.line`), relleno y aristas de las caras (`style.solid`) y extrusión y atenuación por distancia (`style.depth`). La tabla de quién cumple cada campo está en `docs/estilo.md`. Una pieza nueva usa `pen.seg`, `pen.dot`, `pen.poly`, `pen.face`, `pen.disc`, `pen.polyline` y `pen.byDepth` en lugar de `seg`, `dot`, `poly` y `lineByDepth` (con el estilo por defecto hacen lo mismo). `PhoneOrbit` sigue exento en el aparato; su anillo usa la pluma.

## Notas

- **Canvas o DOM**: lo que tiene muchas primitivas usa `FrameCanvas`. `CardFlip`, `CarouselRing`, `ExtrudeType` y los rótulos de `LayerExplode` van en DOM (el texto lo ve `qa`) con traslado y escala 2D: no usan `rotateY` ni perspectiva de CSS (la perspectiva se proyecta a mano). Las posiciones de layout van en enteros y el texto bajo `scale()` pasa `--check` (si una pieza propia no lo pasa, animá `font-size` o escalá solo el fondo). El CSS 3D solo se admite como `perspective()` propio de cada elemento (ver `docs/reglas.md`): `PhoneOrbit` con pantalla es el ejemplo. `CardFlip` esconde la cara que no mira por ángulo (el ancho sigue a `cos`).
- **`PhoneOrbit`**: sin contenido, dibuja la pantalla como una interfaz ficticia de formas dentro del canvas. Con `children` (o el render prop `screen({ width, height, frame })`) la pantalla es DOM con su propio `perspective(distancia * unidad) rotateX() rotateY() translateZ() scale()`, la misma cámara que el canvas y layout entero; el anillo se divide en dos canvas (lo lejano detrás de la pantalla, lo cercano delante). Los hijos se maquetan en una caja del tamaño exacto de la pantalla (`width: "100%"`, `height: "100%"`). Es determinista bajo `--check`.
- **Oclusión**: se rellena de atrás hacia adelante con el color de fondo (`TerrainMesh` por franja, `TorusWire` por cara, cubos por cara). Si el efecto va sobre otra imagen, tapa lo que tiene detrás: poné `bg` con el rol que coincida con el fondo.
- **Rendimiento**: sin bucles por píxel. Cada dibujo hace de cientos a pocos miles de trazos o rellenos (`WaveDots` ~1300 puntos, `ParticleSphere` ~1000, `TerrainMesh` ~64 franjas con ~130 vértices). Con 4 a 8 cuadros por segundo de captura sobra margen. `ParticleSphere` memoriza la esfera por cantidad de puntos (solo caché de una función pura).
- **Still**: la rotación, el avance y las olas se detienen en `duration`; luego el cuadro no cambia.
- **Tamaño por defecto**: el sujeto ocupa alrededor del 70 % de la caja y los grosores salen de `k = strokeScale(width, height)` (1,8 en una caja de 900 px), para que las líneas aguanten en video 1080p.
- Galería: `examples/fx-3d`, 17 tramos (`/?video=fx-3d&props={"theme":"dark"}`); hoja de cuadros: `npm run sheet -- fx-3d --count 17`. Las otras dos galerías son `examples/fx-text` y `examples/fx-data-ui-art` (ver `fx/README.md`).
