# kit

Kit de movimiento reutilizable sobre `engine/` y `themes/`. Todo sale de `kit/index.ts`.

## Regla de pureza

Cada pieza es una función pura del cuadro (de `useFrame()` o de una prop `frame` explícita) y del tema (`useTheme()`). La lista completa está en `docs/reglas.md` ("Lista única de determinismo"): nada de estado que acumule, temporizadores, animaciones CSS, `useId` ni `Math.random` (se usa `random(seed)` del motor). Colores, tipografías, radios, sombras y curvas salen del tema: ninguna pieza trae valores de marca. `__ve.checkDeterminism` debe dar `ok` en las escenas que las usan.

## Piezas

- **Ayudas**: `kf(frame, claves, valores, easing?)` cuadros clave; `track(frame, [[f, x, y], ...])` trayectos 2D; `typed(texto, frame, inicio, cps)` texto que se escribe.
- **Cámara**: `cameraAt(frame, claves, opts?)` devuelve `{x, y, scale, rx, ry, blur}` con inclinación y desenfoque según la velocidad (cámara quieta = sin inclinación ni desenfoque; topes configurables). `<World camera width height>` aplica la transformación y el desenfoque a sus hijos (coordenadas del mundo). `zoomThrough(frame, [ini, fin], cam, objetivo, power?)` convierte la cámara en un atravesado de un punto (se pasa por `opts.map`). `<Wash frame range color?>` velo de cierre de escena.
- **Cursor y viñeta**: `<Cursor frame keys clicks show>` con onda de clic en el acento; `<Vignette amount>`.
- **Garabatos** (trazo a mano que "hierve": el temblor se vuelve a sortear cada `boil` cuadros, 3 por defecto): `<DoodleCircle>`, `<DoodleArrow>`, `<DoodleUnderline>`; se dibujan y se desvanecen por cuadro; el trazo usa acento → acento 2 del tema. Cada uno necesita un `id` único.
- **Texto y fondo**: `<GradientText>` (degradado del tema, `pan` opcional), `<CloudBackground>` (manchas de `theme.cloud`), `<CountUp from to start duration format?>`.
- **Titular**: `<DockedHeadline index title subtitle frame start hide>` y `hideFromScale(scale, umbral?, rango?)` para que se aparte cuando la cámara se acerca.
- **Vuelo**: `flight(frame, [ini, fin], from, to, {arc})` y `<FlyingCard>` (arco y estela).
- **Escena**: `<Stage>` fondo, tipografía y nubes opcionales del tema.

## Precondiciones

- `kf`: `keys` estrictamente creciente (2 o más claves, o una sola = valor fijo); si no, lanza el error del motor.
- `cameraAt`: al menos una clave; `f` estrictamente creciente (si no, lanza un error que nombra los cuadros). Una clave = cámara fija.
- Casos degenerados que NO fallan: `Cursor` con una sola clave (fijo) o `show` corto (el fundido se acorta); `CountUp` con `duration` 0 (salta a `to`); `Wash`, `flight` y `zoomThrough` con inicio = fin (escalón).
- `Doodle*`: `id` único por garabato (se sanea para el degradado: solo letras, números, `_` y `-`).
- `Stage` declara `@font-face` con el primer nombre de `theme.font.family` (sin comillas) para los archivos de `theme.font.files`.
- `World` usa transformación 2D cuando no hay inclinación (`rx = ry = 0`); con inclinación, agrega `perspective(P) rotateX() rotateY()` dentro del `transform` del propio elemento (sin `perspective` ni `preserve-3d` en un ancestro, con `left`/`top` enteros y todo el movimiento en el `transform`; el mismo patrón que `rigTransform` de `stories/`). El mundo se inclina como un plano, así que los hijos no se cruzan en profundidad. Esto evita capturas no idénticas según el historial de cuadros (ver `docs/reglas.md`).

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

Ejemplo completo: `examples/kit-demo` (`/?video=kit-demo&props={"theme":"dark"}`).
